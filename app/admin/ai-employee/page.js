"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const GREEN = "#16a34a";

const capabilityLabels = {
  read_project_files: "قراءة ملفات المشروع",
  analyze_code: "تحليل الكود",
  suggest_changes: "اقتراح تعديلات",
  create_files: "إنشاء ملفات",
  edit_files: "تعديل الملفات",
  run_build: "تشغيل Build",
  run_tests: "تشغيل الاختبارات",
  database_review: "مراجعة قاعدة البيانات",
  database_modify: "تعديل قاعدة البيانات",
  prepare_git_commit: "تجهيز Git Commit",
  deploy_vercel: "النشر إلى Vercel",
  rollback: "Rollback",
};

const riskLabels = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

const commandTypeLabels = {
  read_project_files: "قراءة ملفات المشروع",
  analyze_code: "تحليل الكود",
  suggest_changes: "اقتراح تعديلات",
  edit_files: "تعديل الملفات",
  create_files: "إنشاء ملفات",
  run_build: "تشغيل Build",
  run_tests: "تشغيل الاختبارات",
  database_review: "مراجعة قاعدة البيانات",
  database_modify: "تعديل قاعدة البيانات",
  prepare_git_commit: "تجهيز Git Commit",
  deploy_vercel: "النشر إلى Vercel",
  rollback: "Rollback",
};

const statusLabels = {
  pending: "معلّق",
  running: "قيد التنفيذ",
  completed: "مكتملة",
  failed: "فشلت",
  cancelled: "ملغاة",
};

const executableCommandTypes = [
  "read_project_files",
  "analyze_code",
  "suggest_changes",
  "edit_files",
  "run_build",
];

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("ar-AE", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return value;
  }
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "0ث";

  const total = Math.max(0, Number(seconds) || 0);

  if (total < 60) {
    return `${Math.round(total)}ث`;
  }

  const minutes = Math.floor(total / 60);
  const secs = Math.round(total % 60);

  return `${minutes}د ${secs}ث`;
}

function prettyJson(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getCapabilityRisk(capability) {
  return capability?.risk_level || "low";
}

function getCapabilityApproval(capability) {
  return Boolean(capability?.requires_approval);
}

function statusColor(status) {
  if (status === "completed") return "#15803d";
  if (status === "failed") return "#dc2626";
  if (status === "running") return "#2563eb";
  if (status === "cancelled") return "#6b7280";
  return "#ca8a04";
}

export default function AiEmployeePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [capabilities, setCapabilities] = useState([]);
  const [commands, setCommands] = useState([]);
  const [approvals, setApprovals] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");

  const [selectedCommand, setSelectedCommand] = useState(null);
  const [selectedApproval, setSelectedApproval] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [commandName, setCommandName] = useState("");
  const [commandType, setCommandType] = useState("analyze_code");
  const [commandPath, setCommandPath] = useState("");
  const [newContent, setNewContent] = useState("");
  const [commandNotes, setCommandNotes] = useState("");

  const [executingId, setExecutingId] = useState(null);
  const [executionMessage, setExecutionMessage] = useState("");

  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [detailsLoading, setDetailsLoading] = useState(false);

  const capabilityMap = useMemo(() => {
    const map = {};

    for (const capability of capabilities) {
      map[capability.capability_key] = capability;
    }

    return map;
  }, [capabilities]);

  const commandMap = useMemo(() => {
    const map = {};

    for (const command of commands) {
      map[command.id] = command;
    }

    return map;
  }, [commands]);

  const filteredCommands = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return commands.filter((command) => {
      const matchesSearch =
        !normalized ||
        String(command.command || "")
          .toLowerCase()
          .includes(normalized) ||
        String(command.command_type || "")
          .toLowerCase()
          .includes(normalized) ||
        String(command.id || "")
          .toLowerCase()
          .includes(normalized);

      const matchesStatus =
        statusFilter === "all" ||
        command.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [commands, search, statusFilter]);

  const pendingApprovals = useMemo(() => {
    return approvals.filter(
      (approval) => approval.status === "pending"
    );
  }, [approvals]);

  const stats = useMemo(() => {
    return {
      total: commands.length,
      running: commands.filter(
        (x) => x.status === "running"
      ).length,
      completed: commands.filter(
        (x) => x.status === "completed"
      ).length,
      failed: commands.filter(
        (x) => x.status === "failed"
      ).length,
      pendingApprovals: pendingApprovals.length,
    };
  }, [commands, pendingApprovals]);

  async function loadData(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }

    setActionError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "لم يتم العثور على المستخدم الحالي."
        );
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profileData?.is_super_admin) {
        throw new Error(
          "هذه الصفحة متاحة للـ Super Admin فقط."
        );
      }

      setProfile(profileData);

      const {
        data: employeeData,
        error: employeeError,
      } = await supabase
        .from("ai_employees")
        .select("*")
        .eq("name", "والم")
        .maybeSingle();

      if (employeeError) {
        throw employeeError;
      }

      if (!employeeData) {
        throw new Error(
          "لم يتم العثور على موظف AI باسم والم."
        );
      }

      setEmployee(employeeData);

      const [
        {
          data: capabilityData,
          error: capabilityError,
        },
        {
          data: commandData,
          error: commandError,
        },
        {
          data: approvalData,
          error: approvalError,
        },
      ] = await Promise.all([
        supabase
          .from("ai_employee_capabilities")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("risk_level", {
            ascending: true,
          })
          .order("capability_name", {
            ascending: true,
          }),

        supabase
          .from("ai_employee_commands")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(100),

        supabase
          .from("ai_employee_approvals")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(100),
      ]);

      if (capabilityError) throw capabilityError;
      if (commandError) throw commandError;
      if (approvalError) throw approvalError;

      setCapabilities(capabilityData || []);
      setCommands(commandData || []);
      setApprovals(approvalData || []);

      return {
        employee: employeeData,
        commands: commandData || [],
        approvals: approvalData || [],
      };
    } catch (error) {
      console.error(
        "AI employee load error:",
        error
      );

      setActionError(
        error?.message ||
          "حدث خطأ أثناء تحميل البيانات."
      );

      return null;
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  async function refreshCommandData() {
    if (!employee?.id) return null;

    const [
      {
        data: commandData,
        error: commandError,
      },
      {
        data: approvalData,
        error: approvalError,
      },
    ] = await Promise.all([
      supabase
        .from("ai_employee_commands")
        .select("*")
        .eq("ai_employee_id", employee.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),

      supabase
        .from("ai_employee_approvals")
        .select("*")
        .eq("ai_employee_id", employee.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),
    ]);

    if (commandError) {
      console.error(
        "Command refresh error:",
        commandError
      );
    } else {
      setCommands(commandData || []);
    }

    if (approvalError) {
      console.error(
        "Approval refresh error:",
        approvalError
      );
    } else {
      setApprovals(approvalData || []);
    }

    return {
      commands: commandData || [],
      approvals: approvalData || [],
    };
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleCapability(capability) {
    if (!capability?.id) return;

    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const { error } = await supabase
        .from("ai_employee_capabilities")
        .update({
          enabled: !capability.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", capability.id);

      if (error) throw error;

      setCapabilities((current) =>
        current.map((item) =>
          item.id === capability.id
            ? {
                ...item,
                enabled: !item.enabled,
              }
            : item
        )
      );

      setActionMessage(
        `${capability.capability_name} أصبحت ${
          !capability.enabled
            ? "مفعّلة"
            : "متوقفة"
        }.`
      );
    } catch (error) {
      console.error(
        "Capability update error:",
        error
      );

      setActionError(
        error?.message ||
          "تعذر تحديث الصلاحية."
      );
    } finally {
      setSaving(false);
    }
  }

  function resetCreateForm() {
    setCommandName("");
    setCommandType("analyze_code");
    setCommandPath("");
    setNewContent("");
    setCommandNotes("");
  }

  async function createCommand() {
    if (!employee?.id) return;

    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const capability =
        capabilityMap[commandType];

      if (!capability) {
        throw new Error(
          "نوع الأمر غير موجود ضمن صلاحيات والم."
        );
      }

      if (!capability.enabled) {
        throw new Error(
          "هذه الصلاحية غير مفعلة حاليًا."
        );
      }

      const requiresApproval =
        getCapabilityApproval(capability);

      const riskLevel =
        getCapabilityRisk(capability);

      const inputData = {
        path:
          commandPath.trim() || null,
        notes:
          commandNotes.trim() || null,
      };

      if (
        commandType === "read_project_files" ||
        commandType === "analyze_code" ||
        commandType === "suggest_changes"
      ) {
        if (!commandPath.trim()) {
          throw new Error(
            "يجب تحديد مسار الملف."
          );
        }

        inputData.path =
          commandPath.trim();
      }

      if (commandType === "edit_files") {
        if (!commandPath.trim()) {
          throw new Error(
            "يجب تحديد مسار الملف."
          );
        }

        inputData.path =
          commandPath.trim();

        inputData.dry_run = true;
        inputData.new_content = newContent;
      }

      if (commandType === "run_build") {
        inputData.path = null;
        inputData.mode = "preflight";
        inputData.notes =
          commandNotes.trim() ||
          "فحص جاهزية Build للمشروع بدون تشغيل npm build فعليًا.";
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "انتهت جلسة المستخدم."
        );
      }

      const {
        data: command,
        error: commandError,
      } = await supabase
        .from("ai_employee_commands")
        .insert({
          ai_employee_id: employee.id,
          created_by: user.id,
          command:
            commandName.trim() ||
            commandTypeLabels[
              commandType
            ] ||
            "أمر جديد",
          command_type: commandType,
          status: "pending",
          risk_level: riskLevel,
          requires_approval:
            requiresApproval,
          approval_status:
            requiresApproval
              ? "pending"
              : "approved",
          requested_capabilities: [
            commandType,
          ],
          input_data: inputData,
          output_data: {},
          points_cost: 0,
          estimated_cost: 0,
          actual_cost: 0,
        })
        .select("*")
        .single();

      if (commandError) {
        throw commandError;
      }

      if (requiresApproval) {
        const {
          error: approvalError,
        } = await supabase
          .from("ai_employee_approvals")
          .insert({
            command_id: command.id,
            ai_employee_id: employee.id,
            requested_by: user.id,
            status: "pending",
            decision: null,
            reason: null,
            requested_capabilities: [
              commandType,
            ],
            risk_level: riskLevel,
          });

        if (approvalError) {
          await supabase
            .from("ai_employee_commands")
            .delete()
            .eq("id", command.id);

          throw approvalError;
        }
      }

      resetCreateForm();
      setShowCreateModal(false);

      await refreshCommandData();

      setActionMessage(
        requiresApproval
          ? "تم إنشاء الأمر وإرساله للاعتماد."
          : "تم إنشاء الأمر. يمكنك تشغيله الآن."
      );
    } catch (error) {
      console.error(
        "Create command error:",
        error
      );

      setActionError(
        error?.message ||
          "تعذر إنشاء الأمر."
      );
    } finally {
      setSaving(false);
    }
  }

  async function parseApiResponse(response) {
    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    const rawText =
      await response.text();

    if (!rawText) {
      return {
        ok: response.ok,
        status: response.status,
        data: null,
        rawText: "",
      };
    }

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      try {
        return {
          ok: response.ok,
          status: response.status,
          data: JSON.parse(rawText),
          rawText,
        };
      } catch {
        return {
          ok: response.ok,
          status: response.status,
          data: null,
          rawText,
        };
      }
    }

    try {
      return {
        ok: response.ok,
        status: response.status,
        data: JSON.parse(rawText),
        rawText,
      };
    } catch {
      return {
        ok: response.ok,
        status: response.status,
        data: null,
        rawText,
      };
    }
  }

  async function waitForCommandToFinish(
    commandId,
    maxAttempts = 45
  ) {
    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt += 1
    ) {
      const result =
        await refreshCommandData();

      const command =
        result?.commands?.find(
          (item) =>
            item.id === commandId
        );

      if (!command) {
        await new Promise(
          (resolve) =>
            setTimeout(resolve, 1000)
        );

        continue;
      }

      if (
        command.status === "completed" ||
        command.status === "failed" ||
        command.status === "cancelled"
      ) {
        return command;
      }

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 1000)
      );
    }

    return null;
  }

  async function executeCommand(command) {
    if (!command?.id) {
      setActionError(
        "command_id مطلوب."
      );
      return null;
    }

    if (executingId) {
      setActionError(
        "يوجد أمر آخر قيد التنفيذ من الواجهة."
      );
      return null;
    }

    if (command.status !== "running") {
      setActionError(
        "يجب أن يكون الأمر في حالة «قيد التنفيذ» قبل تشغيل محرك التنفيذ."
      );
      return null;
    }

    if (
      !executableCommandTypes.includes(
        command.command_type
      )
    ) {
      setActionError(
        `نوع الأمر ${command.command_type} غير مدعوم في محرك التنفيذ الحالي.`
      );
      return null;
    }

    setExecutingId(command.id);

    setExecutionMessage(
      command.command_type === "run_build"
        ? "جارٍ فحص جاهزية Build بواسطة والم..."
        : "جارٍ الاتصال بمحرك تنفيذ والم..."
    );

    setActionError("");
    setActionMessage("");

    const controller =
      new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      const response = await fetch(
        "/api/admin/ai-employee/execute",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "follow",
          headers: {
            "Content-Type":
              "application/json",
            "Cache-Control":
              "no-cache",
            Pragma: "no-cache",
          },
          body: JSON.stringify({
            command_id: command.id,
          }),
          signal: controller.signal,
        }
      );

      const parsed =
        await parseApiResponse(
          response
        );

      if (!parsed.ok) {
        const serverMessage =
          parsed.data?.error ||
          parsed.data?.message ||
          parsed.data?.error_message ||
          parsed.rawText ||
          `فشل محرك التنفيذ. HTTP ${parsed.status}`;

        throw new Error(
          serverMessage
        );
      }

      setExecutionMessage(
        command.command_type === "run_build"
          ? "تم الاتصال بمحرك التنفيذ. جارٍ انتظار نتيجة فحص Build..."
          : "تم الاتصال بمحرك التنفيذ. جارٍ انتظار نتيجة والم..."
      );

      const finishedCommand =
        await waitForCommandToFinish(
          command.id
        );

      if (!finishedCommand) {
        setExecutionMessage("");
        setActionError(
          "تم الاتصال بمحرك التنفيذ، لكن الأمر بقي قيد التنفيذ لأكثر من 45 ثانية. لم يتم إيقافه تلقائيًا حفاظًا على سلامة السجل."
        );
        return null;
      }

      if (
        finishedCommand.status ===
        "completed"
      ) {
        setActionMessage(
          command.command_type === "run_build"
            ? "اكتمل فحص جاهزية Build بنجاح."
            : "اكتمل تنفيذ الأمر بنجاح."
        );

        setExecutionMessage("");
      } else if (
        finishedCommand.status ===
        "failed"
      ) {
        setActionError(
          finishedCommand.error_message ||
            "محرك التنفيذ أنهى الأمر بحالة فشل."
        );

        setExecutionMessage("");
      } else {
        setActionMessage(
          `انتهى تنفيذ الأمر بالحالة: ${
            statusLabels[
              finishedCommand.status
            ] ||
            finishedCommand.status
          }`
        );

        setExecutionMessage("");
      }

      setSelectedCommand(
        finishedCommand
      );

      return finishedCommand;
    } catch (error) {
      console.error(
        "Execute command error:",
        error
      );

      if (
        error?.name ===
        "AbortError"
      ) {
        setActionError(
          "انتهت مهلة الاتصال بمحرك التنفيذ بعد 60 ثانية. لم يتم تغيير حالة الأمر من الواجهة."
        );
      } else {
        setActionError(
          error?.message ||
            "تعذر الاتصال بمحرك تنفيذ والم."
        );
      }

      setExecutionMessage("");

      await refreshCommandData();

      return null;
    } finally {
      clearTimeout(timeout);
      setExecutingId(null);
    }
  }

  /*
   * التعديل الأساسي:
   * بعد نجاح start_ai_employee_command
   * يتم جلب الأمر من قاعدة البيانات،
   * ثم تشغيل محرك التنفيذ مباشرة.
   *
   * هذا يمنع بقاء الأمر في running
   * بدون استدعاء /api/admin/ai-employee/execute.
   */
  async function startCommand(command) {
    if (!command?.id) return;

    if (executingId) {
      setActionError(
        "يوجد أمر آخر قيد التنفيذ من الواجهة."
      );
      return;
    }

    setSaving(true);
    setActionError("");
    setActionMessage("");
    setExecutionMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "start_ai_employee_command",
          {
            p_command_id: command.id,
          }
        );

      if (error) {
        throw error;
      }

      if (data?.authorized === false) {
        throw new Error(
          data?.message ||
            "الأمر غير مصرح له بالبدء."
        );
      }

      /*
       * نعيد تحميل الأمر بعد الـ RPC
       * حتى نتأكد أن الحالة أصبحت running.
       */
      const refreshed =
        await refreshCommandData();

      const runningCommand =
        refreshed?.commands?.find(
          (item) =>
            item.id === command.id
        );

      if (!runningCommand) {
        throw new Error(
          "تم بدء الأمر، لكن تعذر قراءة حالته من قاعدة البيانات."
        );
      }

      if (
        runningCommand.status !==
        "running"
      ) {
        throw new Error(
          `تم بدء الأمر لكن حالته الحالية هي: ${
            statusLabels[
              runningCommand.status
            ] ||
            runningCommand.status
          }`
        );
      }

      setActionMessage(
        "تم بدء الأمر. جارٍ الآن تشغيل محرك التنفيذ..."
      );

      /*
       * التشغيل الفعلي للـ API.
       * executeCommand يتحقق من running
       * ثم يستدعي Route.
       */
      await executeCommand(
        runningCommand
      );
    } catch (error) {
      console.error(
        "Start command error:",
        error
      );

      setActionError(
        error?.message ||
          "تعذر بدء وتنفيذ الأمر."
      );

      await refreshCommandData();
    } finally {
      setSaving(false);
    }
  }

  async function reviewApproval(
    approval,
    decision
  ) {
    if (
      !approval?.id ||
      !approval?.command_id
    ) {
      return;
    }

    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const rpcName =
        decision === "approve"
          ? "approve_ai_employee_command"
          : "reject_ai_employee_command";

      /*
       * الإصدار الصحيح من RPC يستخدم:
       * p_command_id
       * p_reason
       */
      const {
        data,
        error,
      } = await supabase.rpc(
        rpcName,
        {
          p_command_id:
            approval.command_id,
          p_reason:
            decision === "approve"
              ? "تم اعتماد الأمر من Super Admin."
              : "تم رفض الأمر من Super Admin.",
        }
      );

      if (error) {
        throw error;
      }

      if (
        data?.approved === false ||
        data?.rejected === false
      ) {
        throw new Error(
          data?.message ||
            "تعذر تحديث حالة الموافقة."
        );
      }

      await refreshCommandData();

      setSelectedApproval(null);

      setActionMessage(
        decision === "approve"
          ? "تم اعتماد الأمر. يمكن الآن بدء التنفيذ."
          : "تم رفض الأمر."
      );
    } catch (error) {
      console.error(
        "Approval error:",
        error
      );

      setActionError(
        error?.message ||
          "تعذر تحديث الموافقة."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openCommandDetails(
    command
  ) {
    setDetailsLoading(true);
    setSelectedCommand(command);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("ai_employee_commands")
        .select("*")
        .eq("id", command.id)
        .single();

      if (!error && data) {
        setSelectedCommand(data);
      }
    } catch (error) {
      console.error(
        "Command details error:",
        error
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  async function toggleEmployeeStatus() {
    if (!employee?.id) return;

    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const nextStatus =
        employee.status === "active"
          ? "stopped"
          : "active";

      const { error } =
        await supabase
          .from("ai_employees")
          .update({
            status: nextStatus,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", employee.id);

      if (error) throw error;

      setEmployee((current) => ({
        ...current,
        status: nextStatus,
      }));

      setActionMessage(
        nextStatus === "active"
          ? "تم تشغيل والم."
          : "تم إيقاف والم."
      );
    } catch (error) {
      console.error(
        "Employee status error:",
        error
      );

      setActionError(
        error?.message ||
          "تعذر تغيير حالة والم."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 24,
          fontFamily:
            "Arial, Tahoma, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 18,
            padding: 30,
            border:
              "1px solid #e5e7eb",
          }}
        >
          جاري تحميل لوحة والم...
        </div>
      </main>
    );
  }

  if (!employee) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 24,
          fontFamily:
            "Arial, Tahoma, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 18,
            padding: 30,
            border:
              "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          {actionError ||
            "تعذر تحميل والم."}
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 20,
        fontFamily:
          "Arial, Tahoma, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 1300,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            background: "#fff",
            border:
              "1px solid #e5e7eb",
            borderRadius: 20,
            padding: 22,
            marginBottom: 16,
            boxShadow:
              "0 4px 18px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 7,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background:
                      employee.status ===
                      "active"
                        ? GREEN
                        : "#9ca3af",
                    display:
                      "inline-block",
                  }}
                />

                <h1
                  style={{
                    margin: 0,
                    fontSize: 28,
                  }}
                >
                  والم
                </h1>
              </div>

              <div
                style={{
                  color: "#6b7280",
                  fontSize: 14,
                }}
              >
                مساعد إدارة وتشغيل سوق AI
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding:
                    "8px 12px",
                  borderRadius: 999,
                  background:
                    employee.status ===
                    "active"
                      ? "#dcfce7"
                      : "#f3f4f6",
                  color:
                    employee.status ===
                    "active"
                      ? "#166534"
                      : "#4b5563",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {employee.status ===
                "active"
                  ? "نشط"
                  : "متوقف"}
              </span>

              <button
                onClick={
                  toggleEmployeeStatus
                }
                disabled={saving}
                style={{
                  border: "none",
                  background:
                    employee.status ===
                    "active"
                      ? "#fee2e2"
                      : "#dcfce7",
                  color:
                    employee.status ===
                    "active"
                      ? "#991b1b"
                      : "#166534",
                  padding:
                    "10px 14px",
                  borderRadius: 10,
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 700,
                }}
              >
                {employee.status ===
                "active"
                  ? "إيقاف والم"
                  : "تشغيل والم"}
              </button>

              <button
                onClick={() =>
                  loadData(false)
                }
                disabled={
                  loading || saving
                }
                style={{
                  border:
                    "1px solid #d1d5db",
                  background: "#fff",
                  color: "#111827",
                  padding:
                    "10px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ↻ تحديث
              </button>
            </div>
          </div>
        </header>

        {actionMessage && (
          <div
            style={{
              background: "#f0fdf4",
              color: "#166534",
              border:
                "1px solid #bbf7d0",
              padding: 14,
              borderRadius: 12,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            {actionMessage}
          </div>
        )}

        {actionError && (
          <div
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              border:
                "1px solid #fecaca",
              padding: 14,
              borderRadius: 12,
              marginBottom: 12,
              fontWeight: 600,
              whiteSpace: "pre-wrap",
            }}
          >
            {actionError}
          </div>
        )}

        {executionMessage && (
          <div
            style={{
              background: "#eff6ff",
              color: "#1d4ed8",
              border:
                "1px solid #bfdbfe",
              padding: 14,
              borderRadius: 12,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            {executionMessage}
          </div>
        )}

        <nav
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {[
            ["overview", "نظرة عامة"],
            ["commands", "الأوامر"],
            ["approvals", "الموافقات"],
            [
              "capabilities",
              "الصلاحيات",
            ],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() =>
                setActiveTab(key)
              }
              style={{
                border:
                  activeTab === key
                    ? `1px solid ${GREEN}`
                    : "1px solid #e5e7eb",
                background:
                  activeTab === key
                    ? "#f0fdf4"
                    : "#fff",
                color:
                  activeTab === key
                    ? "#166534"
                    : "#374151",
                padding:
                  "11px 16px",
                borderRadius: 11,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeTab ===
          "overview" && (
          <section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(170px,1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {[
                [
                  "إجمالي الأوامر",
                  stats.total,
                ],
                [
                  "قيد التنفيذ",
                  stats.running,
                ],
                [
                  "مكتملة",
                  stats.completed,
                ],
                [
                  "فاشلة",
                  stats.failed,
                ],
                [
                  "بانتظار الاعتماد",
                  stats.pendingApprovals,
                ],
              ].map(
                ([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background:
                        "#fff",
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 16,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        color:
                          "#6b7280",
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color:
                          "#111827",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                )
              )}
            </div>

            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 22,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 12,
                }}
              >
                معلومات والم
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 14,
                }}
              >
                <Info
                  label="التخصص"
                  value={
                    employee.specialization ||
                    "مساعد إدارة وتشغيل سوق AI"
                  }
                />

                <Info
                  label="القسم"
                  value={
                    employee.department ||
                    "الإدارة العامة"
                  }
                />

                <Info
                  label="المستوى"
                  value={
                    employee.level ||
                    "lead"
                  }
                />

                <Info
                  label="النبرة"
                  value={
                    employee.tone ||
                    "إماراتية احترافية وودية"
                  }
                />

                <Info
                  label="الوصف"
                  value={
                    employee.description ||
                    "مساعد AI داخلي لسوق AI."
                  }
                />
              </div>

              <div
                style={{
                  marginTop: 22,
                  padding: 16,
                  background:
                    "#f0fdf4",
                  border:
                    "1px solid #bbf7d0",
                  borderRadius: 14,
                  color: "#166534",
                  lineHeight: 1.8,
                }}
              >
                <strong>
                  مبدأ التشغيل الآمن:
                </strong>
                <br />
                والم لا يتجاوز الصلاحيات
                المحددة له. العمليات
                الحساسة مثل تعديل الملفات،
                Git Commit، النشر، وقاعدة
                البيانات تحتاج إلى الموافقة
                المطلوبة حسب مستوى الخطر.
              </div>
            </div>
          </section>
        )}

        {activeTab ===
          "capabilities" && (
          <section>
            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: 20,
                  borderBottom:
                    "1px solid #e5e7eb",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  صلاحيات والم
                </h2>
              </div>

              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse:
                      "collapse",
                    minWidth: 800,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background:
                          "#f9fafb",
                        textAlign:
                          "right",
                      }}
                    >
                      <th
                        style={thStyle}
                      >
                        الصلاحية
                      </th>
                      <th
                        style={thStyle}
                      >
                        الخطر
                      </th>
                      <th
                        style={thStyle}
                      >
                        الموافقة
                      </th>
                      <th
                        style={thStyle}
                      >
                        الحالة
                      </th>
                      <th
                        style={thStyle}
                      >
                        إجراء
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {capabilities.map(
                      (capability) => (
                        <tr
                          key={
                            capability.id
                          }
                        >
                          <td
                            style={
                              tdStyle
                            }
                          >
                            <strong>
                              {capabilityLabels[
                                capability
                                  .capability_key
                              ] ||
                                capability.capability_name}
                            </strong>

                            <div
                              style={{
                                fontSize: 12,
                                color:
                                  "#6b7280",
                                marginTop: 4,
                              }}
                            >
                              {
                                capability.capability_key
                              }
                            </div>
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {riskLabels[
                              capability
                                .risk_level
                            ] ||
                              capability.risk_level}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {capability.requires_approval
                              ? "يحتاج موافقة"
                              : "لا يحتاج"}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            <span
                              style={{
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  999,
                                background:
                                  capability.enabled
                                    ? "#dcfce7"
                                    : "#f3f4f6",
                                color:
                                  capability.enabled
                                    ? "#166534"
                                    : "#6b7280",
                                fontSize: 12,
                                fontWeight:
                                  700,
                              }}
                            >
                              {capability.enabled
                                ? "مفعلة"
                                : "متوقفة"}
                            </span>
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            <button
                              onClick={() =>
                                toggleCapability(
                                  capability
                                )
                              }
                              disabled={
                                saving
                              }
                              style={{
                                border:
                                  "none",
                                background:
                                  capability.enabled
                                    ? "#fee2e2"
                                    : "#dcfce7",
                                color:
                                  capability.enabled
                                    ? "#991b1b"
                                    : "#166534",
                                padding:
                                  "8px 12px",
                                borderRadius:
                                  9,
                                cursor:
                                  "pointer",
                                fontWeight:
                                  700,
                              }}
                            >
                              {capability.enabled
                                ? "إيقاف"
                                : "تفعيل"}
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab ===
          "commands" && (
          <section>
            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 18,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    flex: 1,
                  }}
                >
                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="بحث في الأوامر..."
                    style={
                      inputStyle
                    }
                  />

                  <select
                    value={
                      statusFilter
                    }
                    onChange={(e) =>
                      setStatusFilter(
                        e.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                  >
                    <option value="all">
                      كل الحالات
                    </option>
                    <option value="pending">
                      معلّق
                    </option>
                    <option value="running">
                      قيد التنفيذ
                    </option>
                    <option value="completed">
                      مكتملة
                    </option>
                    <option value="failed">
                      فاشلة
                    </option>
                    <option value="cancelled">
                      ملغاة
                    </option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    resetCreateForm();
                    setShowCreateModal(
                      true
                    );
                  }}
                  style={{
                    border: "none",
                    background: GREEN,
                    color: "#fff",
                    padding:
                      "11px 16px",
                    borderRadius: 10,
                    cursor:
                      "pointer",
                    fontWeight: 800,
                  }}
                >
                  ＋ أمر جديد
                </button>
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse:
                      "collapse",
                    minWidth: 1050,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background:
                          "#f9fafb",
                        textAlign:
                          "right",
                      }}
                    >
                      <th
                        style={thStyle}
                      >
                        الأمر
                      </th>
                      <th
                        style={thStyle}
                      >
                        النوع
                      </th>
                      <th
                        style={thStyle}
                      >
                        الحالة
                      </th>
                      <th
                        style={thStyle}
                      >
                        الخطر
                      </th>
                      <th
                        style={thStyle}
                      >
                        الموافقة
                      </th>
                      <th
                        style={thStyle}
                      >
                        التاريخ
                      </th>
                      <th
                        style={thStyle}
                      >
                        المدة
                      </th>
                      <th
                        style={thStyle}
                      >
                        إجراءات
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCommands.map(
                      (command) => {
                        const canExecute =
                          command.status ===
                            "running" &&
                          executableCommandTypes.includes(
                            command.command_type
                          );

                        const isExecuting =
                          executingId ===
                          command.id;

                        return (
                          <tr
                            key={
                              command.id
                            }
                          >
                            <td
                              style={
                                tdStyle
                              }
                            >
                              <strong>
                                {command.command ||
                                  "أمر بدون اسم"}
                              </strong>

                              <div
                                style={{
                                  fontSize: 11,
                                  color:
                                    "#9ca3af",
                                  marginTop: 5,
                                  fontFamily:
                                    "monospace",
                                }}
                              >
                                {
                                  command.id
                                }
                              </div>
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {commandTypeLabels[
                                command
                                  .command_type
                              ] ||
                                command.command_type}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              <span
                                style={{
                                  color:
                                    statusColor(
                                      command.status
                                    ),
                                  fontWeight:
                                    800,
                                }}
                              >
                                {statusLabels[
                                  command.status
                                ] ||
                                  command.status}
                              </span>
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {riskLabels[
                                command
                                  .risk_level
                              ] ||
                                command.risk_level}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {command.requires_approval
                                ? command.approval_status ===
                                  "approved"
                                  ? "معتمد"
                                  : "بانتظار الاعتماد"
                                : "لا يحتاج"}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {formatDate(
                                command.created_at
                              )}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {formatDuration(
                                command.duration_seconds
                              )}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  gap: 6,
                                  flexWrap:
                                    "wrap",
                                }}
                              >
                                {command.status ===
                                  "pending" && (
                                  <button
                                    onClick={() =>
                                      startCommand(
                                        command
                                      )
                                    }
                                    disabled={
                                      saving ||
                                      Boolean(
                                        executingId
                                      )
                                    }
                                    style={{
                                      ...smallButton,
                                      background:
                                        "#dcfce7",
                                      color:
                                        "#166534",
                                    }}
                                  >
                                    بدء وتنفيذ
                                  </button>
                                )}

                                {canExecute && (
                                  <button
                                    onClick={() =>
                                      executeCommand(
                                        command
                                      )
                                    }
                                    disabled={
                                      Boolean(
                                        executingId
                                      ) ||
                                      isExecuting
                                    }
                                    style={{
                                      ...smallButton,
                                      background:
                                        isExecuting
                                          ? "#dbeafe"
                                          : "#dcfce7",
                                      color:
                                        isExecuting
                                          ? "#1d4ed8"
                                          : "#166534",
                                    }}
                                  >
                                    {isExecuting
                                      ? "جارٍ التنفيذ..."
                                      : command.command_type ===
                                        "analyze_code"
                                      ? "🔎 تحليل الكود"
                                      : command.command_type ===
                                        "edit_files"
                                      ? "✏️ تنفيذ"
                                      : command.command_type ===
                                        "run_build"
                                      ? "🛠️ فحص Build"
                                      : "▶ تنفيذ"}
                                  </button>
                                )}

                                <button
                                  onClick={() =>
                                    openCommandDetails(
                                      command
                                    )
                                  }
                                  style={{
                                    ...smallButton,
                                    background:
                                      "#f3f4f6",
                                    color:
                                      "#374151",
                                  }}
                                >
                                  التفاصيل
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}

                    {!filteredCommands.length && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: 30,
                            textAlign:
                              "center",
                            color:
                              "#6b7280",
                          }}
                        >
                          لا توجد أوامر
                          مطابقة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab ===
          "approvals" && (
          <section>
            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: 20,
                  borderBottom:
                    "1px solid #e5e7eb",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  طلبات الموافقة
                </h2>
              </div>

              {approvals.length ===
              0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign:
                      "center",
                    color:
                      "#6b7280",
                  }}
                >
                  لا توجد طلبات
                  موافقة.
                </div>
              ) : (
                <div>
                  {approvals.map(
                    (approval) => {
                      const command =
                        commandMap[
                          approval.command_id
                        ];

                      return (
                        <div
                          key={
                            approval.id
                          }
                          style={{
                            padding: 18,
                            borderBottom:
                              "1px solid #f3f4f6",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: 12,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <div>
                              <strong>
                                {command?.command ||
                                  "أمر غير معروف"}
                              </strong>

                              <div
                                style={{
                                  marginTop: 6,
                                  color:
                                    "#6b7280",
                                  fontSize: 13,
                                }}
                              >
                                {commandTypeLabels[
                                  command
                                    ?.command_type
                                ] ||
                                  command
                                    ?.command_type ||
                                  "—"}
                                {" • "}
                                {riskLabels[
                                  approval
                                    .risk_level
                                ] ||
                                  approval.risk_level}
                              </div>
                            </div>

                            <span
                              style={{
                                padding:
                                  "7px 10px",
                                borderRadius:
                                  999,
                                background:
                                  approval.status ===
                                  "pending"
                                    ? "#fef3c7"
                                    : approval.status ===
                                      "approved"
                                    ? "#dcfce7"
                                    : "#fee2e2",
                                color:
                                  approval.status ===
                                  "pending"
                                    ? "#92400e"
                                    : approval.status ===
                                      "approved"
                                    ? "#166534"
                                    : "#991b1b",
                                fontWeight:
                                  800,
                                fontSize: 12,
                              }}
                            >
                              {approval.status ===
                              "pending"
                                ? "بانتظار الموافقة"
                                : approval.status ===
                                  "approved"
                                ? "معتمد"
                                : "مرفوض"}
                            </span>
                          </div>

                          {approval.status ===
                            "pending" && (
                            <div
                              style={{
                                display:
                                  "flex",
                                gap: 8,
                                marginTop: 14,
                              }}
                            >
                              <button
                                onClick={() =>
                                  reviewApproval(
                                    approval,
                                    "approve"
                                  )
                                }
                                disabled={
                                  saving
                                }
                                style={{
                                  ...smallButton,
                                  background:
                                    "#dcfce7",
                                  color:
                                    "#166534",
                                }}
                              >
                                اعتماد
                              </button>

                              <button
                                onClick={() =>
                                  reviewApproval(
                                    approval,
                                    "reject"
                                  )
                                }
                                disabled={
                                  saving
                                }
                                style={{
                                  ...smallButton,
                                  background:
                                    "#fee2e2",
                                  color:
                                    "#991b1b",
                                }}
                              >
                                رفض
                              </button>

                              <button
                                onClick={() =>
                                  setSelectedApproval(
                                    approval
                                  )
                                }
                                style={{
                                  ...smallButton,
                                  background:
                                    "#f3f4f6",
                                  color:
                                    "#374151",
                                }}
                              >
                                التفاصيل
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {selectedApproval && (
          <Modal
            title="تفاصيل طلب الموافقة"
            onClose={() =>
              setSelectedApproval(
                null
              )
            }
          >
            <pre style={preStyle}>
              {prettyJson(
                selectedApproval
              )}
            </pre>
          </Modal>
        )}

        {selectedCommand && (
          <Modal
            title="تفاصيل الأمر"
            onClose={() =>
              setSelectedCommand(
                null
              )
            }
            wide
          >
            {detailsLoading ? (
              <div>
                جاري تحميل التفاصيل...
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(180px,1fr))",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <Info
                    label="الحالة"
                    value={
                      statusLabels[
                        selectedCommand.status
                      ] ||
                      selectedCommand.status
                    }
                  />

                  <Info
                    label="نوع الأمر"
                    value={
                      commandTypeLabels[
                        selectedCommand
                          .command_type
                      ] ||
                        selectedCommand.command_type
                    }
                  />

                  <Info
                    label="الخطر"
                    value={
                      riskLabels[
                        selectedCommand
                          .risk_level
                      ] ||
                        selectedCommand.risk_level
                    }
                  />

                  <Info
                    label="المدة"
                    value={formatDuration(
                      selectedCommand.duration_seconds
                    )}
                  />
                </div>

                <h3>
                  Input Data
                </h3>

                <pre style={preStyle}>
                  {prettyJson(
                    selectedCommand.input_data
                  )}
                </pre>

                <h3>
                  Output Data
                </h3>

                <pre style={preStyle}>
                  {prettyJson(
                    selectedCommand.output_data
                  )}
                </pre>

                <h3>Result</h3>

                <pre style={preStyle}>
                  {selectedCommand.result ||
                    "لا توجد نتيجة حتى الآن."}
                </pre>

                <h3>Error</h3>

                <pre
                  style={{
                    ...preStyle,
                    color:
                      selectedCommand.error_message
                        ? "#991b1b"
                        : "#6b7280",
                  }}
                >
                  {selectedCommand.error_message ||
                    "لا يوجد خطأ مسجل."}
                </pre>

                <h3>
                  Execution Log
                </h3>

                <pre style={preStyle}>
                  {prettyJson(
                    selectedCommand.execution_log ||
                      []
                  )}
                </pre>
              </>
            )}
          </Modal>
        )}

        {showCreateModal && (
          <Modal
            title="إنشاء أمر جديد"
            onClose={() =>
              setShowCreateModal(
                false
              )
            }
            wide
          >
            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <label>
                <div style={labelStyle}>
                  اسم الأمر
                </div>

                <input
                  value={commandName}
                  onChange={(e) =>
                    setCommandName(
                      e.target.value
                    )
                  }
                  placeholder="مثال: تحليل ملف والم"
                  style={inputStyle}
                />
              </label>

              <label>
                <div style={labelStyle}>
                  نوع الأمر
                </div>

                <select
                  value={commandType}
                  onChange={(e) =>
                    setCommandType(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  {[
                    ...executableCommandTypes,
                  ].map((type) => {
                    const capability =
                      capabilityMap[
                        type
                      ];

                    return (
                      <option
                        key={type}
                        value={type}
                        disabled={
                          !capability?.enabled
                        }
                      >
                        {commandTypeLabels[
                          type
                        ] || type}
                        {!capability?.enabled
                          ? " — متوقف"
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              {(
                commandType ===
                  "read_project_files" ||
                commandType ===
                  "analyze_code" ||
                commandType ===
                  "suggest_changes" ||
                commandType ===
                  "edit_files"
              ) && (
                <label>
                  <div style={labelStyle}>
                    مسار الملف
                  </div>

                  <input
                    value={commandPath}
                    onChange={(e) =>
                      setCommandPath(
                        e.target.value
                      )
                    }
                    placeholder="مثال: app/admin/ai-employee/page.js"
                    style={inputStyle}
                  />
                </label>
              )}

              {commandType ===
                "run_build" && (
                <div
                  style={{
                    padding: 14,
                    background:
                      "#eff6ff",
                    border:
                      "1px solid #bfdbfe",
                    borderRadius: 12,
                    color: "#1e40af",
                    lineHeight: 1.8,
                  }}
                >
                  <strong>
                    فحص Build آمن
                  </strong>
                  <br />
                  سيتم فحص package.json
                  وإعدادات المشروع والتأكد
                  من وجود Build Script
                  ومتطلبات Next.js وReact.
                  <br />
                  <strong>
                    لا يتم تشغيل npm build
                    فعليًا في هذه المرحلة،
                    ولا يتم تعديل المشروع أو
                    النشر.
                  </strong>
                </div>
              )}

              {commandType ===
                "edit_files" && (
                <label>
                  <div
                    style={labelStyle}
                  >
                    المحتوى الجديد — Dry Run
                  </div>

                  <textarea
                    value={newContent}
                    onChange={(e) =>
                      setNewContent(
                        e.target.value
                      )
                    }
                    rows={10}
                    placeholder="المحتوى الذي سيتم معاينته فقط..."
                    style={{
                      ...inputStyle,
                      resize:
                        "vertical",
                      fontFamily:
                        "monospace",
                    }}
                  />

                  <div
                    style={{
                      marginTop: 6,
                      color:
                        "#92400e",
                      fontSize: 12,
                    }}
                  >
                    تعديل الملفات يعمل
                    حاليًا كـ Dry Run فقط،
                    بدون كتابة فعلية على
                    GitHub.
                  </div>
                </label>
              )}

              <label>
                <div style={labelStyle}>
                  ملاحظات
                </div>

                <textarea
                  value={commandNotes}
                  onChange={(e) =>
                    setCommandNotes(
                      e.target.value
                    )
                  }
                  rows={4}
                  placeholder={
                    commandType ===
                    "run_build"
                      ? "مثال: فحص جاهزية المشروع قبل الانتقال للمرحلة التالية."
                      : "ملاحظات تنفيذ الأمر..."
                  }
                  style={{
                    ...inputStyle,
                    resize:
                      "vertical",
                  }}
                />
              </label>

              <div
                style={{
                  padding: 14,
                  background:
                    "#f9fafb",
                  borderRadius: 12,
                  border:
                    "1px solid #e5e7eb",
                }}
              >
                <strong>
                  مستوى الخطر:
                </strong>{" "}
                {riskLabels[
                  capabilityMap[
                    commandType
                  ]?.risk_level
                ] || "—"}
                <br />

                <strong>
                  الموافقة:
                </strong>{" "}
                {capabilityMap[
                  commandType
                ]?.requires_approval
                  ? "مطلوبة"
                  : "غير مطلوبة"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent:
                    "flex-start",
                  marginTop: 4,
                }}
              >
                <button
                  onClick={
                    createCommand
                  }
                  disabled={saving}
                  style={{
                    border: "none",
                    background: GREEN,
                    color: "#fff",
                    padding:
                      "11px 18px",
                    borderRadius: 10,
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                    fontWeight: 800,
                  }}
                >
                  {saving
                    ? "جاري الإنشاء..."
                    : "إنشاء الأمر"}
                </button>

                <button
                  onClick={() =>
                    setShowCreateModal(
                      false
                    )
                  }
                  style={{
                    border:
                      "1px solid #d1d5db",
                    background: "#fff",
                    color: "#374151",
                    padding:
                      "11px 18px",
                    borderRadius: 10,
                    cursor:
                      "pointer",
                    fontWeight: 700,
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div
      style={{
        padding: 14,
        background: "#f9fafb",
        borderRadius: 12,
        border:
          "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontWeight: 700,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}) {
  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        background:
          "rgba(15,23,42,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent:
          "center",
        padding: 18,
      }}
      onMouseDown={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: wide
            ? 1050
            : 700,
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 18,
          padding: 22,
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 21,
            }}
          >
            {title}
          </h2>

          <button
            onClick={onClose}
            style={{
              border: "none",
              background:
                "#f3f4f6",
              width: 36,
              height: 36,
              borderRadius: 9,
              cursor:
                "pointer",
              fontSize: 20,
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

const thStyle = {
  padding: 13,
  borderBottom:
    "1px solid #e5e7eb",
  fontSize: 13,
  color: "#374151",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: 13,
  borderBottom:
    "1px solid #f3f4f6",
  verticalAlign:
    "top",
  fontSize: 13,
};

const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box",
  border:
    "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 10,
  padding:
    "11px 12px",
  fontSize: 14,
  outline: "none",
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
  marginBottom: 7,
};

const smallButton = {
  border: "none",
  padding:
    "8px 11px",
  borderRadius: 8,
  cursor:
    "pointer",
  fontWeight: 700,
  fontSize: 12,
};

const preStyle = {
  background: "#111827",
  color: "#e5e7eb",
  padding: 14,
  borderRadius: 10,
  overflowX: "auto",
  whiteSpace:
    "pre-wrap",
  wordBreak:
    "break-word",
  fontSize: 12,
  lineHeight: 1.6,
  direction: "ltr",
  textAlign: "left",
};
