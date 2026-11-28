import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "suqaiapp-creator";
const GITHUB_REPO = process.env.GITHUB_REPO || "suq-ai";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

const MAX_FILE_SIZE = 500_000;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizePath(inputPath) {
  if (!inputPath) return "";

  let value = String(inputPath).trim().replaceAll("\\", "/");

  while (value.startsWith("/")) {
    value = value.slice(1);
  }

  if (
    value.includes("..") ||
    value.startsWith(".git") ||
    value.startsWith(".vercel") ||
    value.startsWith("node_modules") ||
    value === ".env" ||
    value.startsWith(".env.")
  ) {
    throw new Error("مسار الملف غير مسموح.");
  }

  return value;
}

function githubHeaders() {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN غير موجود في إعدادات Vercel.");
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubGet(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: githubHeaders(),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `GitHub request failed with status ${response.status}`
    );
  }

  return data;
}

async function readGithubFile(path) {
  const safePath = normalizePath(path);

  if (!safePath) {
    throw new Error("يجب تحديد مسار الملف.");
  }

  const encodedPath = safePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}` +
    `/contents/${encodedPath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;

  const data = await githubGet(url);

  if (Array.isArray(data)) {
    throw new Error("المسار يشير إلى مجلد وليس ملفًا.");
  }

  if (!data?.content) {
    throw new Error("لم يتم العثور على محتوى الملف.");
  }

  const buffer = Buffer.from(data.content.replace(/\s/g, ""), "base64");

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("حجم الملف أكبر من الحد المسموح للتحليل.");
  }

  return {
    path: safePath,
    sha: data.sha || null,
    size: buffer.length,
    content: buffer.toString("utf8"),
  };
}

function detectLanguage(path) {
  const lower = path.toLowerCase();

  if (lower.endsWith(".js")) return "JavaScript";
  if (lower.endsWith(".jsx")) return "JavaScript JSX";
  if (lower.endsWith(".ts")) return "TypeScript";
  if (lower.endsWith(".tsx")) return "TypeScript TSX";
  if (lower.endsWith(".css")) return "CSS";
  if (lower.endsWith(".scss")) return "SCSS";
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".md")) return "Markdown";
  if (lower.endsWith(".sql")) return "SQL";

  return "غير محدد";
}

function analyzeCode(content, path) {
  const lines = content.split(/\r?\n/);

  const imports = [];
  const exports = [];
  const functions = [];
  const hooks = [];
  const todos = [];
  const issues = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed.startsWith("import ") ||
      trimmed.startsWith("import{") ||
      trimmed.startsWith("import(")
    ) {
      imports.push(trimmed);
    }

    if (
      trimmed.startsWith("export ") ||
      trimmed.startsWith("export{") ||
      trimmed.startsWith("export default")
    ) {
      exports.push(trimmed);
    }

    if (
      /\bfunction\s+[A-Za-z0-9_$]+\s*\(/.test(trimmed) ||
      /\bconst\s+[A-Za-z0-9_$]+\s*=\s*(async\s*)?\(/.test(trimmed) ||
      /\bconst\s+[A-Za-z0-9_$]+\s*=\s*(async\s*)?[A-Za-z0-9_$]+\s*=>/.test(
        trimmed
      )
    ) {
      functions.push(trimmed);
    }

    if (
      trimmed.includes("useState(") ||
      trimmed.includes("useEffect(") ||
      trimmed.includes("useMemo(") ||
      trimmed.includes("useCallback(") ||
      trimmed.includes("useRef(") ||
      trimmed.includes("useContext(")
    ) {
      hooks.push(trimmed);
    }

    if (/\bTODO\b|\bFIXME\b/i.test(trimmed)) {
      todos.push(trimmed);
    }
  }

  if (/console\.(log|warn|error)\s*\(/.test(content)) {
    issues.push({
      type: "console",
      level: "low",
      message: "يوجد استخدام لـ console.* داخل الملف؛ يفضّل تنظيف سجلات الإنتاج.",
    });
  }

  if (content.includes("dangerouslySetInnerHTML")) {
    issues.push({
      type: "security",
      level: "high",
      message:
        "تم العثور على dangerouslySetInnerHTML؛ يجب التأكد من أن المحتوى آمن ومُنقّى.",
    });
  }

  const envMatches = content.match(/process\.env\.([A-Z0-9_]+)/g) || [];

  const publicEnvIssues = envMatches.filter(
    (item) => !item.includes("NEXT_PUBLIC_")
  );

  if (publicEnvIssues.length > 0) {
    issues.push({
      type: "environment",
      level: "medium",
      message:
        "تم العثور على متغيرات process.env غير مسبوقة بـ NEXT_PUBLIC_. يجب التأكد أنها لا تصل إلى Client Component.",
    });
  }

  return {
    path,
    language: detectLanguage(path),
    total_lines: lines.length,
    imports_count: imports.length,
    exports_count: exports.length,
    functions_count: functions.length,
    hooks_count: hooks.length,
    todos_count: todos.length,
    imports: imports.slice(0, 100),
    exports: exports.slice(0, 100),
    functions: functions.slice(0, 100),
    hooks: hooks.slice(0, 100),
    todos: todos.slice(0, 100),
    issues,
  };
}

function suggestChanges(content, path) {
  const analysis = analyzeCode(content, path);

  const suggestions = [];

  if (analysis.total_lines > 1500) {
    suggestions.push({
      priority: "medium",
      category: "architecture",
      title: "تقسيم الملف الكبير",
      description:
        "الملف يحتوي على عدد كبير من الأسطر. يفضّل تقسيمه إلى مكونات وHooks وملفات مساعدة مستقلة لتسهيل الصيانة وتقليل مخاطر التعديل.",
    });
  }

  if (analysis.functions_count > 30) {
    suggestions.push({
      priority: "medium",
      category: "maintainability",
      title: "تقسيم الدوال",
      description:
        "عدد الدوال مرتفع داخل الملف. يمكن نقل الدوال العامة أو المتكررة إلى ملفات utilities أو hooks مستقلة.",
    });
  }

  if (analysis.hooks_count > 20) {
    suggestions.push({
      priority: "medium",
      category: "react",
      title: "مراجعة استخدام Hooks",
      description:
        "عدد استخدامات React Hooks مرتفع. يفضّل مراجعة مسؤوليات المكون والتأكد من عدم وجود state أو effects يمكن فصلها.",
    });
  }

  if (analysis.issues.some((issue) => issue.type === "console")) {
    suggestions.push({
      priority: "low",
      category: "cleanup",
      title: "تنظيف console logs",
      description:
        "يفضّل إزالة أو تنظيم سجلات console قبل الإنتاج، أو استخدام نظام logging مركزي عند الحاجة.",
    });
  }

  if (analysis.issues.some((issue) => issue.type === "security")) {
    suggestions.push({
      priority: "high",
      category: "security",
      title: "مراجعة المحتوى HTML",
      description:
        "يجب مراجعة مصدر المحتوى المستخدم مع dangerouslySetInnerHTML والتأكد من تعقيمه قبل العرض.",
    });
  }

  if (analysis.issues.some((issue) => issue.type === "environment")) {
    suggestions.push({
      priority: "medium",
      category: "security",
      title: "مراجعة متغيرات البيئة",
      description:
        "يجب التأكد أن الأسرار ومفاتيح الخدمات لا يتم استخدامها داخل كود يصل إلى المتصفح.",
    });
  }

  if (analysis.todos_count > 0) {
    suggestions.push({
      priority: "low",
      category: "maintenance",
      title: "مراجعة TODO/FIXME",
      description:
        `يوجد ${analysis.todos_count} عنصر TODO/FIXME داخل الملف ويستحسن مراجعتها لاحقًا.`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      priority: "low",
      category: "general",
      title: "لا توجد ملاحظات هيكلية واضحة",
      description:
        "لم يجد التحليل المحلي مؤشرات واضحة تستدعي تعديلًا مباشرًا. يمكن إجراء مراجعة أعمق لاحقًا.",
    });
  }

  return {
    path,
    summary: `تمت مراجعة الملف ${path} واقتراح تحسينات بدون تعديل الملف.`,
    analysis,
    suggestions,
    safety: {
      files_modified: false,
      files_created: false,
      github_write_used: false,
      openai_used: false,
      runway_used: false,
      points_charged: 0,
      estimated_cost_usd: 0,
    },
  };
}

function appendExecutionLog(existing, event, data = {}) {
  const current = Array.isArray(existing) ? existing : [];

  return [
    ...current,
    {
      event,
      at: new Date().toISOString(),
      ...data,
    },
  ];
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

export async function POST(request) {
  let commandId = null;
  let serviceClient = null;
  let authenticatedClient = null;

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

    authenticatedClient = await getAuthenticatedClient();

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

    const { data: profile, error: profileError } = await serviceClient
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

    commandId = body?.command_id;

    if (!commandId) {
      return json(
        {
          success: false,
          error: "command_id مطلوب.",
        },
        400
      );
    }

    const { data: command, error: commandError } = await serviceClient
      .from("ai_employee_commands")
      .select("*")
      .eq("id", commandId)
      .single();

    if (commandError || !command) {
      return json(
        {
          success: false,
          error: "لم يتم العثور على الأمر.",
        },
        404
      );
    }

    if (command.status !== "running") {
      return json(
        {
          success: false,
          error: `حالة الأمر الحالية هي ${command.status} وليست running.`,
        },
        409
      );
    }

    const commandType = command.command_type;

    const capabilityMap = {
      read_project_files: "read_project_files",
      analyze_code: "analyze_code",
      suggest_changes: "suggest_changes",
    };

    const requiredCapability = capabilityMap[commandType];

    if (!requiredCapability) {
      throw new Error(
        `نوع الأمر ${commandType} غير مدعوم حاليًا في محرك التنفيذ.`
      );
    }

    const requestedCapabilities = Array.isArray(
      command.requested_capabilities
    )
      ? command.requested_capabilities
      : [];

    if (!requestedCapabilities.includes(requiredCapability)) {
      throw new Error(
        `الصلاحية المطلوبة ${requiredCapability} غير موجودة ضمن الأمر.`
      );
    }

    const { data: employee, error: employeeError } = await serviceClient
      .from("ai_employees")
      .select("id,name,status")
      .eq("id", command.ai_employee_id)
      .single();

    if (employeeError || !employee) {
      throw new Error("لم يتم العثور على موظف AI المرتبط بالأمر.");
    }

    if (employee.status !== "active") {
      throw new Error("موظف AI غير نشط.");
    }

    const { data: authorization, error: authorizationError } =
      await authenticatedClient.rpc("authorize_ai_employee_command", {
        p_command_id: commandId,
      });

    if (authorizationError) {
      throw new Error(
        authorizationError.message || "تعذر تفويض تنفيذ الأمر."
      );
    }

    if (!authorization?.authorized) {
      throw new Error(
        authorization?.reason || "الأمر غير مصرح بتنفيذه."
      );
    }

    const logAfterAuthorization = appendExecutionLog(
      command.execution_log,
      "execution_authorized",
      {
        capability: requiredCapability,
      }
    );

    await serviceClient
      .from("ai_employee_commands")
      .update({
        execution_log: logAfterAuthorization,
      })
      .eq("id", commandId);

    const inputData =
      command.input_data && typeof command.input_data === "object"
        ? command.input_data
        : {};

    const path = normalizePath(inputData.path || "");

    if (!path) {
      throw new Error("يجب تحديد input_data.path للملف المطلوب.");
    }

    if (commandType === "read_project_files") {
      const startLog = appendExecutionLog(
        logAfterAuthorization,
        "github_file_read_started",
        {
          path,
        }
      );

      await serviceClient
        .from("ai_employee_commands")
        .update({
          execution_log: startLog,
        })
        .eq("id", commandId);

      const file = await readGithubFile(path);

      const completedLog = appendExecutionLog(
        startLog,
        "github_file_read_completed",
        {
          path: file.path,
          size: file.size,
        }
      );

      const { error: completeError } =
        await authenticatedClient.rpc("complete_ai_employee_command", {
          p_command_id: commandId,
          p_result: `تمت قراءة الملف ${file.path} بنجاح.`,
          p_output_data: {
            path: file.path,
            size: file.size,
            sha: file.sha,
            content: file.content,
          },
        });

      if (completeError) {
        throw new Error(
          completeError.message || "تعذر إكمال الأمر."
        );
      }

      await serviceClient
        .from("ai_employee_commands")
        .update({
          execution_log: appendExecutionLog(
            completedLog,
            "execution_completed"
          ),
        })
        .eq("id", commandId);

      return json({
        success: true,
        command_id: commandId,
        command_type: commandType,
        result: `تمت قراءة الملف ${file.path} بنجاح.`,
      });
    }

    if (commandType === "analyze_code") {
      const startLog = appendExecutionLog(
        logAfterAuthorization,
        "github_file_read_started",
        {
          path,
        }
      );

      await serviceClient
        .from("ai_employee_commands")
        .update({
          execution_log: startLog,
        })
        .eq("id", commandId);

      const file = await readGithubFile(path);

      const readCompletedLog = appendExecutionLog(
        startLog,
        "github_file_read_completed",
        {
          path: file.path,
          size: file.size,
        }
      );

      const analysis = analyzeCode(file.content, file.path);

      const analysisLog = appendExecutionLog(
        readCompletedLog,
        "code_analysis_completed",
        {
          path: file.path,
          lines: analysis.total_lines,
        }
      );

      const { error: completeError } =
        await authenticatedClient.rpc("complete_ai_employee_command", {
          p_command_id: commandId,
          p_result:
            `تم تحليل الملف ${file.path} بنجاح. ` +
            `عدد الأسطر: ${analysis.total_lines}.`,
          p_output_data: analysis,
        });

      if (completeError) {
        throw new Error(
          completeError.message || "تعذر إكمال تحليل الكود."
        );
      }

      await serviceClient
        .from("ai_employee_commands")
        .update({
          execution_log: appendExecutionLog(
            analysisLog,
            "execution_completed"
          ),
        })
        .eq("id", commandId);

      return json({
        success: true,
        command_id: commandId,
        command_type: commandType,
        result:
          `تم تحليل الملف ${file.path} بنجاح. ` +
          `عدد الأسطر: ${analysis.total_lines}.`,
        output_data: analysis,
      });
    }

    if (commandType === "suggest_changes") {
      const startLog = appendExecutionLog(
        logAfterAuthorization,
        "github_file_read_started",
        {
          path,
        }
      );

      await serviceClient
        .from("ai_employee_commands")
        .update({
          execution_log: startLog,
        })
        .eq("id", commandId);

      const file = await readGithubFile(path);

      const readCompletedLog = appendExecutionLog(
        startLog,
        "github_file_read_completed",
        {
          path: file.path,
          size: file.size,
        }
      );

      const suggestions = suggestChanges(file.content, file.path);

      const suggestionsLog = appendExecutionLog(
        readCompletedLog,
        "code_suggestions_completed",
        {
          path: file.path,
          suggestions_count: suggestions.suggestions.length,
          files_modified: false,
        }
      );

      const { error: completeError } =
        await authenticatedClient.rpc("complete_ai_employee_command", {
          p_command_id: commandId,
          p_result:
            `تم تحليل ${file.path} وإعداد ` +
            `${suggestions.suggestions.length} اقتراحات تحسين بدون تعديل الملف.`,
          p_output_data: suggestions,
        });

      if (completeError) {
        throw new Error(
          completeError.message || "تعذر إكمال اقتراح التعديلات."
        );
      }

      await serviceClient
        .from("ai_employee_commands")
        .update({
          execution_log: appendExecutionLog(
            suggestionsLog,
            "execution_completed"
          ),
        })
        .eq("id", commandId);

      return json({
        success: true,
        command_id: commandId,
        command_type: commandType,
        result:
          `تم تحليل ${file.path} وإعداد ` +
          `${suggestions.suggestions.length} اقتراحات تحسين بدون تعديل الملف.`,
        output_data: suggestions,
      });
    }

    throw new Error(`نوع الأمر ${commandType} غير مدعوم.`);
  } catch (error) {
    const message =
      error?.message || "حدث خطأ غير معروف أثناء تنفيذ الأمر.";

    if (commandId && authenticatedClient) {
      try {
        await authenticatedClient.rpc("fail_ai_employee_command", {
          p_command_id: commandId,
          p_error_message: message,
        });
      } catch {
        // fallback below
      }
    }

    if (commandId && serviceClient) {
      try {
        const { data: currentCommand } = await serviceClient
          .from("ai_employee_commands")
          .select("execution_log")
          .eq("id", commandId)
          .single();

        await serviceClient
          .from("ai_employee_commands")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
            execution_log: appendExecutionLog(
              currentCommand?.execution_log,
              "execution_failed",
              {
                error: message,
              }
            ),
          })
          .eq("id", commandId);
      } catch {
        // ignore fallback failure
      }
    }

    return json(
      {
        success: false,
        command_id: commandId,
        error: message,
      },
      500
    );
  }
}
