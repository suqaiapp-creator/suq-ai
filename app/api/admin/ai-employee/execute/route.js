import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER =
  process.env.GITHUB_OWNER || "suqaiapp-creator";
const GITHUB_REPO =
  process.env.GITHUB_REPO || "suq-ai";
const GITHUB_BRANCH =
  process.env.GITHUB_BRANCH || "main";

const MAX_FILE_SIZE = 500_000;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizePath(inputPath) {
  if (!inputPath) return "";

  let value = String(inputPath)
    .trim()
    .replaceAll("\\", "/");

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
    throw new Error(
      "GITHUB_TOKEN غير موجود في إعدادات Vercel."
    );
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
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

async function githubPut(url, body) {
  const response = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `GitHub write failed with status ${response.status}`
    );
  }

  return data;
}

function githubContentsUrl(path) {
  const safePath = normalizePath(path);

  if (!safePath) {
    throw new Error("يجب تحديد مسار الملف.");
  }

  const encodedPath = safePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return (
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}` +
    `/contents/${encodedPath}`
  );
}

async function readGithubFile(path) {
  const safePath = normalizePath(path);

  if (!safePath) {
    throw new Error("يجب تحديد مسار الملف.");
  }

  const url =
    `${githubContentsUrl(safePath)}` +
    `?ref=${encodeURIComponent(GITHUB_BRANCH)}`;

  const data = await githubGet(url);

  if (Array.isArray(data)) {
    throw new Error(
      "المسار يشير إلى مجلد وليس ملفًا."
    );
  }

  if (!data?.content) {
    throw new Error(
      "لم يتم العثور على محتوى الملف."
    );
  }

  const buffer = Buffer.from(
    data.content.replace(/\s/g, ""),
    "base64"
  );

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      "حجم الملف أكبر من الحد المسموح للتحليل."
    );
  }

  return {
    path: safePath,
    sha: data.sha || null,
    size: buffer.length,
    content: buffer.toString("utf8"),
  };
}

async function writeGithubFile({
  path,
  content,
  sha,
  message,
}) {
  const safePath = normalizePath(path);

  if (!safePath) {
    throw new Error("يجب تحديد مسار الملف.");
  }

  if (typeof content !== "string") {
    throw new Error(
      "محتوى الملف الجديد غير صالح."
    );
  }

  const contentSize = Buffer.byteLength(
    content,
    "utf8"
  );

  if (contentSize > MAX_FILE_SIZE) {
    throw new Error(
      "المحتوى الجديد أكبر من الحد المسموح."
    );
  }

  if (!sha) {
    throw new Error(
      "SHA الحالي للملف غير موجود. تم إيقاف الكتابة لحماية الملف."
    );
  }

  const encodedContent =
    Buffer.from(
      content,
      "utf8"
    ).toString("base64");

  const data = await githubPut(
    githubContentsUrl(safePath),
    {
      message:
        message ||
        `chore(ai-employee): update ${safePath}`,
      content: encodedContent,
      sha,
      branch: GITHUB_BRANCH,
    }
  );

  return {
    path: safePath,
    commit_sha:
      data?.commit?.sha || null,
    commit_message:
      data?.commit?.message || message || null,
    content_sha:
      data?.content?.sha || null,
    github_response: {
      committed: Boolean(
        data?.commit?.sha
      ),
    },
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
      /\bconst\s+[A-Za-z0-9_$]+\s*=\s*(async\s*)?\(/.test(
        trimmed
      ) ||
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

  if (
    /console\.(log|warn|error)\s*\(/.test(content)
  ) {
    issues.push({
      type: "console",
      level: "low",
      message:
        "يوجد استخدام لـ console.* داخل الملف؛ يفضّل تنظيف سجلات الإنتاج.",
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

  const envMatches =
    content.match(/process\.env\.([A-Z0-9_]+)/g) || [];

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

  if (
    analysis.issues.some(
      (issue) => issue.type === "console"
    )
  ) {
    suggestions.push({
      priority: "low",
      category: "cleanup",
      title: "تنظيف console logs",
      description:
        "يفضّل إزالة أو تنظيم سجلات console قبل الإنتاج، أو استخدام نظام logging مركزي عند الحاجة.",
    });
  }

  if (
    analysis.issues.some(
      (issue) => issue.type === "security"
    )
  ) {
    suggestions.push({
      priority: "high",
      category: "security",
      title: "مراجعة المحتوى HTML",
      description:
        "يجب مراجعة مصدر المحتوى المستخدم مع dangerouslySetInnerHTML والتأكد من تعقيمه قبل العرض.",
    });
  }

  if (
    analysis.issues.some(
      (issue) => issue.type === "environment"
    )
  ) {
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
    summary:
      `تمت مراجعة الملف ${path} واقتراح تحسينات بدون تعديل الملف.`,
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

function buildEditPreview(
  currentContent,
  newContent,
  path
) {
  const currentLines =
    currentContent.split(/\r?\n/);

  const newLines =
    newContent.split(/\r?\n/);

  let firstDifference = -1;

  const maxLength = Math.max(
    currentLines.length,
    newLines.length
  );

  for (
    let index = 0;
    index < maxLength;
    index += 1
  ) {
    if (
      currentLines[index] !== newLines[index]
    ) {
      firstDifference = index;
      break;
    }
  }

  const changed =
    currentContent !== newContent;

  return {
    path,
    changed,
    current_size_bytes:
      Buffer.byteLength(
        currentContent,
        "utf8"
      ),
    proposed_size_bytes:
      Buffer.byteLength(
        newContent,
        "utf8"
      ),
    current_lines:
      currentLines.length,
    proposed_lines:
      newLines.length,
    first_difference_line:
      firstDifference === -1
        ? null
        : firstDifference + 1,
    preview: {
      old_content: currentContent,
      new_content: newContent,
    },
    safety: {
      files_modified: false,
      files_created: false,
      github_write_used: false,
      dry_run: true,
      openai_used: false,
      runway_used: false,
      points_charged: 0,
      estimated_cost_usd: 0,
    },
  };
}

/*
 * ---------------------------------------------------------
 * BUILD PREFLIGHT
 * ---------------------------------------------------------
 */

function analyzePackageJson(content) {
  let packageJson;

  try {
    packageJson = JSON.parse(content);
  } catch {
    throw new Error(
      "ملف package.json غير صالح JSON."
    );
  }

  const scripts =
    packageJson?.scripts &&
    typeof packageJson.scripts === "object"
      ? packageJson.scripts
      : {};

  const dependencies =
    packageJson?.dependencies &&
    typeof packageJson.dependencies === "object"
      ? packageJson.dependencies
      : {};

  const devDependencies =
    packageJson?.devDependencies &&
    typeof packageJson.devDependencies === "object"
      ? packageJson.devDependencies
      : {};

  return {
    name: packageJson.name || null,
    version: packageJson.version || null,
    private: packageJson.private === true,
    package_manager:
      packageJson.packageManager || null,
    build_script:
      typeof scripts.build === "string"
        ? scripts.build
        : null,
    dev_script:
      typeof scripts.dev === "string"
        ? scripts.dev
        : null,
    start_script:
      typeof scripts.start === "string"
        ? scripts.start
        : null,
    scripts: Object.keys(scripts),
    dependency_count:
      Object.keys(dependencies).length,
    dev_dependency_count:
      Object.keys(devDependencies).length,
    has_next_dependency:
      Boolean(dependencies.next),
    has_react_dependency:
      Boolean(dependencies.react),
    has_react_dom_dependency:
      Boolean(dependencies["react-dom"]),
  };
}

async function runBuildPreflight() {
  const packageFile =
    await readGithubFile("package.json");

  const packageInfo =
    analyzePackageJson(
      packageFile.content
    );

  const checks = [];

  checks.push({
    name: "package.json",
    passed: true,
    message:
      "تم العثور على package.json وقراءته بنجاح.",
  });

  checks.push({
    name: "build script",
    passed: Boolean(packageInfo.build_script),
    message: packageInfo.build_script
      ? `Build script موجود: ${packageInfo.build_script}`
      : "لا يوجد script باسم build داخل package.json.",
  });

  checks.push({
    name: "Next.js",
    passed: packageInfo.has_next_dependency,
    message: packageInfo.has_next_dependency
      ? "اعتماد Next.js موجود."
      : "اعتماد Next.js غير موجود في dependencies.",
  });

  checks.push({
    name: "React",
    passed: packageInfo.has_react_dependency,
    message: packageInfo.has_react_dependency
      ? "اعتماد React موجود."
      : "اعتماد React غير موجود في dependencies.",
  });

  checks.push({
    name: "React DOM",
    passed: packageInfo.has_react_dom_dependency,
    message: packageInfo.has_react_dom_dependency
      ? "اعتماد react-dom موجود."
      : "اعتماد react-dom غير موجود في dependencies.",
  });

  const failedChecks =
    checks.filter(
      (check) => !check.passed
    );

  return {
    build_mode: "preflight",
    build_executed: false,
    build_environment:
      "Vercel Serverless API",
    branch: GITHUB_BRANCH,
    repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    package: packageInfo,
    checks,
    passed:
      failedChecks.length === 0,
    failed_checks:
      failedChecks.length,
    safety: {
      files_modified: false,
      files_created: false,
      github_write_used: false,
      deployment_triggered: false,
      openai_used: false,
      runway_used: false,
      points_charged: 0,
      estimated_cost_usd: 0,
    },
    note:
      "تم إجراء فحص Build Preflight آمن من GitHub. لم يتم تشغيل npm build داخل Vercel Serverless ولم يتم النشر.",
  };
}

function appendExecutionLog(
  existing,
  event,
  data = {}
) {
  const current =
    Array.isArray(existing)
      ? existing
      : [];

  return [
    ...current,
    {
      actor: "ai_employee",
      event,
      timestamp:
        new Date().toISOString(),
      ...data,
    },
  ];
}

async function getAuthenticatedClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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

async function safeLog(
  serviceClient,
  commandId,
  event,
  data = {}
) {
  if (!commandId) return;

  try {
    const {
      data: currentCommand,
      error,
    } = await serviceClient
      .from("ai_employee_commands")
      .select("execution_log")
      .eq("id", commandId)
      .single();

    if (error) {
      return;
    }

    const nextLog =
      appendExecutionLog(
        currentCommand?.execution_log,
        event,
        data
      );

    await serviceClient
      .from("ai_employee_commands")
      .update({
        execution_log: nextLog,
      })
      .eq("id", commandId);
  } catch {
    // لا نسمح بفشل السجل أن يوقف التنفيذ.
  }
}

async function markFailed(
  serviceClient,
  authenticatedClient,
  commandId,
  message
) {
  if (!commandId) return;

  try {
    if (authenticatedClient) {
      await authenticatedClient.rpc(
        "fail_ai_employee_command",
        {
          p_command_id: commandId,
          p_error_message: message,
        }
      );
    }
  } catch {
    // fallback أدناه
  }

  try {
    const {
      data: currentCommand,
    } = await serviceClient
      .from("ai_employee_commands")
      .select("execution_log")
      .eq("id", commandId)
      .single();

    await serviceClient
      .from("ai_employee_commands")
      .update({
        status: "failed",
        error_message: message,
        completed_at:
          new Date().toISOString(),
        execution_log:
          appendExecutionLog(
            currentCommand?.execution_log,
            "execution_failed",
            {
              error: message,
            }
          ),
      })
      .eq("id", commandId);
  } catch {
    // لا شيء إضافي.
  }
}

export async function POST(request) {
  let commandId = null;
  let serviceClient = null;
  let authenticatedClient = null;

  try {
    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(
        {
          success: false,
          error:
            "إعدادات Supabase غير مكتملة.",
        },
        500
      );
    }

    serviceClient =
      createSupabaseClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    authenticatedClient =
      await getAuthenticatedClient();

    const {
      data: { user },
      error: userError,
    } =
      await authenticatedClient.auth.getUser();

    if (userError || !user) {
      return json(
        {
          success: false,
          error:
            "غير مصرح. يجب تسجيل الدخول.",
        },
        401
      );
    }

    const {
      data: profile,
      error: profileError,
    } =
      await serviceClient
        .from("profiles")
        .select(
          "id,is_super_admin,account_status"
        )
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.is_super_admin !== true ||
      profile.account_status ===
        "suspended"
    ) {
      return json(
        {
          success: false,
          error:
            "هذه العملية متاحة للـ Super Admin فقط.",
        },
        403
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    commandId =
      body?.command_id ||
      body?.commandId ||
      null;

    if (!commandId) {
      return json(
        {
          success: false,
          error:
            "command_id مطلوب.",
        },
        400
      );
    }

    await safeLog(
      serviceClient,
      commandId,
      "execution_route_started"
    );

    const {
      data: command,
      error: commandError,
    } =
      await serviceClient
        .from("ai_employee_commands")
        .select("*")
        .eq("id", commandId)
        .single();

    if (
      commandError ||
      !command
    ) {
      throw new Error(
        "لم يتم العثور على الأمر."
      );
    }

    if (command.status !== "running") {
      throw new Error(
        `حالة الأمر الحالية هي ${command.status} وليست running.`
      );
    }

    await safeLog(
      serviceClient,
      commandId,
      "command_loaded",
      {
        status: command.status,
        command_type:
          command.command_type,
      }
    );

    const commandType =
      command.command_type;

    const capabilityMap = {
      read_project_files:
        "read_project_files",
      analyze_code:
        "analyze_code",
      suggest_changes:
        "suggest_changes",
      edit_files:
        "edit_files",
      run_build:
        "run_build",
    };

    const requiredCapability =
      capabilityMap[commandType];

    if (!requiredCapability) {
      throw new Error(
        `نوع الأمر ${commandType} غير مدعوم حاليًا في محرك التنفيذ.`
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
        requiredCapability
      )
    ) {
      throw new Error(
        `الصلاحية المطلوبة ${requiredCapability} غير موجودة ضمن الأمر.`
      );
    }

    await safeLog(
      serviceClient,
      commandId,
      "capability_verified",
      {
        capability:
          requiredCapability,
      }
    );

    const {
      data: employee,
      error: employeeError,
    } =
      await serviceClient
        .from("ai_employees")
        .select(
          "id,name,status"
        )
        .eq(
          "id",
          command.ai_employee_id
        )
        .single();

    if (
      employeeError ||
      !employee
    ) {
      throw new Error(
        "لم يتم العثور على موظف AI المرتبط بالأمر."
      );
    }

    if (
      employee.status !== "active"
    ) {
      throw new Error(
        "موظف AI غير نشط."
      );
    }

    await safeLog(
      serviceClient,
      commandId,
      "employee_verified",
      {
        ai_employee_id:
          employee.id,
        ai_employee_name:
          employee.name,
      }
    );

    const inputData =
      command.input_data &&
      typeof command.input_data ===
        "object"
        ? command.input_data
        : {};

    /*
     * ---------------------------------------------------------
     * RUN BUILD
     * ---------------------------------------------------------
     */

    if (
      commandType ===
      "run_build"
    ) {
      await safeLog(
        serviceClient,
        commandId,
        "build_preflight_started",
        {
          repository:
            `${GITHUB_OWNER}/${GITHUB_REPO}`,
          branch:
            GITHUB_BRANCH,
        }
      );

      const buildResult =
        await runBuildPreflight();

      await safeLog(
        serviceClient,
        commandId,
        "build_preflight_completed",
        {
          passed:
            buildResult.passed,
          failed_checks:
            buildResult.failed_checks,
          build_executed:
            false,
        }
      );

      const resultMessage =
        buildResult.passed
          ? "تم فحص جاهزية Build بنجاح بدون تشغيل Build فعلي أو تعديل المشروع."
          : "اكتمل فحص Build وظهرت ملاحظات تحتاج معالجة قبل اعتبار المشروع جاهزًا.";

      const {
        error: completeError,
      } =
        await authenticatedClient.rpc(
          "complete_ai_employee_command",
          {
            p_command_id:
              commandId,
            p_result:
              resultMessage,
            p_output_data:
              buildResult,
          }
        );

      if (completeError) {
        throw new Error(
          completeError.message ||
            "تعذر إكمال فحص Build."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        "execution_completed",
        {
          build_executed:
            false,
          preflight: true,
        }
      );

      return json({
        success: true,
        command_id:
          commandId,
        command_type:
          commandType,
        result:
          resultMessage,
        output_data:
          buildResult,
      });
    }

    /*
     * ---------------------------------------------------------
     * INPUT PATH
     * ---------------------------------------------------------
     */

    const path =
      normalizePath(
        inputData.path || ""
      );

    if (!path) {
      throw new Error(
        "يجب تحديد input_data.path للملف المطلوب."
      );
    }

    await safeLog(
      serviceClient,
      commandId,
      "input_verified",
      {
        path,
      }
    );

    /*
     * ---------------------------------------------------------
     * READ PROJECT FILES
     * ---------------------------------------------------------
     */

    if (
      commandType ===
      "read_project_files"
    ) {
      await safeLog(
        serviceClient,
        commandId,
        "github_file_read_started",
        { path }
      );

      const file =
        await readGithubFile(path);

      await safeLog(
        serviceClient,
        commandId,
        "github_file_read_completed",
        {
          path: file.path,
          size: file.size,
        }
      );

      const {
        error: completeError,
      } =
        await authenticatedClient.rpc(
          "complete_ai_employee_command",
          {
            p_command_id:
              commandId,
            p_result:
              `تمت قراءة الملف ${file.path} بنجاح.`,
            p_output_data: {
              path: file.path,
              size: file.size,
              sha: file.sha,
              content:
                file.content,
            },
          }
        );

      if (completeError) {
        throw new Error(
          completeError.message ||
            "تعذر إكمال الأمر."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        "execution_completed"
      );

      return json({
        success: true,
        command_id:
          commandId,
        command_type:
          commandType,
        result:
          `تمت قراءة الملف ${file.path} بنجاح.`,
      });
    }

    /*
     * ---------------------------------------------------------
     * ANALYZE CODE
     * ---------------------------------------------------------
     */

    if (
      commandType ===
      "analyze_code"
    ) {
      await safeLog(
        serviceClient,
        commandId,
        "github_file_read_started",
        { path }
      );

      const file =
        await readGithubFile(path);

      await safeLog(
        serviceClient,
        commandId,
        "github_file_read_completed",
        {
          path: file.path,
          size: file.size,
          sha: file.sha,
        }
      );

      const analysis =
        analyzeCode(
          file.content,
          file.path
        );

      await safeLog(
        serviceClient,
        commandId,
        "code_analysis_completed",
        {
          path: file.path,
          lines:
            analysis.total_lines,
        }
      );

      const {
        error: completeError,
      } =
        await authenticatedClient.rpc(
          "complete_ai_employee_command",
          {
            p_command_id:
              commandId,
            p_result:
              `تم تحليل الملف ${file.path} بنجاح. عدد الأسطر: ${analysis.total_lines}.`,
            p_output_data:
              analysis,
          }
        );

      if (completeError) {
        throw new Error(
          completeError.message ||
            "تعذر إكمال تحليل الكود."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        "execution_completed"
      );

      return json({
        success: true,
        command_id:
          commandId,
        command_type:
          commandType,
        result:
          `تم تحليل الملف ${file.path} بنجاح. عدد الأسطر: ${analysis.total_lines}.`,
        output_data:
          analysis,
      });
    }

    /*
     * ---------------------------------------------------------
     * SUGGEST CHANGES
     * ---------------------------------------------------------
     */

    if (
      commandType ===
      "suggest_changes"
    ) {
      await safeLog(
        serviceClient,
        commandId,
        "github_file_read_started",
        { path }
      );

      const file =
        await readGithubFile(path);

      await safeLog(
        serviceClient,
        commandId,
        "github_file_read_completed",
        {
          path: file.path,
          size: file.size,
        }
      );

      const suggestions =
        suggestChanges(
          file.content,
          file.path
        );

      await safeLog(
        serviceClient,
        commandId,
        "code_suggestions_completed",
        {
          path: file.path,
          suggestions_count:
            suggestions.suggestions
              .length,
          files_modified:
            false,
        }
      );

      const {
        error: completeError,
      } =
        await authenticatedClient.rpc(
          "complete_ai_employee_command",
          {
            p_command_id:
              commandId,
            p_result:
              `تم تحليل ${file.path} وإعداد ${suggestions.suggestions.length} اقتراحات تحسين بدون تعديل الملف.`,
            p_output_data:
              suggestions,
          }
        );

      if (completeError) {
        throw new Error(
          completeError.message ||
            "تعذر إكمال اقتراح التعديلات."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        "execution_completed"
      );

      return json({
        success: true,
        command_id:
          commandId,
        command_type:
          commandType,
        result:
          `تم تحليل ${file.path} وإعداد ${suggestions.suggestions.length} اقتراحات تحسين بدون تعديل الملف.`,
        output_data:
          suggestions,
      });
    }

    /*
     * ---------------------------------------------------------
     * EDIT FILES
     * ---------------------------------------------------------
     *
     * dry_run=true  -> معاينة فقط
     * dry_run=false -> كتابة فعلية بعد الموافقة
     */

    if (
      commandType ===
      "edit_files"
    ) {
      const dryRun =
        inputData.dry_run === true;

      const newContent =
        typeof inputData.new_content ===
        "string"
          ? inputData.new_content
          : typeof inputData.content ===
            "string"
            ? inputData.content
            : null;

      if (newContent === null) {
        throw new Error(
          "يجب تحديد input_data.new_content."
        );
      }

      const newContentSize =
        Buffer.byteLength(
          newContent,
          "utf8"
        );

      if (
        newContentSize >
        MAX_FILE_SIZE
      ) {
        throw new Error(
          "المحتوى الجديد أكبر من الحد المسموح."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        dryRun
          ? "github_edit_preview_started"
          : "github_edit_started",
        {
          path,
          dry_run:
            dryRun,
        }
      );

      /*
       * نقرأ النسخة الحالية قبل أي شيء.
       * الـ SHA يستخدم كقفل لمنع الكتابة فوق نسخة
       * تغيّرت بعد إنشاء الأمر.
       */

      const file =
        await readGithubFile(path);

      await safeLog(
        serviceClient,
        commandId,
        "github_file_read_completed",
        {
          path: file.path,
          size: file.size,
          sha: file.sha,
        }
      );

      const preview =
        buildEditPreview(
          file.content,
          newContent,
          file.path
        );

      /*
       * إذا لم يوجد تغيير، لا نكتب شيئًا.
       */

      if (!preview.changed) {
        const resultMessage =
          `تمت مراجعة الملف ${file.path} ولم يتم العثور على أي تغيير.`;

        const {
          error: completeError,
        } =
          await authenticatedClient.rpc(
            "complete_ai_employee_command",
            {
              p_command_id:
                commandId,
              p_result:
                resultMessage,
              p_output_data: {
                ...preview,
                safety: {
                  ...preview.safety,
                  dry_run:
                    dryRun,
                },
              },
            }
          );

        if (completeError) {
          throw new Error(
            completeError.message ||
              "تعذر إكمال عملية التعديل."
          );
        }

        await safeLog(
          serviceClient,
          commandId,
          "execution_completed",
          {
            changed: false,
            dry_run:
              dryRun,
          }
        );

        return json({
          success: true,
          command_id:
            commandId,
          command_type:
            commandType,
          result:
            resultMessage,
          output_data: {
            ...preview,
            safety: {
              ...preview.safety,
              dry_run:
                dryRun,
            },
          },
        });
      }

      /*
       * -------------------------------------------------------
       * DRY RUN
       * -------------------------------------------------------
       */

      if (dryRun) {
        await safeLog(
          serviceClient,
          commandId,
          "edit_dry_run_completed",
          {
            path: file.path,
            changed:
              preview.changed,
            files_modified:
              false,
            github_write_used:
              false,
          }
        );

        const resultMessage =
          `تم اختبار تعديل الملف ${file.path} بنجاح بدون الكتابة على GitHub.`;

        const {
          error: completeError,
        } =
          await authenticatedClient.rpc(
            "complete_ai_employee_command",
            {
              p_command_id:
                commandId,
              p_result:
                resultMessage,
              p_output_data:
                preview,
            }
          );

        if (completeError) {
          throw new Error(
            completeError.message ||
              "تعذر إكمال اختبار تعديل الملف."
          );
        }

        await safeLog(
          serviceClient,
          commandId,
          "execution_completed",
          {
            dry_run: true,
          }
        );

        return json({
          success: true,
          command_id:
            commandId,
          command_type:
            commandType,
          result:
            resultMessage,
          output_data:
            preview,
        });
      }

      /*
       * -------------------------------------------------------
       * REAL EDIT
       * -------------------------------------------------------
       *
       * لا نسمح بالكتابة إلا إذا كانت حالة الموافقة
       * للأمر approved.
       */

      if (
        command.approval_status !==
        "approved"
      ) {
        throw new Error(
          "التعديل الفعلي يتطلب موافقة صريحة على الأمر."
        );
      }

      if (
        command.requires_approval === true &&
        command.approval_status !==
          "approved"
      ) {
        throw new Error(
          "الأمر يحتاج موافقة قبل الكتابة على GitHub."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        "github_write_authorized",
        {
          path: file.path,
          approval_status:
            command.approval_status,
          current_sha:
            file.sha,
        }
      );

      /*
       * نحفظ النسخة القديمة داخل نتيجة العملية.
       * هذا يوفر مادة Rollback لاحقًا.
       */

      const rollbackData = {
        path: file.path,
        branch:
          GITHUB_BRANCH,
        previous_sha:
          file.sha,
        previous_content:
          file.content,
        previous_size:
          file.size,
      };

      await safeLog(
        serviceClient,
        commandId,
        "rollback_snapshot_created",
        {
          path: file.path,
          previous_sha:
            file.sha,
        }
      );

      /*
       * نكتب فقط باستخدام SHA الذي قرأناه قبل العملية.
       * إذا تغيّر الملف في GitHub، GitHub سيرفض الكتابة.
       */

      const commitMessage =
        typeof inputData.commit_message ===
          "string" &&
        inputData.commit_message.trim()
          ? inputData.commit_message.trim()
          : `chore(ai-employee): update ${file.path}`;

      await safeLog(
        serviceClient,
        commandId,
        "github_write_started",
        {
          path: file.path,
          branch:
            GITHUB_BRANCH,
          commit_message:
            commitMessage,
        }
      );

      const writeResult =
        await writeGithubFile({
          path: file.path,
          content: newContent,
          sha: file.sha,
          message:
            commitMessage,
        });

      await safeLog(
        serviceClient,
        commandId,
        "github_write_completed",
        {
          path: file.path,
          commit_sha:
            writeResult.commit_sha,
          content_sha:
            writeResult.content_sha,
        }
      );

      /*
       * تحقق بعد الكتابة.
       */

      await safeLog(
        serviceClient,
        commandId,
        "github_write_verification_started",
        {
          path: file.path,
        }
      );

      const verifiedFile =
        await readGithubFile(path);

      const writeVerified =
        verifiedFile.content ===
        newContent;

      if (!writeVerified) {
        throw new Error(
          "تمت الكتابة لكن فشل التحقق من المحتوى الجديد. تم إيقاف العملية."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        "github_write_verification_completed",
        {
          path: file.path,
          verified: true,
          new_sha:
            verifiedFile.sha,
        }
      );

      const realEditOutput = {
        path: file.path,
        branch:
          GITHUB_BRANCH,
        changed: true,
        dry_run: false,
        previous_sha:
          file.sha,
        new_sha:
          verifiedFile.sha,
        commit_sha:
          writeResult.commit_sha,
        commit_message:
          commitMessage,
        previous_content:
          rollbackData.previous_content,
        new_content:
          newContent,
        rollback: {
          available: true,
          path: rollbackData.path,
          branch:
            rollbackData.branch,
          previous_sha:
            rollbackData.previous_sha,
        },
        safety: {
          files_modified: true,
          files_created: false,
          github_write_used: true,
          github_write_verified: true,
          deployment_triggered:
            false,
          openai_used: false,
          runway_used: false,
          points_charged: 0,
          estimated_cost_usd: 0,
        },
      };

      const resultMessage =
        `تم تعديل الملف ${file.path} ورفع التغيير إلى GitHub والتحقق منه بنجاح.`;

      const {
        error: completeError,
      } =
        await authenticatedClient.rpc(
          "complete_ai_employee_command",
          {
            p_command_id:
              commandId,
            p_result:
              resultMessage,
            p_output_data:
              realEditOutput,
          }
        );

      if (completeError) {
        throw new Error(
          completeError.message ||
            "تم تعديل الملف لكن تعذر تسجيل اكتمال الأمر."
        );
      }

      await safeLog(
        serviceClient,
        commandId,
        "execution_completed",
        {
          dry_run: false,
          files_modified:
            true,
          github_write_used:
            true,
          verified: true,
          commit_sha:
            writeResult.commit_sha,
        }
      );

      return json({
        success: true,
        command_id:
          commandId,
        command_type:
          commandType,
        result:
          resultMessage,
        output_data:
          realEditOutput,
      });
    }

    throw new Error(
      `نوع الأمر ${commandType} غير مدعوم.`
    );
  } catch (error) {
    const message =
      error?.message ||
      "حدث خطأ غير معروف أثناء تنفيذ الأمر.";

    if (commandId) {
      await markFailed(
        serviceClient,
        authenticatedClient,
        commandId,
        message
      );
    }

    return json(
      {
        success: false,
        command_id:
          commandId,
        error: message,
      },
      500
    );
  }
}
