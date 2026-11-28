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

  if (
    normalized.split("/").some(
      (part) => part === ".."
    )
  ) {
    throw new Error("المسار غير مسموح");
  }

  const lower = normalized.toLowerCase();

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

  for (const item of blocked) {
    if (
      lower === item ||
      lower.startsWith(`${item}/`) ||
      lower.includes(`/${item}/`)
    ) {
      throw new Error(
        "هذا المسار محظور لأسباب أمنية"
      );
    }
  }

  return normalized;
}

async function githubRequest(path) {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN غير موجود في Vercel"
    );
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
    throw new Error(
      data?.message ||
        `GitHub API error ${response.status}`
    );
  }

  return data;
}

async function readRepositoryFile(path) {
  const normalizedPath =
    normalizePath(path);

  if (!normalizedPath) {
    throw new Error(
      "يجب تحديد مسار الملف لتحليل الكود"
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
      "المسار المطلوب ليس ملفاً"
    );
  }

  const size = Number(
    data.size || 0
  );

  if (size > 500000) {
    throw new Error(
      "الملف أكبر من الحد المسموح للتحليل"
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

function analyzeCodeStructure(
  content,
  path
) {
  const lines =
    content.split("\n");

  const imports = [];
  const exports = [];
  const functions = [];
  const hooks = [];
  const todos = [];
  const possibleIssues = [];

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const line = lines[i];

    const importMatch =
      line.match(
        /^\s*import\s+(.+?)\s+from\s+["'](.+?)["']/
      );

    if (importMatch) {
      imports.push({
        line: i + 1,
        source: importMatch[2],
      });
    }

    if (
      /^\s*export\s+(default\s+)?/.test(
        line
      )
    ) {
      exports.push({
        line: i + 1,
        code: line.trim().slice(0, 300),
      });
    }

    const functionMatch =
      line.match(
        /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)/
      );

    if (functionMatch) {
      functions.push({
        line: i + 1,
        name: functionMatch[1],
      });
    }

    const hookMatch =
      line.match(
        /\b(use[A-Z][A-Za-z0-9_$]*)\s*\(/
      );

    if (hookMatch) {
      hooks.push({
        line: i + 1,
        name: hookMatch[1],
      });
    }

    if (
      /\bTODO\b|\bFIXME\b/i.test(
        line
      )
    ) {
      todos.push({
        line: i + 1,
        text: line.trim().slice(0, 300),
      });
    }

    if (
      /console\.log\s*\(/.test(
        line
      )
    ) {
      possibleIssues.push({
        line: i + 1,
        type: "console_log",
        message:
          "يوجد console.log داخل الملف. يفضل مراجعته قبل الإنتاج.",
      });
    }

    if (
      /dangerouslySetInnerHTML/.test(
        line
      )
    ) {
      possibleIssues.push({
        line: i + 1,
        type: "dangerous_html",
        message:
          "استخدام dangerouslySetInnerHTML يحتاج مراجعة أمنية.",
      });
    }

    if (
      /process\.env\./.test(
        line
      ) &&
      !/NEXT_PUBLIC_/.test(
        line
      )
    ) {
      possibleIssues.push({
        line: i + 1,
        type: "server_env_reference",
        message:
          "تم العثور على متغير بيئة غير NEXT_PUBLIC_. يجب التأكد أن الملف يعمل على الخادم فقط إذا كان يعتمد عليه.",
      });
    }
  }

  return {
    file: path,
    language:
      path.endsWith(".js") ||
      path.endsWith(".jsx")
        ? "JavaScript"
        : path.endsWith(".ts") ||
          path.endsWith(".tsx")
        ? "TypeScript"
        : "Unknown",
    total_lines: lines.length,
    imports,
    exports,
    functions,
    hooks,
    todos,
    possible_issues: possibleIssues,
  };
}

async function getAuthenticatedSupabase() {
  const cookieStore =
    await cookies();

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
          } catch {}
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
        .from(
          "ai_employee_commands"
        )
        .select(
          "execution_log"
        )
        .eq(
          "id",
          commandId
        )
        .maybeSingle();

    if (!command) return;

    const currentLog =
      Array.isArray(
        command.execution_log
      )
        ? command.execution_log
        : [];

    await supabaseAdmin
      .from(
        "ai_employee_commands"
      )
      .update({
        execution_log: [
          ...currentLog,
          {
            event,
            at: new Date().toISOString(),
            ...details,
          },
        ],
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        commandId
      );
  } catch {}
}

export async function POST(
  request
) {
  let commandId = null;

  const supabaseAdmin =
    createAdminSupabase();

  try {
    const supabaseAuth =
      await getAuthenticatedSupabase();

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabaseAuth.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "يجب تسجيل الدخول أولاً",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, is_super_admin, account_status"
        )
        .eq(
          "id",
          user.id
        )
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

    const body =
      await request.json();

    commandId =
      body?.command_id ||
      null;

    if (!commandId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "command_id مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: command,
      error: commandError,
    } =
      await supabaseAdmin
        .from(
          "ai_employee_commands"
        )
        .select("*")
        .eq(
          "id",
          commandId
        )
        .maybeSingle();

    if (
      commandError ||
      !command
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "الأمر غير موجود",
        },
        {
          status: 404,
        }
      );
    }

    if (
      command.command_type !==
        "read_project_files" &&
      command.command_type !==
        "analyze_code"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "نوع الأمر غير مدعوم في طبقة التنفيذ الحالية",
        },
        {
          status: 400,
        }
      );
    }

    if (
      command.status !==
      "running"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "الأمر يجب أن يكون في حالة قيد التنفيذ",
          status:
            command.status,
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

    const requiredCapability =
      command.command_type ===
      "analyze_code"
        ? "analyze_code"
        : "read_project_files";

    if (
      !requestedCapabilities.includes(
        requiredCapability
      )
    ) {
      throw new Error(
        `الأمر لا يطلب الصلاحية المطلوبة: ${requiredCapability}`
      );
    }

    const {
      data: employee,
      error: employeeError,
    } =
      await supabaseAdmin
        .from(
          "ai_employees"
        )
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

    if (
      employee.status !==
      "active"
    ) {
      throw new Error(
        "موظف AI غير نشط"
      );
    }

    const {
      data: authorization,
      error:
        authorizationError,
    } =
      await supabaseAuth.rpc(
        "authorize_ai_employee_command",
        {
          p_command_id:
            commandId,
        }
      );

    if (
      authorizationError
    ) {
      throw new Error(
        `فشل التحقق من بوابة الصلاحيات: ${authorizationError.message}`
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
          requiredCapability,
      }
    );

    const inputData =
      command.input_data &&
      typeof command.input_data ===
        "object"
        ? command.input_data
        : {};

    const path =
      normalizePath(
        inputData.path || ""
      );

    if (!path) {
      throw new Error(
        "تحليل الكود يحتاج مسار ملف محدد"
      );
    }

    await appendExecutionLog(
      supabaseAdmin,
      commandId,
      "github_file_read_started",
      {
        repository:
          `${GITHUB_OWNER}/${GITHUB_REPO}`,
        branch:
          GITHUB_BRANCH,
        path,
      }
    );

    const file =
      await readRepositoryFile(
        path
      );

    await appendExecutionLog(
      supabaseAdmin,
      commandId,
      "github_file_read_completed",
      {
        path,
        size:
          file.size,
      }
    );

    const analysis =
      analyzeCodeStructure(
        file.content,
        file.path
      );

    await appendExecutionLog(
      supabaseAdmin,
      commandId,
      "code_analysis_completed",
      {
        path,
        total_lines:
          analysis.total_lines,
        imports:
          analysis.imports.length,
        functions:
          analysis.functions.length,
        possible_issues:
          analysis.possible_issues.length,
      }
    );

    const {
      data: completed,
      error:
        completeError,
    } =
      await supabaseAuth.rpc(
        "complete_ai_employee_command",
        {
          p_command_id:
            commandId,
          p_result:
            `تم تحليل الملف ${path} بنجاح. عدد الأسطر: ${analysis.total_lines}.`,
          p_output_data:
            analysis,
        }
      );

    if (
      completeError
    ) {
      throw new Error(
        `تم التحليل لكن تعذر إكمال الأمر: ${completeError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "تم تحليل الكود بنجاح",
      command_id:
        commandId,
      completed: true,
      analysis,
      execution:
        completed || null,
    });
  } catch (error) {
    const message =
      error?.message ||
      "حدث خطأ غير متوقع";

    if (commandId) {
      await appendExecutionLog(
        supabaseAdmin,
        commandId,
        "execution_failed",
        {
          error:
            message,
        }
      );

      try {
        const supabaseAuth =
          await getAuthenticatedSupabase();

        await supabaseAuth.rpc(
          "fail_ai_employee_command",
          {
            p_command_id:
              commandId,
            p_error_message:
              message,
          }
        );
      } catch {
        try {
          await supabaseAdmin
            .from(
              "ai_employee_commands"
            )
            .update({
              status:
                "failed",
              error_message:
                message,
              completed_at:
                new Date().toISOString(),
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              commandId
            );
        } catch {}
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          message,
        command_id:
          commandId,
      },
      {
        status: 500,
      }
    );
  }
}
