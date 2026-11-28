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
};

const statusLabels = {
  pending: "بانتظار التنفيذ",
  running: "قيد التنفيذ",
  completed: "مكتملة",
  failed: "فشلت",
  cancelled: "ملغاة",
};

const supportedCommandTypes = [
  "read_project_files",
  "analyze_code",
  "suggest_changes",
  "edit_files",
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
  if (!seconds && seconds !== 0) return "—";

  const total = Number(seconds);

  if (total < 60) {
    return `${Math.round(total)}ث`;
  }

  const minutes = Math.floor(total / 60);
  const secs = Math.round(total % 60);

  return `${minutes}د ${secs}ث`;
}

function statusColor(status) {
  if (status === "completed") return "#16a34a";
  if (status === "failed") return "#dc2626";
  if (status === "running") return "#2563eb";
  if (status === "cancelled") return "#6b7280";
  return "#d97706";
}

function riskColor(risk) {
  if (risk === "critical") return "#dc2626";
  if (risk === "high") return "#ea580c";
  if (risk === "medium") return "#d97706";
  return "#16a34a";
}

function getExecutionButton(command) {
  if (!command) return null;

  if (command.command_type === "read_project_files") {
    return {
      label: "📂 تنفيذ القراءة",
      loadingLabel: "📂 جارٍ قراءة الملفات...",
    };
  }

  if (command.command_type === "analyze_code") {
    return {
      label: "🔎 تحليل الكود",
      loadingLabel: "🔎 جارٍ تحليل الكود...",
    };
  }

  if (command.command_type === "suggest_changes") {
    return {
      label: "💡 إعداد الاقتراحات",
      loadingLabel: "💡 جارٍ إعداد الاقتراحات...",
    };
  }

  if (command.command_type === "edit_files") {
    return {
      label: "🛡️ تنفيذ التعديل الآمن",
      loadingLabel: "🛡️ جارٍ تجهيز التعديل الآمن...",
    };
  }

  return null;
}

export default function AIEmployeePage() {
  const [loading, setLoading] = useState(true);
  const [savingCommand, setSavingCommand] = useState(false);
  const [executingId, setExecutingId] = useState(null);

  const [activeTab, setActiveTab] = useState("commands");

  const [employee, setEmployee] = useState(null);
  const [capabilities, setCapabilities] = useState([]);
  const [commands, setCommands] = useState([]);
  const [approvals, setApprovals] = useState([]);

  const [currentUserId, setCurrentUserId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [approvalModal, setApprovalModal] = useState(null);
  const [approvalReason, setApprovalReason] = useState("");

  const [createCommandModal, setCreateCommandModal] = useState(false);

  const [newCommand, setNewCommand] = useState({
    command: "",
    command_type: "read_project_files",
    path: "",
    new_content: "",
    notes: "",
    dry_run: true,
  });

  const [expandedCommand, setExpandedCommand] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("لم يتم العثور على المستخدم الحالي.");
      }

      setCurrentUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        throw new Error("هذه الصفحة متاحة للـ Super Admin فقط.");
      }

      const { data: employeeData, error: employeeError } = await supabase
        .from("ai_employees")
        .select("*")
        .eq("name", "والم")
        .maybeSingle();

      if (employeeError) throw employeeError;

      if (!employeeData) {
        throw new Error("لم يتم العثور على موظف AI باسم والم.");
      }

      setEmployee(employeeData);

      const [
        capabilitiesResponse,
        commandsResponse,
        approvalsResponse,
      ] = await Promise.all([
        supabase
          .from("ai_employee_capabilities")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("ai_employee_commands")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("ai_employee_approvals")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", { ascending: false }),
      ]);

      if (capabilitiesResponse.error) {
        throw capabilitiesResponse.error;
      }

      if (commandsResponse.error) {
        throw commandsResponse.error;
      }

      if (approvalsResponse.error) {
        throw approvalsResponse.error;
      }

      setCapabilities(capabilitiesResponse.data || []);
      setCommands(commandsResponse.data || []);
      setApprovals(approvalsResponse.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || "حدث خطأ أثناء تحميل بيانات والم.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const selectedCapability = capabilityMap[newCommand.command_type];

  const pendingApprovals = useMemo(() => {
    return approvals.filter((approval) => approval.status === "pending");
  }, [approvals]);

  const resetCreateForm = () => {
    setNewCommand({
      command: "",
      command_type: "read_project_files",
      path: "",
      new_content: "",
      notes: "",
      dry_run: true,
    });
  };

  const openCreateCommand = () => {
    setMessage("");
    setError("");
    resetCreateForm();
    setCreateCommandModal(true);
  };

  const closeCreateCommand = () => {
    if (savingCommand) return;

    setCreateCommandModal(false);
    resetCreateForm();
  };

  const createCommand = async () => {
    setSavingCommand(true);
    setError("");
    setMessage("");

    try {
      if (!employee) {
        throw new Error("لم يتم تحميل بيانات والم.");
      }

      if (!currentUserId) {
        throw new Error("لم يتم تحديد المستخدم الحالي.");
      }

      const commandName = newCommand.command.trim();

      if (!commandName) {
        throw new Error("اكتب اسم الأمر أولاً.");
      }

      const capability = capabilityMap[newCommand.command_type];

      if (!capability) {
        throw new Error("صلاحية الأمر غير موجودة.");
      }

      if (!capability.enabled) {
        throw new Error("هذه الصلاحية غير مفعّلة لوالم.");
      }

      if (!supportedCommandTypes.includes(newCommand.command_type)) {
        throw new Error("نوع الأمر غير مدعوم للتنفيذ في هذه المرحلة.");
      }

      if (
        newCommand.command_type === "edit_files" &&
        !newCommand.path.trim()
      ) {
        throw new Error("اكتب مسار الملف المراد تعديله.");
      }

      if (
        newCommand.command_type === "edit_files" &&
        !newCommand.new_content
      ) {
        throw new Error("اكتب المحتوى الجديد المطلوب في التعديل الآمن.");
      }

      const requiresApproval =
        Boolean(capability.requires_approval) ||
        capability.risk_level === "critical";

      const inputData = {
        path: newCommand.path.trim() || null,
        notes: newCommand.notes.trim() || null,
      };

      if (newCommand.command_type === "edit_files") {
        inputData.dry_run = true;
        inputData.new_content = newCommand.new_content;
      }

      const { data: insertedCommand, error: commandError } = await supabase
        .from("ai_employee_commands")
        .insert({
          ai_employee_id: employee.id,
          created_by: currentUserId,
          command: commandName,
          command_type: newCommand.command_type,
          status: "pending",
          risk_level: capability.risk_level || "low",
          requires_approval: requiresApproval,
          approval_status: requiresApproval ? "pending" : "approved",
          requested_capabilities: [newCommand.command_type],
          input_data: inputData,
          output_data: {},
          execution_log: [],
          points_cost: 0,
          estimated_cost: 0,
          actual_cost: 0,
        })
        .select("*")
        .single();

      if (commandError) {
        throw commandError;
      }

      if (!insertedCommand) {
        throw new Error("لم يتم إنشاء الأمر.");
      }

      if (requiresApproval) {
        const { error: approvalError } = await supabase
          .from("ai_employee_approvals")
          .insert({
            command_id: insertedCommand.id,
            ai_employee_id: employee.id,
            requested_by: currentUserId,
            status: "pending",
            decision: null,
            reason: null,
            requested_capabilities: [newCommand.command_type],
            risk_level: capability.risk_level || "medium",
          });

        if (approvalError) {
          await supabase
            .from("ai_employee_commands")
            .delete()
            .eq("id", insertedCommand.id);

          throw new Error(
            `تم إلغاء إنشاء الأمر لأن طلب الموافقة لم يُنشأ: ${approvalError.message}`
          );
        }
      }

      setCreateCommandModal(false);
      resetCreateForm();

      setMessage(
        requiresApproval
          ? "🟢 تم إنشاء الأمر وإرسال طلب الموافقة إلى تبويب الموافقات."
          : "🟢 تم إنشاء الأمر وهو جاهز للتنفيذ."
      );

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر إنشاء الأمر.");
    } finally {
      setSavingCommand(false);
    }
  };

  const approveCommand = async () => {
    if (!approvalModal?.command_id) return;

    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "approve_ai_employee_command",
        {
          p_command_id: approvalModal.command_id,
          p_reason: approvalReason.trim() || null,
        }
      );

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(data?.reason || "تعذر اعتماد الأمر.");
      }

      setApprovalModal(null);
      setApprovalReason("");

      setMessage("🟢 تمت الموافقة على الأمر بنجاح.");

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر اعتماد الأمر.");
    }
  };

  const rejectCommand = async () => {
    if (!approvalModal?.command_id) return;

    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "reject_ai_employee_command",
        {
          p_command_id: approvalModal.command_id,
          p_reason: approvalReason.trim() || "تم رفض الأمر من Super Admin.",
        }
      );

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(data?.reason || "تعذر رفض الأمر.");
      }

      setApprovalModal(null);
      setApprovalReason("");

      setMessage("🟢 تم رفض الأمر.");

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر رفض الأمر.");
    }
  };

  const startCommand = async (command) => {
    setError("");
    setMessage("");

    try {
      if (command.status !== "pending") {
        throw new Error("هذا الأمر ليس في حالة تسمح ببدء التنفيذ.");
      }

      if (
        command.requires_approval &&
        command.approval_status !== "approved"
      ) {
        throw new Error("يجب اعتماد الأمر أولاً من تبويب الموافقات.");
      }

      const { data, error: rpcError } = await supabase.rpc(
        "start_ai_employee_command",
        {
          p_command_id: command.id,
        }
      );

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(data?.reason || "تعذر بدء الأمر.");
      }

      setMessage("🟢 تم بدء تنفيذ الأمر.");

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر بدء تنفيذ الأمر.");
    }
  };

  const executeCommand = async (command) => {
    const executionButton = getExecutionButton(command);

    if (!executionButton) {
      setError("هذا النوع من الأوامر غير مدعوم للتنفيذ حالياً.");
      return;
    }

    if (command.status !== "running") {
      setError("يجب أن يكون الأمر في حالة قيد التنفيذ قبل تشغيله.");
      return;
    }

    setExecutingId(command.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/ai-employee/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commandId: command.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ||
            data?.message ||
            "تعذر تنفيذ الأمر."
        );
      }

      if (command.command_type === "analyze_code") {
        setMessage("🟢 تم تحليل كود مشروع سوق AI بنجاح.");
      } else if (command.command_type === "suggest_changes") {
        setMessage(
          "🟢 تم إعداد اقتراحات تحسين كود مشروع سوق AI بدون تعديل الملفات."
        );
      } else if (command.command_type === "edit_files") {
        setMessage(
          "🟢 تم تنفيذ التعديل الآمن بنجاح. لم يتم تعديل أي ملف فعلياً."
        );
      } else {
        setMessage("🟢 تمت قراءة هيكل مشروع سوق AI بنجاح.");
      }

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر تنفيذ الأمر.");
      await loadData();
    } finally {
      setExecutingId(null);
    }
  };

  if (loading) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 24,
          background: "#f8fafc",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            border: "1px solid #e5e7eb",
          }}
        >
          جارٍ تحميل والم...
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
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
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "#dcfce7",
                    color: GREEN,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 800,
                  }}
                >
                  و
                </div>

                <div>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 25,
                      color: "#111827",
                    }}
                  >
                    والم
                  </h1>

                  <div
                    style={{
                      color: "#6b7280",
                      marginTop: 3,
                      fontSize: 14,
                    }}
                  >
                    مساعد إدارة وتشغيل سوق AI
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: "#dcfce7",
                color: "#166534",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: GREEN,
                }}
              />
              نشط
            </div>
          </div>
        </div>

        {message && (
          <div
            style={{
              background: "#ecfdf5",
              color: "#166534",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              padding: 13,
              marginBottom: 14,
              fontWeight: 600,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 13,
              marginBottom: 14,
              fontWeight: 600,
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {[
            ["commands", "الأوامر"],
            ["approvals", `الموافقات (${pendingApprovals.length})`],
            ["capabilities", "الصلاحيات"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                border: "1px solid #d1d5db",
                background: activeTab === key ? GREEN : "#fff",
                color: activeTab === key ? "#fff" : "#374151",
                borderRadius: 10,
                padding: "10px 15px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "commands" && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 18,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                  }}
                >
                  أوامر والم
                </h2>

                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 13,
                    marginTop: 5,
                  }}
                >
                  جميع أوامر والم وسجل تنفيذها.
                </div>
              </div>

              <button
                onClick={openCreateCommand}
                style={{
                  border: "none",
                  background: GREEN,
                  color: "#fff",
                  borderRadius: 10,
                  padding: "11px 16px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                ＋ أمر جديد
              </button>
            </div>

            {commands.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "#6b7280",
                }}
              >
                لا توجد أوامر حتى الآن.
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 900,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f9fafb",
                      }}
                    >
                      {[
                        "الأمر",
                        "النوع",
                        "الحالة",
                        "الخطورة",
                        "الموافقة",
                        "التاريخ",
                        "المدة",
                        "الإجراء",
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: 13,
                            textAlign: "right",
                            fontSize: 13,
                            color: "#6b7280",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {commands.map((command) => {
                      const executionButton = getExecutionButton(command);
                      const expanded = expandedCommand === command.id;

                      return (
                        <tr key={command.id}>
                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                color: "#111827",
                              }}
                            >
                              {command.command || "بدون اسم"}
                            </div>

                            <div
                              style={{
                                color: "#9ca3af",
                                fontSize: 11,
                                marginTop: 4,
                              }}
                            >
                              {command.id}
                            </div>

                            {expanded && (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 10,
                                  background: "#f8fafc",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  direction: "ltr",
                                  textAlign: "left",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {JSON.stringify(
                                  {
                                    input_data: command.input_data,
                                    output_data: command.output_data,
                                    result: command.result,
                                    error_message: command.error_message,
                                    execution_log: command.execution_log,
                                  },
                                  null,
                                  2
                                )}
                              </div>
                            )}
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                            }}
                          >
                            {commandTypeLabels[command.command_type] ||
                              command.command_type}
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                            }}
                          >
                            <span
                              style={{
                                color: statusColor(command.status),
                                fontWeight: 800,
                              }}
                            >
                              {statusLabels[command.status] ||
                                command.status}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                            }}
                          >
                            <span
                              style={{
                                color: riskColor(command.risk_level),
                                fontWeight: 800,
                              }}
                            >
                              {riskLabels[command.risk_level] ||
                                command.risk_level}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                            }}
                          >
                            {command.requires_approval ? (
                              <span
                                style={{
                                  color:
                                    command.approval_status === "approved"
                                      ? GREEN
                                      : "#d97706",
                                  fontWeight: 800,
                                }}
                              >
                                {command.approval_status === "approved"
                                  ? "تمت الموافقة"
                                  : "بانتظار الموافقة"}
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: GREEN,
                                  fontWeight: 800,
                                }}
                              >
                                لا يحتاج
                              </span>
                            )}
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDate(command.created_at)}
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDuration(command.duration_seconds)}
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              verticalAlign: "top",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              {command.status === "pending" &&
                                (!command.requires_approval ||
                                  command.approval_status === "approved") && (
                                  <button
                                    onClick={() => startCommand(command)}
                                    style={{
                                      border: "1px solid #bbf7d0",
                                      background: "#f0fdf4",
                                      color: "#166534",
                                      borderRadius: 8,
                                      padding: "7px 10px",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                    }}
                                  >
                                    ▶ بدء
                                  </button>
                                )}

                              {command.status === "pending" &&
                                command.requires_approval &&
                                command.approval_status !== "approved" && (
                                  <span
                                    style={{
                                      color: "#d97706",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      padding: "7px 4px",
                                    }}
                                  >
                                    بانتظار الموافقة
                                  </span>
                                )}

                              {command.status === "running" &&
                                executionButton && (
                                  <button
                                    onClick={() => executeCommand(command)}
                                    disabled={executingId === command.id}
                                    style={{
                                      border: "none",
                                      background: GREEN,
                                      color: "#fff",
                                      borderRadius: 8,
                                      padding: "7px 10px",
                                      cursor:
                                        executingId === command.id
                                          ? "not-allowed"
                                          : "pointer",
                                      fontWeight: 700,
                                      opacity:
                                        executingId === command.id ? 0.65 : 1,
                                    }}
                                  >
                                    {executingId === command.id
                                      ? executionButton.loadingLabel
                                      : executionButton.label}
                                  </button>
                                )}

                              <button
                                onClick={() =>
                                  setExpandedCommand(
                                    expanded ? null : command.id
                                  )
                                }
                                style={{
                                  border: "1px solid #d1d5db",
                                  background: "#fff",
                                  color: "#374151",
                                  borderRadius: 8,
                                  padding: "7px 10px",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                {expanded ? "إخفاء" : "التفاصيل"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "approvals" && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 18,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                }}
              >
                موافقات أوامر والم
              </h2>
            </div>

            {approvals.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "#6b7280",
                }}
              >
                لا توجد طلبات موافقة.
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 850,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f9fafb",
                      }}
                    >
                      {[
                        "الأمر",
                        "الصلاحية",
                        "الخطورة",
                        "الحالة",
                        "التاريخ",
                        "الإجراء",
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: 13,
                            textAlign: "right",
                            color: "#6b7280",
                            fontSize: 13,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {approvals.map((approval) => {
                      const command = commandMap[approval.command_id];

                      return (
                        <tr key={approval.id}>
                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                              }}
                            >
                              {command?.command || "أمر غير معروف"}
                            </div>

                            <div
                              style={{
                                color: "#9ca3af",
                                fontSize: 11,
                                marginTop: 4,
                              }}
                            >
                              {approval.command_id}
                            </div>
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {(approval.requested_capabilities || [])
                              .map(
                                (item) =>
                                  capabilityLabels[item] || item
                              )
                              .join("، ")}
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <span
                              style={{
                                color: riskColor(approval.risk_level),
                                fontWeight: 800,
                              }}
                            >
                              {riskLabels[approval.risk_level] ||
                                approval.risk_level}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <span
                              style={{
                                color:
                                  approval.status === "approved"
                                    ? GREEN
                                    : approval.status === "rejected"
                                    ? "#dc2626"
                                    : "#d97706",
                                fontWeight: 800,
                              }}
                            >
                              {approval.status === "approved"
                                ? "تمت الموافقة"
                                : approval.status === "rejected"
                                ? "مرفوض"
                                : "بانتظار الموافقة"}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDate(approval.created_at)}
                          </td>

                          <td
                            style={{
                              padding: 13,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {approval.status === "pending" && command && (
                              <button
                                onClick={() => {
                                  setApprovalModal({
                                    ...approval,
                                    command,
                                  });
                                  setApprovalReason("");
                                }}
                                style={{
                                  border: "none",
                                  background: GREEN,
                                  color: "#fff",
                                  borderRadius: 8,
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  fontWeight: 800,
                                }}
                              >
                                مراجعة
                              </button>
                            )}

                            {approval.status !== "pending" && (
                              <span
                                style={{
                                  color: "#9ca3af",
                                  fontSize: 12,
                                }}
                              >
                                مكتمل
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "capabilities" && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 18,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
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
                  borderCollapse: "collapse",
                  minWidth: 850,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f9fafb",
                    }}
                  >
                    {[
                      "الصلاحية",
                      "الوصف",
                      "التفعيل",
                      "الموافقة",
                      "الخطورة",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 13,
                          textAlign: "right",
                          color: "#6b7280",
                          fontSize: 13,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {capabilities.map((capability) => (
                    <tr key={capability.id}>
                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #f1f5f9",
                          fontWeight: 800,
                        }}
                      >
                        {capabilityLabels[capability.capability_key] ||
                          capability.capability_name ||
                          capability.capability_key}
                      </td>

                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #f1f5f9",
                          color: "#6b7280",
                        }}
                      >
                        {capability.description || "—"}
                      </td>

                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <span
                          style={{
                            color: capability.enabled ? GREEN : "#dc2626",
                            fontWeight: 800,
                          }}
                        >
                          {capability.enabled ? "مفعّلة" : "موقوفة"}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {capability.requires_approval ? "نعم" : "لا"}
                      </td>

                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <span
                          style={{
                            color: riskColor(capability.risk_level),
                            fontWeight: 800,
                          }}
                        >
                          {riskLabels[capability.risk_level] ||
                            capability.risk_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {createCommandModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 650,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 18,
              padding: 22,
              boxShadow: "0 25px 70px rgba(0,0,0,.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 21,
                  }}
                >
                  ＋ أمر جديد لوالم
                </h2>

                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 13,
                    marginTop: 5,
                  }}
                >
                  إنشاء أمر آمن من داخل لوحة Super Admin.
                </div>
              </div>

              <button
                onClick={closeCreateCommand}
                disabled={savingCommand}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <label
              style={{
                display: "block",
                fontWeight: 800,
                marginBottom: 7,
              }}
            >
              اسم الأمر
            </label>

            <input
              value={newCommand.command}
              onChange={(e) =>
                setNewCommand((prev) => ({
                  ...prev,
                  command: e.target.value,
                }))
              }
              placeholder="مثال: تحليل ملف والم الرئيسي"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 11,
                border: "1px solid #d1d5db",
                borderRadius: 9,
                marginBottom: 15,
                outline: "none",
              }}
            />

            <label
              style={{
                display: "block",
                fontWeight: 800,
                marginBottom: 7,
              }}
            >
              نوع الأمر
            </label>

            <select
              value={newCommand.command_type}
              onChange={(e) =>
                setNewCommand((prev) => ({
                  ...prev,
                  command_type: e.target.value,
                }))
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 11,
                border: "1px solid #d1d5db",
                borderRadius: 9,
                marginBottom: 15,
                background: "#fff",
              }}
            >
              {supportedCommandTypes.map((type) => (
                <option key={type} value={type}>
                  {commandTypeLabels[type]}
                </option>
              ))}
            </select>

            {selectedCapability && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 15,
                }}
              >
                <span
                  style={{
                    background: "#f3f4f6",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  الخطورة:{" "}
                  {riskLabels[selectedCapability.risk_level] ||
                    selectedCapability.risk_level}
                </span>

                <span
                  style={{
                    background: selectedCapability.requires_approval
                      ? "#fff7ed"
                      : "#ecfdf5",
                    color: selectedCapability.requires_approval
                      ? "#9a3412"
                      : "#166534",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {selectedCapability.requires_approval
                    ? "يتطلب موافقة"
                    : "لا يتطلب موافقة"}
                </span>
              </div>
            )}

            <label
              style={{
                display: "block",
                fontWeight: 800,
                marginBottom: 7,
              }}
            >
              مسار الملف
              <span
                style={{
                  color: "#9ca3af",
                  fontWeight: 400,
                  marginRight: 5,
                }}
              >
                اختياري
              </span>
            </label>

            <input
              value={newCommand.path}
              onChange={(e) =>
                setNewCommand((prev) => ({
                  ...prev,
                  path: e.target.value,
                }))
              }
              placeholder="مثال: app/admin/ai-employee/page.js"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 11,
                border: "1px solid #d1d5db",
                borderRadius: 9,
                marginBottom: 15,
                direction: "ltr",
                textAlign: "left",
              }}
            />

            {newCommand.command_type === "edit_files" && (
              <>
                <label
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  المحتوى الجديد
                </label>

                <textarea
                  value={newCommand.new_content}
                  onChange={(e) =>
                    setNewCommand((prev) => ({
                      ...prev,
                      new_content: e.target.value,
                    }))
                  }
                  placeholder="ضع المحتوى المطلوب اختباره هنا..."
                  rows={10}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 11,
                    border: "1px solid #d1d5db",
                    borderRadius: 9,
                    marginBottom: 10,
                    direction: "ltr",
                    textAlign: "left",
                    resize: "vertical",
                    fontFamily: "monospace",
                  }}
                />

                <div
                  style={{
                    background: "#ecfdf5",
                    color: "#166534",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    padding: 11,
                    marginBottom: 15,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  🛡️ التعديل سيكون Dry Run فقط في هذه المرحلة. لن تتم
                  الكتابة الفعلية على GitHub.
                </div>
              </>
            )}

            <label
              style={{
                display: "block",
                fontWeight: 800,
                marginBottom: 7,
              }}
            >
              ملاحظات
              <span
                style={{
                  color: "#9ca3af",
                  fontWeight: 400,
                  marginRight: 5,
                }}
              >
                اختياري
              </span>
            </label>

            <textarea
              value={newCommand.notes}
              onChange={(e) =>
                setNewCommand((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              placeholder="أي تعليمات إضافية لوالم..."
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 11,
                border: "1px solid #d1d5db",
                borderRadius: 9,
                marginBottom: 18,
                resize: "vertical",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                onClick={closeCreateCommand}
                disabled={savingCommand}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#374151",
                  borderRadius: 9,
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                إلغاء
              </button>

              <button
                onClick={createCommand}
                disabled={savingCommand}
                style={{
                  border: "none",
                  background: GREEN,
                  color: "#fff",
                  borderRadius: 9,
                  padding: "10px 18px",
                  cursor: savingCommand ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  opacity: savingCommand ? 0.7 : 1,
                }}
              >
                {savingCommand ? "جارٍ إنشاء الأمر..." : "إنشاء الأمر"}
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 1100,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              background: "#fff",
              borderRadius: 18,
              padding: 22,
              boxShadow: "0 25px 70px rgba(0,0,0,.25)",
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 21,
              }}
            >
              مراجعة طلب الموافقة
            </h2>

            <div
              style={{
                color: "#6b7280",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              راجع الأمر قبل السماح لوالم ببدء التنفيذ.
            </div>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: 12,
                padding: 14,
                marginBottom: 15,
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                {approvalModal.command?.command || "أمر"}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "#4b5563",
                  lineHeight: 1.8,
                }}
              >
                النوع:{" "}
                {commandTypeLabels[
                  approvalModal.command?.command_type
                ] || approvalModal.command?.command_type}
                <br />
                الخطورة:{" "}
                {riskLabels[approvalModal.risk_level] ||
                  approvalModal.risk_level}
                <br />
                الصلاحية:{" "}
                {(approvalModal.requested_capabilities || [])
                  .map(
                    (item) => capabilityLabels[item] || item
                  )
                  .join("، ")}
              </div>
            </div>

            <label
              style={{
                display: "block",
                fontWeight: 800,
                marginBottom: 7,
              }}
            >
              ملاحظة القرار
            </label>

            <textarea
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              placeholder="اختياري"
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 11,
                border: "1px solid #d1d5db",
                borderRadius: 9,
                marginBottom: 18,
                resize: "vertical",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                onClick={() => {
                  setApprovalModal(null);
                  setApprovalReason("");
                }}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#374151",
                  borderRadius: 9,
                  padding: "10px 15px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                إلغاء
              </button>

              <button
                onClick={rejectCommand}
                style={{
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  borderRadius: 9,
                  padding: "10px 15px",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                رفض
              </button>

              <button
                onClick={approveCommand}
                style={{
                  border: "none",
                  background: GREEN,
                  color: "#fff",
                  borderRadius: 9,
                  padding: "10px 15px",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                ✓ موافقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
