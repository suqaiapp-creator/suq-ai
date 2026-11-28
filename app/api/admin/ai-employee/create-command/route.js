import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

async function getAuthenticatedClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
}

function normalizeCapabilities(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    ),
  ];
}

export async function POST(request) {
  let serviceClient = null;

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        {
          success: false,
          error: "إعدادات Supabase غير مكتملة.",
        },
        500
      );
    }

    serviceClient = createSupabaseClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authenticatedClient = await getAuthenticatedClient();

    const {
      data: { user },
      error: userError,
    } = await authenticatedClient.auth.getUser();

    if (userError || !user) {
      return json(
        {
          success: false,
          error: "غير مصرح. يجب تسجيل الدخول.",
        },
        401
      );
    }

    const { data: profile, error: profileError } =
      await serviceClient
        .from("profiles")
        .select("id,is_super_admin,account_status")
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.is_super_admin !== true ||
      profile.account_status === "suspended"
    ) {
      return json(
        {
          success: false,
          error: "هذه العملية متاحة للـ Super Admin فقط.",
        },
        403
      );
    }

    const body = await request.json().catch(() => ({}));

    const command = String(body?.command || "").trim();
    const commandType = String(
      body?.command_type || ""
    ).trim();

    const riskLevel = String(
      body?.risk_level || "low"
    ).trim();

    const requestedCapabilities =
      normalizeCapabilities(
        body?.requested_capabilities
      );

    const inputData =
      body?.input_data &&
      typeof body.input_data === "object"
        ? body.input_data
        : {};

    if (!command) {
      return json(
        {
          success: false,
          error: "يجب إدخال وصف الأمر.",
        },
        400
      );
    }

    if (!commandType) {
      return json(
        {
          success: false,
          error: "يجب تحديد نوع الأمر.",
        },
        400
      );
    }

    if (requestedCapabilities.length === 0) {
      return json(
        {
          success: false,
          error: "يجب تحديد صلاحية واحدة على الأقل.",
        },
        400
      );
    }

    const allowedCommandTypes = [
      "read_project_files",
      "analyze_code",
      "suggest_changes",
      "create_files",
      "edit_files",
      "run_build",
      "run_tests",
      "database_review",
      "database_modify",
      "prepare_git_commit",
      "deploy_vercel",
      "rollback",
    ];

    if (!allowedCommandTypes.includes(commandType)) {
      return json(
        {
          success: false,
          error:
            `نوع الأمر ${commandType} غير مدعوم.`,
        },
        400
      );
    }

    /*
     * ---------------------------------------------------------
     * FIND AI EMPLOYEE
     * ---------------------------------------------------------
     *
     * حالياً نستخدم موظف AI باسم "والم".
     *
     * لاحقاً يمكن توسيع هذا API ليقبل ai_employee_id
     * من الواجهة عند وجود أكثر من موظف.
     */
    let employeeQuery = serviceClient
      .from("ai_employees")
      .select("id,name,status")
      .eq("name", "والم")
      .limit(1);

    if (body?.ai_employee_id) {
      employeeQuery = serviceClient
        .from("ai_employees")
        .select("id,name,status")
        .eq("id", body.ai_employee_id)
        .limit(1);
    }

    const {
      data: employees,
      error: employeeError,
    } = await employeeQuery;

    if (
      employeeError ||
      !employees ||
      employees.length === 0
    ) {
      return json(
        {
          success: false,
          error:
            "لم يتم العثور على موظف AI المطلوب.",
        },
        404
      );
    }

    const employee = employees[0];

    if (employee.status !== "active") {
      return json(
        {
          success: false,
          error:
            "موظف AI غير نشط ولا يمكن إنشاء أوامر له.",
        },
        409
      );
    }

    /*
     * ---------------------------------------------------------
     * CHECK CAPABILITIES
     * ---------------------------------------------------------
     */

    const { data: capabilities, error: capabilitiesError } =
      await serviceClient
        .from("ai_employee_capabilities")
        .select(
          "id,ai_employee_id,capability_key,enabled,requires_approval,risk_level"
        )
        .eq("ai_employee_id", employee.id)
        .in(
          "capability_key",
          requestedCapabilities
        );

    if (capabilitiesError) {
      return json(
        {
          success: false,
          error:
            capabilitiesError.message ||
            "تعذر قراءة صلاحيات موظف AI.",
        },
        500
      );
    }

    const capabilityMap = new Map(
      (capabilities || []).map((item) => [
        item.capability_key,
        item,
      ])
    );

    const missingCapabilities =
      requestedCapabilities.filter(
        (capability) =>
          !capabilityMap.has(capability)
      );

    if (missingCapabilities.length > 0) {
      return json(
        {
          success: false,
          error:
            "بعض الصلاحيات المطلوبة غير موجودة لموظف AI.",
          missing_capabilities:
            missingCapabilities,
        },
        400
      );
    }

    const disabledCapabilities =
      requestedCapabilities.filter(
        (capability) =>
          capabilityMap.get(capability)?.enabled !==
          true
      );

    if (disabledCapabilities.length > 0) {
      return json(
        {
          success: false,
          error:
            "بعض الصلاحيات المطلوبة غير مفعّلة.",
          disabled_capabilities:
            disabledCapabilities,
        },
        403
      );
    }

    /*
     * ---------------------------------------------------------
     * DETERMINE APPROVAL
     * ---------------------------------------------------------
     */

    const capabilityRequiresApproval =
      requestedCapabilities.some(
        (capability) =>
          capabilityMap.get(capability)
            ?.requires_approval === true
      );

    const requiresApproval =
      body?.requires_approval === true ||
      capabilityRequiresApproval ||
      riskLevel === "critical";

    /*
     * ---------------------------------------------------------
     * CREATE COMMAND
     * ---------------------------------------------------------
     */

    const commandStatus = "pending";

    const approvalStatus = requiresApproval
      ? "pending"
      : "not_required";

    const {
      data: createdCommand,
      error: commandInsertError,
    } = await serviceClient
      .from("ai_employee_commands")
      .insert({
        ai_employee_id: employee.id,
        created_by: user.id,
        command,
        command_type: commandType,
        status: commandStatus,
        risk_level: riskLevel,
        requires_approval: requiresApproval,
        approval_status: approvalStatus,
        requested_capabilities:
          requestedCapabilities,
        input_data: inputData,
        points_cost:
          Number.isFinite(body?.points_cost)
            ? Number(body.points_cost)
            : 0,
        estimated_cost:
          Number.isFinite(body?.estimated_cost)
            ? Number(body.estimated_cost)
            : 0,
      })
      .select("*")
      .single();

    if (commandInsertError || !createdCommand) {
      return json(
        {
          success: false,
          error:
            commandInsertError?.message ||
            "تعذر إنشاء الأمر.",
        },
        500
      );
    }

    /*
     * ---------------------------------------------------------
     * CREATE APPROVAL AUTOMATICALLY
     * ---------------------------------------------------------
     *
     * إذا كان الأمر يحتاج موافقة، ننشئ سجل الموافقة
     * مباشرة.
     */

    let approval = null;

    if (requiresApproval) {
      const {
        data: createdApproval,
        error: approvalInsertError,
      } = await serviceClient
        .from("ai_employee_approvals")
        .insert({
          command_id: createdCommand.id,
          ai_employee_id: employee.id,
          requested_by: user.id,
          status: "pending",
          requested_capabilities:
            requestedCapabilities,
          risk_level: riskLevel,
        })
        .select("*")
        .single();

      if (approvalInsertError || !createdApproval) {
        /*
         * إذا فشل إنشاء طلب الموافقة، لا نترك الأمر
         * معلقاً بدون Approval.
         *
         * نحاول حذف الأمر الذي تم إنشاؤه.
         */
        await serviceClient
          .from("ai_employee_commands")
          .delete()
          .eq("id", createdCommand.id);

        return json(
          {
            success: false,
            error:
              approvalInsertError?.message ||
              "تعذر إنشاء طلب الموافقة.",
          },
          500
        );
      }

      approval = createdApproval;
    }

    /*
     * ---------------------------------------------------------
     * FINAL RESPONSE
     * ---------------------------------------------------------
     */

    return json({
      success: true,
      message: requiresApproval
        ? "تم إنشاء الأمر وطلب الموافقة تلقائيًا."
        : "تم إنشاء الأمر بنجاح ولا يحتاج إلى موافقة.",
      command: createdCommand,
      approval,
      requires_approval: requiresApproval,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error?.message ||
          "حدث خطأ غير معروف أثناء إنشاء الأمر.",
      },
      500
    );
  }
}
