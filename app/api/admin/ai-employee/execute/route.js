import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

const GITHUB_API = "https://api.github.com";

const GITHUB_OWNER =
  process.env.GITHUB_REPOSITORY_OWNER || "suqaiapp-creator";

const GITHUB_REPO =
  process.env.GITHUB_REPOSITORY_NAME || "suq-ai";

const GITHUB_BRANCH =
  process.env.GITHUB_REPOSITORY_BRANCH || "main";

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Suq-AI-Walm",
  };
}

function normalizePath(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const normalized = raw
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");

  const parts = normalized.split("/");

  if (parts.some((part) => part === "..")) {
    throw new Error("المسار غير مسموح");
  }

  const blocked = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test",
    "node_modules",
    ".git",
    ".vercel",
  ];

  const lower = normalized.toLowerCase();

  for (const item of blocked) {
    if (
      lower === item ||
      lower.startsWith(`${item}/`) ||
      lower.includes(`/${item}/`)
    ) {
      throw new Error("هذا المسار محظور لأسباب أمنية");
    }
  }

  return normalized;
}

function isSafeFilePath(path) {
  const normalized = normalizePath(path);

  if (!normalized) return false;

  const lower = normalized.toLowerCase();

  const blockedNames = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test",
  ];

  if (
    blockedNames.some(
      (name) =>
        lower === name ||
        lower.endsWith(`/${name}`)
    )
  ) {
    return false;
  }

  const blockedFolders = [
    "node_modules/",
    ".git/",
    ".vercel/",
  ];

  if (
    blockedFolders.some((folder) =>
      lower.includes(folder)
    )
  ) {
    return false;
  }

  return true;
}

async function githubRequest(path) {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN غير موجود في Vercel");
  }

  const response = await fetch(
    `${GITHUB_API}${path}`,
    {
      method: "GET",
      headers: githubHeaders(),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      `GitHub API error ${response.status}`;

    throw new Error(message);
  }

  return data;
}

async function readRepositoryTree() {
  const data = await githubRequest(
    `/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(
      GITHUB_REPO
    )}/git/trees/${encodeURIComponent(
      GITHUB_BRANCH
    )}?recursive=1`
  );

  const tree = Array.isArray(data?.tree)
    ? data.tree
    : [];

  const files = tree
    .filter(
      (item) =>
        item.type === "blob" &&
        typeof item.path === "string" &&
        isSafeFilePath(item.path)
    )
    .slice(0, 500)
    .map((item) => ({
      path: item.path,
      type: item.type,
      size: item.size || 0,
      sha: item.sha || null,
      url: item.url || null,
    }));

  return {
    repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    branch: GITHUB_BRANCH,
    total_files: files.length,
    truncated: tree.length > 500,
    files,
  };
}

async function readRepositoryFile(path) {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return readRepositoryTree();
  }

  if (!isSafeFilePath(normalizedPath)) {
    throw new Error(
      "لا يمكن قراءة هذا الملف لأسباب أمنية"
    );
  }

  const data = await githubRequest(
    `/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(
      GITHUB_REPO
    )}/contents/${normalizedPath}?ref=${encodeURIComponent(
      GITHUB_BRANCH
    )}`
  );

  if (Array.isArray(data)) {
    throw new Error(
      "المسار المطلوب مجلد وليس ملفاً"
    );
  }

  if (data?.type !== "file") {
    throw new Error(
      "المسار المطلوب ليس ملفاً قابلاً للقراءة"
    );
  }

  const size = Number(data.size || 0);

  if (size > 500000) {
    throw new Error(
      "الملف أكبر من الحد المسموح للقراءة"
    );
  }

  if (!data.content) {
    throw new Error(
      "GitHub لم يرجع محتوى الملف"
    );
  }

  const content = Buffer.from(
    data.content.replace(/\n/g, ""),
    "base64"
  ).toString("utf8");

  return {
    repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    branch: GITHUB_BRANCH,
    path: normalizedPath,
    size,
    sha: data.sha || null,
    content,
  };
}

async function getAuthenticatedSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            // لا نحتاج تعديل الكوكيز هنا
          }
        },
      },
    }
  );
}

function createAdminSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function appendExecutionLog(
  supabaseAdmin,
  commandId,
  event,
  details = {}
) {
  try {
    const { data: command } =
      await supabaseAdmin
        .from("ai_employee_commands")
        .select("execution_log")
        .eq("id", commandId)
        .maybeSingle();

    if (!command) return;

    const currentLog = Array.isArray(
      command.execution_log
    )
      ? command.execution_log
      : [];

    const nextLog = [
      ...currentLog,
      {
        event,
        at: new Date().toISOString(),
        ...details,
      },
    ];

    await supabaseAdmin
      .from("ai_employee_commands")
      .update({
        execution_log: nextLog,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commandId);
  } catch {
    // سجل التنفيذ لا يجب أن يمنع العملية الأساسية
  }
}

export async function POST(request) {
  let commandId = null;

  const supabaseAdmin = createAdminSupabase();

  try {
    const supabaseAuth =
      await getAuthenticatedSupabase();

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "يجب تسجيل الدخول أولاً",
        },
        {
          status: 401,
        }
      );
    }

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, is_super_admin, account_status"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile?.is_super_admin
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "غير مصرح. هذه العملية متاحة للـ Super Admin فقط",
        },
        {
          status: 403,
        }
      );
    }

    if (
      profile.account_status &&
      profile.account_status !== "active"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "حساب Super Admin غير نشط",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    commandId =
      body?.command_id || null;

    if (!commandId) {
      return NextResponse.json(
        {
          success: false,
          error: "command_id مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: command,
      error: commandError,
    } = await supabaseAdmin
      .from("ai_employee_commands")
      .select("*")
      .eq("id", commandId)
      .maybeSingle();

    if (
      commandError ||
      !command
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "الأمر غير موجود",
        },
        {
          status: 404,
        }
      );
    }

    if (
      command.command_type !==
      "read_project_files"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "هذا النوع من الأوامر غير مربوط بطبقة التنفيذ الحالية",
        },
        {
          status: 400,
        }
      );
    }

    if (command.status !== "running") {
      return NextResponse.json(
        {
          success: false,
          error:
            "الأمر يجب أن يكون في حالة قيد التنفيذ",
          status: command.status,
        },
        {
          status: 409,
        }
      );
    }

    const requestedCapabilities =
      Array.isArray(
        command.requested_capabilities
      )
        ? command.requested_capabilities
        : [];

    if (
      !requestedCapabilities.includes(
        "read_project_files"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "الأمر لا يطلب صلاحية قراءة الملفات",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: employee,
      error: employeeError,
    } = await supabaseAdmin
      .from("ai_employees")
      .select(
        "id, name, status"
      )
      .eq(
        "id",
        command.ai_employee_id
      )
      .maybeSingle();

    if (
      employeeError ||
      !employee
    ) {
      throw new Error(
        "موظف AI غير موجود"
      );
    }

    if (employee.status !== "active") {
      throw new Error(
        "موظف AI غير نشط"
      );
    }

    /*
      مهم:
      هنا نستخدم supabaseAuth وليس supabaseAdmin.
      السبب أن authorize_ai_employee_command
      يعتمد على auth.uid().
    */
    const {
      data: authorization,
      error: authorizationError,
    } = await supabaseAuth.rpc(
      "authorize_ai_employee_command",
      {
        p_command_id: commandId,
      }
    );

    if (authorizationError) {
      throw new Error(
        `فشل التحقق من بوابة الصلاحيات: ${
          authorizationError.message
        }`
      );
    }

    if (
      !authorization?.authorized
    ) {
      throw new Error(
        authorization?.message ||
          "الأمر غير مصرح له بالتنفيذ"
      );
    }

    await appendExecutionLog(
      supabaseAdmin,
      commandId,
      "execution_authorized",
      {
        capability:
          "read_project_files",
        risk_level:
          command.risk_level || "low",
      }
    );

    const inputData =
      command.input_data &&
      typeof command.input_data === "object"
        ? command.input_data
        : {};

    const requestedPath =
      normalizePath(
        inputData.path || ""
      );

    await appendExecutionLog(
      supabaseAdmin,
      commandId,
      "github_read_started",
      {
        repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
        branch: GITHUB_BRANCH,
        path:
          requestedPath || "/",
      }
    );

    const result =
      requestedPath
        ? await readRepositoryFile(
            requestedPath
          )
        : await readRepositoryTree();

    await appendExecutionLog(
      supabaseAdmin,
      commandId,
      "github_read_completed",
      {
        repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
        branch: GITHUB_BRANCH,
        path:
          requestedPath || "/",
        total_files:
          result.total_files ||
          undefined,
      }
    );

    /*
      أيضاً نستخدم supabaseAuth هنا
      لأن complete_ai_employee_command
      يعتمد على auth.uid().
    */
    const {
      data: completed,
      error: completeError,
    } = await supabaseAuth.rpc(
      "complete_ai_employee_command",
      {
        p_command_id: commandId,
        p_result: requestedPath
          ? `تمت قراءة الملف ${requestedPath} بنجاح.`
          : `تمت قراءة هيكل مشروع ${GITHUB_OWNER}/${GITHUB_REPO} بنجاح.`,
        p_output_data: result,
      }
    );

    if (completeError) {
      throw new Error(
        `تمت قراءة GitHub لكن تعذر إكمال الأمر: ${
          completeError.message
        }`
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "تمت قراءة مشروع سوق AI بنجاح",
      command_id: commandId,
      completed: true,
      result,
      execution: completed || null,
    });
  } catch (error) {
    const message =
      error?.message ||
      "حدث خطأ غير متوقع أثناء تنفيذ الأمر";

    if (commandId) {
      await appendExecutionLog(
        supabaseAdmin,
        commandId,
        "execution_failed",
        {
          error: message,
        }
      );

      /*
        نستخدم اتصال المستخدم لاحقاً إذا أمكن
        حتى تعمل auth.uid() داخل RPC.
      */
      try {
        const supabaseAuth =
          await getAuthenticatedSupabase();

        await supabaseAuth.rpc(
          "fail_ai_employee_command",
          {
            p_command_id: commandId,
            p_error_message: message,
          }
        );
      } catch {
        /*
          إذا فشل RPC أيضاً، نضمن على الأقل
          تسجيل الخطأ مباشرة عبر service role.
        */

        try {
          const {
            data: currentCommand,
          } = await supabaseAdmin
            .from(
              "ai_employee_commands"
            )
            .select(
              "execution_log, started_at"
            )
            .eq(
              "id",
              commandId
            )
            .maybeSingle();

          const log = Array.isArray(
            currentCommand?.execution_log
          )
            ? currentCommand.execution_log
            : [];

          const startedAt =
            currentCommand?.started_at
              ? new Date(
                  currentCommand.started_at
                ).getTime()
              : null;

          const durationSeconds =
            startedAt
              ? Math.max(
                  0,
                  (
                    Date.now() -
                    startedAt
                  ) / 1000
                )
              : 0;

          await supabaseAdmin
            .from(
              "ai_employee_commands"
            )
            .update({
              status: "failed",
              error_message: message,
              completed_at:
                new Date().toISOString(),
              duration_seconds:
                durationSeconds,
              execution_log: [
                ...log,
                {
                  event:
                    "execution_failed",
                  at: new Date().toISOString(),
                  error: message,
                  fallback: true,
                },
              ],
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              commandId
            );
        } catch {
          // لا شيء إضافي
        }
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
        command_id: commandId,
      },
      {
        status: 500,
      }
    );
  }
}
