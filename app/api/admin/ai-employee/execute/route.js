import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const GITHUB_API = "https://api.github.com";

const GITHUB_OWNER =
  process.env.GITHUB_REPOSITORY_OWNER || "suqaiapp-creator";

const GITHUB_REPO =
  process.env.GITHUB_REPOSITORY_NAME || "suq-ai";

const GITHUB_BRANCH =
  process.env.GITHUB_REPOSITORY_BRANCH || "main";

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN غير مضبوط في Vercel");
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRequest(path) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method: "GET",
    headers: githubHeaders(),
    cache: "no-store",
  });

  const text = await response.text();

  let data = null;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.message
        ? data.message
        : `GitHub API error: ${response.status}`;

    throw new Error(message);
  }

  return data;
}

function normalizePath(value) {
  if (!value) return "";

  let path = String(value).trim();

  path = path.replace(/^\/+/, "");

  if (path.includes("..")) {
    throw new Error("المسار غير مسموح");
  }

  return path;
}

function isSafeReadablePath(path) {
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

  const normalized = path.toLowerCase();

  return !blocked.some((item) => {
    return (
      normalized === item ||
      normalized.startsWith(`${item}/`)
    );
  });
}

async function getCurrentUser() {
  const cookieStore = await cookies();

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route Handler may not allow setting cookies.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function readFile(path) {
  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return githubRequest(
    `/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(
      GITHUB_REPO
    )}/contents/${encodedPath}?ref=${encodeURIComponent(
      GITHUB_BRANCH
    )}`
  );
}

async function readRepositoryTree() {
  return githubRequest(
    `/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(
      GITHUB_REPO
    )}/git/trees/${encodeURIComponent(
      GITHUB_BRANCH
    )}?recursive=1`
  );
}

function decodeGitHubContent(content) {
  if (!content) return "";

  return Buffer.from(
    content.replace(/\n/g, ""),
    "base64"
  ).toString("utf8");
}

export async function POST(request) {
  let commandId = null;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "يجب تسجيل الدخول أولاً",
        },
        { status: 401 }
      );
    }

    const profileResult = await supabaseAdmin
      .from("profiles")
      .select("id, is_super_admin, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: profileResult.error.message,
        },
        { status: 500 }
      );
    }

    const profile = profileResult.data;

    if (!profile?.is_super_admin) {
      return NextResponse.json(
        {
          success: false,
          error: "غير مصرح. هذه العملية متاحة للـ Super Admin فقط.",
        },
        { status: 403 }
      );
    }

    if (profile.account_status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "حساب Super Admin غير نشط.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    commandId = body?.command_id;

    if (!commandId) {
      return NextResponse.json(
        {
          success: false,
          error: "command_id مطلوب",
        },
        { status: 400 }
      );
    }

    const { data: command, error: commandError } =
      await supabaseAdmin
        .from("ai_employee_commands")
        .select("*")
        .eq("id", commandId)
        .maybeSingle();

    if (commandError) {
      return NextResponse.json(
        {
          success: false,
          error: commandError.message,
        },
        { status: 500 }
      );
    }

    if (!command) {
      return NextResponse.json(
        {
          success: false,
          error: "الأمر غير موجود",
        },
        { status: 404 }
      );
    }

    if (command.command_type !== "read_project_files") {
      return NextResponse.json(
        {
          success: false,
          error:
            "بوابة التنفيذ الحالية تسمح فقط بصلاحية قراءة ملفات المشروع.",
        },
        { status: 400 }
      );
    }

    const requestedCapabilities =
      Array.isArray(command.requested_capabilities)
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
            "الأمر لا يملك صلاحية read_project_files.",
        },
        { status: 403 }
      );
    }

    /*
     * المرحلة الأولى:
     * لا نقرأ أي ملف قبل المرور من authorize_ai_employee_command.
     */
    const { data: authorization, error: authorizationError } =
      await supabaseAdmin.rpc(
        "authorize_ai_employee_command",
        {
          p_command_id: commandId,
        }
      );

    if (authorizationError) {
      return NextResponse.json(
        {
          success: false,
          error: authorizationError.message,
        },
        { status: 500 }
      );
    }

    if (!authorization?.authorized) {
      return NextResponse.json(
        {
          success: false,
          error:
            authorization?.message ||
            "الأمر غير مصرح له.",
          authorization,
        },
        { status: 403 }
      );
    }

    /*
     * لا نسمح بتشغيل الأمر من هذه البوابة
     * إلا إذا كان في حالة running.
     *
     * start_ai_employee_command هو المسؤول
     * عن الانتقال إلى running.
     */
    if (command.status !== "running") {
      return NextResponse.json(
        {
          success: false,
          error:
            "يجب بدء الأمر من بوابة التنفيذ أولاً.",
          status: command.status,
        },
        { status: 409 }
      );
    }

    const inputData =
      command.input_data &&
      typeof command.input_data === "object"
        ? command.input_data
        : {};

    const requestedPath = normalizePath(
      inputData.path || ""
    );

    if (!isSafeReadablePath(requestedPath)) {
      throw new Error(
        "هذا المسار محمي ولا يسمح لـ«والم» بقراءته."
      );
    }

    /*
     * الحالة 1:
     * path فارغ = عرض هيكل المشروع فقط.
     *
     * لا نقرأ محتوى الملفات.
     */
    if (!requestedPath) {
      const tree = await readRepositoryTree();

      const files = Array.isArray(tree?.tree)
        ? tree.tree
            .filter((item) => {
              if (item.type !== "blob") {
                return false;
              }

              return isSafeReadablePath(
                item.path || ""
              );
            })
            .slice(0, 500)
            .map((item) => ({
              path: item.path,
              size: item.size || 0,
              type: item.type,
            }))
        : [];

      const outputData = {
        repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
        branch: GITHUB_BRANCH,
        mode: "tree",
        files,
        total_visible_files: files.length,
      };

      const resultText =
        `تمت قراءة هيكل المشروع بنجاح.\n` +
        `المستودع: ${GITHUB_OWNER}/${GITHUB_REPO}\n` +
        `الفرع: ${GITHUB_BRANCH}\n` +
        `عدد الملفات الظاهرة: ${files.length}`;

      const { data: completed, error: completeError } =
        await supabaseAdmin.rpc(
          "complete_ai_employee_command",
          {
            p_command_id: commandId,
            p_result: resultText,
            p_output_data: outputData,
          }
        );

      if (completeError) {
        throw completeError;
      }

      return NextResponse.json({
        success: true,
        mode: "tree",
        command_id: commandId,
        result: resultText,
        output_data: outputData,
        completion: completed,
      });
    }

    /*
     * الحالة 2:
     * path محدد = قراءة ملف واحد فقط.
     */
    const file = await readFile(requestedPath);

    if (Array.isArray(file)) {
      throw new Error(
        "المسار المطلوب مجلد. في هذه المرحلة نقرأ ملفًا واحدًا فقط."
      );
    }

    if (file.type !== "file") {
      throw new Error(
        "العنصر المطلوب ليس ملفًا قابلًا للقراءة."
      );
    }

    if (!isSafeReadablePath(file.path || requestedPath)) {
      throw new Error(
        "هذا الملف محمي ولا يسمح بقراءته."
      );
    }

    if (
      typeof file.size === "number" &&
      file.size > 500000
    ) {
      throw new Error(
        "الملف أكبر من الحد المسموح به للقراءة في المرحلة الحالية."
      );
    }

    const content = decodeGitHubContent(
      file.content
    );

    const outputData = {
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      branch: GITHUB_BRANCH,
      mode: "file",
      path: file.path || requestedPath,
      size: file.size || content.length,
      sha: file.sha || null,
      content,
    };

    const resultText =
      `تمت قراءة الملف بنجاح: ${
        file.path || requestedPath
      }\n` +
      `الحجم: ${file.size || content.length} بايت`;

    const { data: completed, error: completeError } =
      await supabaseAdmin.rpc(
        "complete_ai_employee_command",
        {
          p_command_id: commandId,
          p_result: resultText,
          p_output_data: outputData,
        }
      );

    if (completeError) {
      throw completeError;
    }

    return NextResponse.json({
      success: true,
      mode: "file",
      command_id: commandId,
      result: resultText,
      output_data: outputData,
      completion: completed,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "حدث خطأ غير معروف";

    /*
     * إذا كان الأمر بدأ فعليًا،
     * نسجل الفشل داخل نظام الأوامر.
     */
    if (commandId) {
      try {
        await supabaseAdmin.rpc(
          "fail_ai_employee_command",
          {
            p_command_id: commandId,
            p_error_message: message,
          }
        );
      } catch {
        // لا نخفي الخطأ الأصلي.
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
        command_id: commandId,
      },
      { status: 500 }
    );
  }
}
