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
  read_project_files: "قراءة الملفات",
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

const statusLabels = {
  pending: "معلق",
  running: "قيد التنفيذ",
  completed: "مكتملة",
  failed: "فشلت",
  cancelled: "ملغاة",
};

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
  const value = Number(seconds || 0);

  if (!value) return "0ث";

  if (value < 60) {
    return `${Math.round(value)}ث`;
  }

  const minutes = Math.floor(value / 60);
  const remainingSeconds = Math.round(value % 60);

  if (minutes < 60) {
    return `${minutes}د ${remainingSeconds}ث`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}س ${remainingMinutes}د`;
}

function statusClass(status) {
  if (status === "completed") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (status === "running") {
    return {
      background: "#ecfdf5",
      color: "#047857",
    };
  }

  if (status === "failed") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
    };
  }

  if (status === "cancelled") {
    return {
      background: "#f3f4f6",
      color: "#4b5563",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
  };
}

function riskClass(risk) {
  if (risk === "critical") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (risk === "high") {
    return {
      background: "#ffedd5",
      color: "#9a3412",
    };
  }

  if (risk === "medium") {
    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  return {
    background: "#dcfce7",
    color: "#166534",
  };
}

function getExecutionButton(command) {
  if (!command) return null;

  if (command.status !== "running") {
    return null;
  }

  if (command.command_type === "read_project_files") {
    return {
      label: "📂 تنفيذ القراءة",
      loadingLabel: "📂 جارٍ قراءة المشروع...",
    };
  }

  if (command.command_type === "analyze_code") {
    return {
      label: "🔍 تنفيذ التحليل",
      loadingLabel: "🔍 جارٍ تحليل الكود...",
    };
  }

  if (command.command_type === "suggest_changes") {
    return {
      label: "💡 تنفيذ الاقتراحات",
      loadingLabel: "💡 جارٍ إعداد الاقتراحات...",
    };
  }

  if (command.command_type === "edit_files") {
    return {
      label: "🛡️ تنفيذ التعديل الآمن",
      loadingLabel: "🛡️ جارٍ إعداد معاينة التعديل...",
    };
  }

  return null;
}

export default function SuperAdminAIEmployeePage() {
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [executingCommandId, setExecutingCommandId] = useState(null);

  const [employee, setEmployee] = useState(null);

  const [capabilities, setCapabilities] = useState([]);

  const [commands, setCommands] = useState([]);

  const [approvals, setApprovals] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [commandSearch, setCommandSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [decisionModal, setDecisionModal] = useState(null);

  const [decisionReason, setDecisionReason] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("يجب تسجيل الدخول أولاً");
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, is_super_admin, account_status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile?.is_super_admin) {
        throw new Error("هذه الصفحة متاحة للـ Super Admin فقط");
      }

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
        throw new Error("موظف والم غير موجود");
      }

      setEmployee(employeeData);

      const [
        capabilitiesResult,
        commandsResult,
        approvalsResult,
      ] = await Promise.all([
        supabase
          .from("ai_employee_capabilities")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("risk_level", {
            ascending: true,
          }),

        supabase
          .from("ai_employee_commands")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("ai_employee_approvals")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (capabilitiesResult.error) {
        throw capabilitiesResult.error;
      }

      if (commandsResult.error) {
        throw commandsResult.error;
      }

      if (approvalsResult.error) {
        throw approvalsResult.error;
      }

      setCapabilities(capabilitiesResult.data || []);

      setCommands(commandsResult.data || []);

      setApprovals(approvalsResult.data || []);
    } catch (err) {
      setError(
        err?.message || "حدث خطأ أثناء تحميل البيانات"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleEmployeeStatus() {
    if (!employee) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const nextStatus =
        employee.status === "active"
          ? "inactive"
          : "active";

      const {
        error: updateError,
      } = await supabase
        .from("ai_employees")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (updateError) {
        throw updateError;
      }

      setEmployee({
        ...employee,
        status: nextStatus,
      });

      setMessage(
        nextStatus === "active"
          ? "🟢 تم تفعيل والم"
          : "🟠 تم إيقاف والم"
      );
    } catch (err) {
      setError(
        err?.message || "تعذر تغيير حالة الموظف"
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCapability(capability) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const {
        error: updateError,
      } = await supabase
        .from("ai_employee_capabilities")
        .update({
          enabled: !capability.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", capability.id);

      if (updateError) {
        throw updateError;
      }

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

      setMessage(
        `تم تحديث صلاحية ${capability.capability_name}`
      );
    } catch (err) {
      setError(
        err?.message || "تعذر تحديث الصلاحية"
      );
    } finally {
      setSaving(false);
    }
  }

  async function startCommand(command) {
    if (!command || command.status !== "pending") {
      return;
    }

    if (
      command.requires_approval === true &&
      command.approval_status !== "approved"
    ) {
      setError(
        "هذا الأمر يحتاج موافقة Super Admin قبل بدء التنفيذ."
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const {
        data,
        error: rpcError,
      } = await supabase.rpc(
        "start_ai_employee_command",
        {
          p_command_id: command.id,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "تعذر بدء الأمر"
        );
      }

      setCommands((current) =>
        current.map((item) =>
          item.id === command.id
            ? {
                ...item,
                status: "running",
                started_at: new Date().toISOString(),
              }
            : item
        )
      );

      setMessage(
        "🟢 تم اجتياز بوابة الأمان وبدأت مرحلة التنفيذ."
      );
    } catch (err) {
      setError(
        err?.message || "تعذر بدء الأمر"
      );
    } finally {
      setSaving(false);
    }
  }

  async function executeCommand(command) {
    if (!command) return;

    const executionButton =
      getExecutionButton(command);

    if (!executionButton) {
      return;
    }

    if (executingCommandId) {
      return;
    }

    setExecutingCommandId(command.id);

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/ai-employee/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command_id: command.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error || "فشل تنفيذ الأمر"
        );
      }

      if (command.command_type === "analyze_code") {
        setMessage(
          "🟢 تم تحليل كود مشروع سوق AI بنجاح."
        );
      } else if (
        command.command_type === "suggest_changes"
      ) {
        setMessage(
          "🟢 تم إعداد اقتراحات تحسين كود مشروع سوق AI بدون تعديل الملفات."
        );
      } else if (
        command.command_type === "edit_files"
      ) {
        setMessage(
          "🟢 تمت معاينة تعديل الملف بأمان. لم يتم تعديل أي ملف في GitHub."
        );
      } else {
        setMessage(
          "🟢 تمت قراءة هيكل مشروع سوق AI بنجاح."
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err?.message || "فشل تنفيذ الأمر"
      );

      await loadData();
    } finally {
      setExecutingCommandId(null);
    }
  }

  async function decideApproval(decision) {
    if (!decisionModal?.approval) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const rpcName =
        decision === "approve"
          ? "approve_ai_employee_command"
          : "reject_ai_employee_command";

      const {
        data,
        error: rpcError,
      } = await supabase.rpc(
        rpcName,
        {
          p_approval_id:
            decisionModal.approval.id,
          p_reason:
            decisionReason.trim() || null,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      if (data && data.success === false) {
        throw new Error(
          data.message || "تعذر تنفيذ القرار"
        );
      }

      setDecisionModal(null);

      setDecisionReason("");

      setMessage(
        decision === "approve"
          ? "🟢 تمت الموافقة على الأمر."
          : "🟠 تم رفض الأمر."
      );

      await loadData();
    } catch (err) {
      setError(
        err?.message || "تعذر حفظ القرار"
      );
    } finally {
      setSaving(false);
    }
  }

  const enabledCapabilities = useMemo(
    () =>
      capabilities.filter(
        (item) => item.enabled
      ).length,
    [capabilities]
  );

  const pendingApprovals = useMemo(
    () =>
      approvals.filter(
        (item) =>
          item.status === "pending"
      ).length,
    [approvals]
  );

  const filteredCommands = useMemo(() => {
    const query =
      commandSearch.trim().toLowerCase();

    return commands.filter((command) => {
      const matchesSearch =
        !query ||
        String(command.command || "")
          .toLowerCase()
          .includes(query) ||
        String(command.command_type || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        command.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    commands,
    commandSearch,
    statusFilter,
  ]);

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7faf8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          color: "#166534",
        }}
      >
        جاري تحميل ملف والم...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7faf8",
        color: "#17221b",
        fontFamily: "Arial, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5ebe7",
            borderRadius: "24px",
            padding: "24px",
            marginBottom: "18px",
            boxShadow:
              "0 8px 30px rgba(0,0,0,.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: GREEN,
                    display: "inline-block",
                  }}
                />

                <span
                  style={{
                    color: "#64748b",
                    fontSize: "14px",
                  }}
                >
                  Super Admin AI Employee
                </span>
              </div>

              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "34px",
                  lineHeight: 1.2,
                }}
              >
                والم
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: "16px",
                }}
              >
                الموظف الذكي المسؤول عن مساعدة إدارة وتشغيل سوق AI.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  background:
                    employee?.status === "active"
                      ? "#dcfce7"
                      : "#f3f4f6",
                  color:
                    employee?.status === "active"
                      ? "#166534"
                      : "#475569",
                  padding: "8px 14px",
                  borderRadius: "999px",
                  fontWeight: 700,
                  fontSize: "13px",
                }}
              >
                {employee?.status === "active"
                  ? "نشط"
                  : "متوقف"}
              </span>

              <button
                onClick={toggleEmployeeStatus}
                disabled={saving}
                style={{
                  border: "1px solid #dbe5de",
                  background: "#fff",
                  color: "#166534",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 700,
                }}
              >
                {employee?.status === "active"
                  ? "إيقاف الموظف"
                  : "تفعيل الموظف"}
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #bbf7d0",
              color: "#166534",
              borderRadius: "14px",
              padding: "13px 16px",
              marginBottom: "14px",
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: "14px",
              padding: "13px 16px",
              marginBottom: "14px",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          {[
            ["الصلاحيات المفعلة", enabledCapabilities],
            ["الأوامر", commands.length],
            [
              "مكتملة",
              commands.filter(
                (c) => c.status === "completed"
              ).length,
            ],
            [
              "قيد التنفيذ",
              commands.filter(
                (c) => c.status === "running"
              ).length,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#fff",
                border: "1px solid #e5ebe7",
                borderRadius: "18px",
                padding: "18px",
              }}
            >
              <div
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                  marginBottom: "7px",
                }}
              >
                {label}
              </div>

              <strong
                style={{
                  fontSize: "27px",
                }}
              >
                {value}
              </strong>
            </div>
          ))}
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e5ebe7",
            borderRadius: "20px",
            padding: "8px",
            marginBottom: "18px",
            display: "flex",
            gap: "6px",
            overflowX: "auto",
          }}
        >
          {[
            ["overview", "نظرة عامة"],
            ["capabilities", "الصلاحيات"],
            ["commands", "الأوامر"],
            ["approvals", "الموافقات"],
            ["instructions", "الشخصية والتعليمات"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                border: "none",
                background:
                  activeTab === key
                    ? "#dcfce7"
                    : "transparent",
                color:
                  activeTab === key
                    ? "#166534"
                    : "#64748b",
                padding: "11px 16px",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </section>

        {activeTab === "overview" && (
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.4fr) minmax(300px, .6fr)",
              gap: "18px",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5ebe7",
                borderRadius: "20px",
                padding: "22px",
              }}
            >
              <h2
                style={{
                  margin: "0 0 18px",
                  fontSize: "21px",
                }}
              >
                ملف الموظف
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "14px",
                }}
              >
                {[
                  ["الاسم", employee?.name || "والم"],
                  [
                    "التخصص",
                    employee?.specialization ||
                      "مساعد إدارة وتشغيل سوق AI",
                  ],
                  ["المستوى", employee?.level || "lead"],
                  [
                    "النبرة",
                    employee?.tone ||
                      "إماراتية احترافية وودية",
                  ],
                  [
                    "آخر نشاط",
                    formatDate(
                      employee?.last_active_at
                    ),
                  ],
                  [
                    "المهام المكتملة",
                    employee?.tasks_completed || 0,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      border: "1px solid #edf1ee",
                      borderRadius: "14px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  background: "#f8faf9",
                  borderRadius: "14px",
                  lineHeight: 1.8,
                  color: "#475569",
                }}
              >
                {employee?.description ||
                  "مساعد AI داخلي لسوق AI، يساعد في إدارة وتشغيل المنصة ومتابعة المهام والأقسام وتحليل العمل."}
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #e5ebe7",
                borderRadius: "20px",
                padding: "22px",
              }}
            >
              <h2
                style={{
                  margin: "0 0 18px",
                  fontSize: "21px",
                }}
              >
                حالة الأمان
              </h2>

              <div
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #bbf7d0",
                  borderRadius: "16px",
                  padding: "18px",
                  color: "#166534",
                  lineHeight: 1.8,
                }}
              >
                <strong>
                  ✓ بوابة التنفيذ مفعلة
                </strong>

                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "14px",
                  }}
                >
                  كل أمر يمر عبر الصلاحيات والموافقة قبل الوصول إلى طبقة التنفيذ.
                </div>
              </div>

              <div
                style={{
                  marginTop: "14px",
                  display: "grid",
                  gap: "8px",
                }}
              >
                {[
                  ["قراءة الملفات", true],
                  ["تعديل الملفات", false],
                  ["قاعدة البيانات", false],
                  ["Deploy", false],
                  ["Rollback", false],
                ].map(([label, enabled]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderBottom:
                        "1px solid #f1f5f2",
                    }}
                  >
                    <span>{label}</span>

                    <span
                      style={{
                        color: enabled
                          ? "#16a34a"
                          : "#64748b",
                        fontWeight: 700,
                      }}
                    >
                      {enabled ? "مسموح" : "مقيد"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "capabilities" && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5ebe7",
              borderRadius: "20px",
              padding: "22px",
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
              }}
            >
              صلاحيات والم
            </h2>

            <p
              style={{
                margin: "0 0 20px",
                color: "#64748b",
              }}
            >
              كل صلاحية مستقلة ويمكن تعطيلها بدون تعطيل الموظف بالكامل.
            </p>

            <div
              style={{
                display: "grid",
                gap: "10px",
              }}
            >
              {capabilities.map((capability) => (
                <div
                  key={capability.id}
                  style={{
                    border: "1px solid #e5ebe7",
                    borderRadius: "16px",
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: "240px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "5px",
                      }}
                    >
                      <strong>
                        {capability.capability_name ||
                          capabilityLabels[
                            capability.capability_key
                          ] ||
                          capability.capability_key}
                      </strong>

                      <span
                        style={{
                          ...riskClass(
                            capability.risk_level
                          ),
                          padding: "4px 8px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {riskLabels[
                          capability.risk_level
                        ] || capability.risk_level}
                      </span>
                    </div>

                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "13px",
                      }}
                    >
                      {capability.description || ""}
                    </div>

                    <div
                      style={{
                        marginTop: "7px",
                        color:
                          capability.requires_approval
                            ? "#92400e"
                            : "#166534",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {capability.requires_approval
                        ? "تحتاج موافقة قبل التنفيذ"
                        : "لا تحتاج موافقة"}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      toggleCapability(capability)
                    }
                    disabled={saving}
                    style={{
                      border: "none",
                      background:
                        capability.enabled
                          ? "#16a34a"
                          : "#cbd5e1",
                      color: "#fff",
                      borderRadius: "999px",
                      padding: "9px 16px",
                      cursor: saving
                        ? "not-allowed"
                        : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {capability.enabled
                      ? "مفعلة"
                      : "معطلة"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "commands" && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5ebe7",
              borderRadius: "20px",
              padding: "22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "18px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: "0 0 6px",
                  }}
                >
                  أوامر والم
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#64748b",
                  }}
                >
                  سجل الأوامر وحالات تنفيذها.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <input
                  value={commandSearch}
                  onChange={(e) =>
                    setCommandSearch(e.target.value)
                  }
                  placeholder="بحث في الأوامر..."
                  style={{
                    border: "1px solid #dbe5de",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    outline: "none",
                    minWidth: "220px",
                  }}
                />

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  style={{
                    border: "1px solid #dbe5de",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    background: "#fff",
                  }}
                >
                  <option value="all">
                    كل الحالات
                  </option>
                  <option value="pending">
                    معلق
                  </option>
                  <option value="running">
                    قيد التنفيذ
                  </option>
                  <option value="completed">
                    مكتملة
                  </option>
                  <option value="failed">
                    فشلت
                  </option>
                  <option value="cancelled">
                    ملغاة
                  </option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              {filteredCommands.length === 0 && (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "#64748b",
                    background: "#f8faf9",
                    borderRadius: "16px",
                  }}
                >
                  لا توجد أوامر.
                </div>
              )}

              {filteredCommands.map((command) => {
                const button =
                  getExecutionButton(command);

                const isExecuting =
                  executingCommandId === command.id;

                const requiresApproval =
                  command.requires_approval === true;

                const approvalApproved =
                  command.approval_status === "approved";

                const canStart =
                  command.status === "pending" &&
                  (!requiresApproval ||
                    approvalApproved);

                const waitingForApproval =
                  command.status === "pending" &&
                  requiresApproval &&
                  !approvalApproved;

                return (
                  <article
                    key={command.id}
                    style={{
                      border: "1px solid #e5ebe7",
                      borderRadius: "18px",
                      padding: "18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "15px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: "260px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginBottom: "8px",
                          }}
                        >
                          <strong
                            style={{
                              fontSize: "18px",
                            }}
                          >
                            {command.command}
                          </strong>

                          <span
                            style={{
                              ...statusClass(
                                command.status
                              ),
                              padding: "5px 9px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {statusLabels[
                              command.status
                            ] || command.status}
                          </span>

                          <span
                            style={{
                              ...riskClass(
                                command.risk_level
                              ),
                              padding: "5px 9px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {riskLabels[
                              command.risk_level
                            ] || command.risk_level}
                          </span>

                          {requiresApproval && (
                            <span
                              style={{
                                background:
                                  approvalApproved
                                    ? "#dcfce7"
                                    : "#fef3c7",
                                color:
                                  approvalApproved
                                    ? "#166534"
                                    : "#92400e",
                                padding: "5px 9px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              {approvalApproved
                                ? "تمت الموافقة"
                                : "تحتاج موافقة"}
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            color: "#64748b",
                            fontSize: "13px",
                          }}
                        >
                          {formatDate(
                            command.created_at
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "14px",
                            flexWrap: "wrap",
                            marginTop: "12px",
                            fontSize: "13px",
                            color: "#475569",
                          }}
                        >
                          <span>
                            النوع:{" "}
                            <strong>
                              {commandTypeLabels[
                                command.command_type
                              ] ||
                                command.command_type}
                            </strong>
                          </span>

                          <span>
                            النقاط{" "}
                            <strong>
                              {command.points_cost || 0}
                            </strong>
                          </span>

                          <span>
                            التكلفة{" "}
                            <strong>
                              $
                              {Number(
                                command.actual_cost ||
                                  command.estimated_cost ||
                                  0
                              ).toFixed(4)}
                            </strong>
                          </span>

                          <span>
                            المدة{" "}
                            <strong>
                              {formatDuration(
                                command.duration_seconds
                              )}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {canStart && (
                          <button
                            onClick={() =>
                              startCommand(command)
                            }
                            disabled={
                              saving ||
                              employee?.status !==
                                "active"
                            }
                            style={{
                              border: "none",
                              background: GREEN,
                              color: "#fff",
                              borderRadius: "12px",
                              padding: "11px 16px",
                              cursor: saving
                                ? "not-allowed"
                                : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            ▶ بدء التنفيذ
                          </button>
                        )}

                        {waitingForApproval && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "7px",
                              background: "#fffbeb",
                              border:
                                "1px solid #fde68a",
                              color: "#92400e",
                              borderRadius: "12px",
                              padding: "11px 14px",
                              fontWeight: 700,
                              fontSize: "13px",
                            }}
                          >
                            ⏳ بانتظار موافقة Super Admin
                          </span>
                        )}

                        {button && (
                          <button
                            onClick={() =>
                              executeCommand(command)
                            }
                            disabled={
                              isExecuting ||
                              executingCommandId !==
                                null
                            }
                            style={{
                              border: "none",
                              background: "#166534",
                              color: "#fff",
                              borderRadius: "12px",
                              padding: "11px 16px",
                              cursor: isExecuting
                                ? "not-allowed"
                                : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            {isExecuting
                              ? button.loadingLabel
                              : button.label}
                          </button>
                        )}
                      </div>
                    </div>

                    {command.result && (
                      <div
                        style={{
                          marginTop: "15px",
                          padding: "14px",
                          background: "#f0fdf4",
                          border:
                            "1px solid #dcfce7",
                          borderRadius: "14px",
                          color: "#166534",
                        }}
                      >
                        <strong>النتيجة</strong>

                        <div
                          style={{
                            marginTop: "7px",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.7,
                          }}
                        >
                          {command.result}
                        </div>

                        {command.command_type ===
                          "suggest_changes" &&
                          command.output_data?.suggestions &&
                          Array.isArray(
                            command.output_data
                              .suggestions
                          ) && (
                            <div
                              style={{
                                marginTop: "14px",
                                display: "grid",
                                gap: "8px",
                              }}
                            >
                              {command.output_data.suggestions.map(
                                (suggestion, index) => (
                                  <div
                                    key={`${command.id}-suggestion-${index}`}
                                    style={{
                                      background: "#fff",
                                      border:
                                        "1px solid #dcfce7",
                                      borderRadius: "12px",
                                      padding: "12px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems:
                                          "center",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <strong>
                                        {index + 1}.{" "}
                                        {suggestion.title ||
                                          "اقتراح تحسين"}
                                      </strong>

                                      {suggestion.priority && (
                                        <span
                                          style={{
                                            fontSize:
                                              "11px",
                                            background:
                                              suggestion.priority ===
                                              "high"
                                                ? "#fee2e2"
                                                : suggestion.priority ===
                                                  "medium"
                                                ? "#fef3c7"
                                                : "#dcfce7",
                                            color:
                                              suggestion.priority ===
                                              "high"
                                                ? "#991b1b"
                                                : suggestion.priority ===
                                                  "medium"
                                                ? "#92400e"
                                                : "#166534",
                                            padding:
                                              "4px 8px",
                                            borderRadius:
                                              "999px",
                                            fontWeight: 700,
                                          }}
                                        >
                                          {suggestion.priority ===
                                          "high"
                                            ? "مرتفع"
                                            : suggestion.priority ===
                                              "medium"
                                            ? "متوسط"
                                            : "منخفض"}
                                        </span>
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        marginTop: "6px",
                                        color: "#475569",
                                        lineHeight: 1.7,
                                      }}
                                    >
                                      {suggestion.description ||
                                        ""}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                      </div>
                    )}

                    {command.error_message && (
                      <div
                        style={{
                          marginTop: "15px",
                          padding: "14px",
                          background: "#fef2f2",
                          border:
                            "1px solid #fecaca",
                          borderRadius: "14px",
                          color: "#991b1b",
                        }}
                      >
                        <strong>الخطأ</strong>

                        <div
                          style={{
                            marginTop: "7px",
                          }}
                        >
                          {command.error_message}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "15px",
                        paddingTop: "14px",
                        borderTop:
                          "1px solid #eef2ef",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: "8px",
                        }}
                      >
                        سجل التنفيذ
                      </div>

                      {Array.isArray(
                        command.execution_log
                      ) &&
                      command.execution_log.length >
                        0 ? (
                        <div
                          style={{
                            display: "grid",
                            gap: "6px",
                          }}
                        >
                          {command.execution_log.map(
                            (item, index) => (
                              <div
                                key={`${command.id}-${index}`}
                                style={{
                                  display: "flex",
                                  justifyContent:
                                    "space-between",
                                  gap: "10px",
                                  background:
                                    "#f8faf9",
                                  padding:
                                    "9px 11px",
                                  borderRadius:
                                    "10px",
                                  fontSize: "12px",
                                }}
                              >
                                <strong>
                                  {item.event}
                                </strong>

                                <span
                                  style={{
                                    color:
                                      "#64748b",
                                  }}
                                >
                                  {formatDate(
                                    item.at
                                  )}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "13px",
                          }}
                        >
                          لا يوجد سجل حتى الآن
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "approvals" && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5ebe7",
              borderRadius: "20px",
              padding: "22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "18px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: "0 0 6px",
                  }}
                >
                  الموافقات
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#64748b",
                  }}
                >
                  الأوامر التي تحتاج قرار Super Admin قبل التنفيذ.
                </p>
              </div>

              <span
                style={{
                  background:
                    pendingApprovals > 0
                      ? "#fef3c7"
                      : "#dcfce7",
                  color:
                    pendingApprovals > 0
                      ? "#92400e"
                      : "#166534",
                  padding: "8px 12px",
                  borderRadius: "999px",
                  fontWeight: 700,
                }}
              >
                {pendingApprovals} موافقات معلقة
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              {approvals.length === 0 && (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "#64748b",
                    background: "#f8faf9",
                    borderRadius: "16px",
                  }}
                >
                  لا توجد موافقات حالياً.
                </div>
              )}

              {approvals.map((approval) => (
                <div
                  key={approval.id}
                  style={{
                    border:
                      "1px solid #e5ebe7",
                    borderRadius: "16px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        طلب موافقة
                      </strong>

                      <div
                        style={{
                          marginTop: "7px",
                          color: "#64748b",
                          fontSize: "13px",
                        }}
                      >
                        الحالة: {approval.status}
                      </div>
                    </div>

                    {approval.status ===
                      "pending" && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                        }}
                      >
                        <button
                          onClick={() => {
                            setDecisionModal({
                              approval,
                              decision:
                                "approve",
                            });
                            setDecisionReason("");
                          }}
                          style={{
                            border: "none",
                            background: GREEN,
                            color: "#fff",
                            borderRadius: "10px",
                            padding: "9px 14px",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          موافقة
                        </button>

                        <button
                          onClick={() => {
                            setDecisionModal({
                              approval,
                              decision:
                                "reject",
                            });
                            setDecisionReason("");
                          }}
                          style={{
                            border:
                              "1px solid #fecaca",
                            background: "#fff",
                            color: "#b91c1c",
                            borderRadius: "10px",
                            padding: "9px 14px",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "instructions" && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5ebe7",
              borderRadius: "20px",
              padding: "22px",
            }}
          >
            <h2
              style={{
                margin: "0 0 14px",
              }}
            >
              الشخصية والتعليمات
            </h2>

            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  background: "#f8faf9",
                  borderRadius: "14px",
                }}
              >
                <strong>الشخصية</strong>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#475569",
                    lineHeight: 1.8,
                  }}
                >
                  {employee?.personality ||
                    "إماراتية احترافية وودية"}
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  background: "#f8faf9",
                  borderRadius: "14px",
                }}
              >
                <strong>التعليمات</strong>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#475569",
                    lineHeight: 1.8,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {employee?.instructions ||
                    "مساعدة إدارة وتشغيل سوق AI مع الالتزام بالصلاحيات وبوابة الموافقات وعدم تنفيذ العمليات الحساسة دون موافقة Super Admin."}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {decisionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#fff",
              borderRadius: "20px",
              padding: "22px",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px",
              }}
            >
              {decisionModal.decision ===
              "approve"
                ? "الموافقة على الأمر"
                : "رفض الأمر"}
            </h3>

            <p
              style={{
                color: "#64748b",
                lineHeight: 1.7,
              }}
            >
              القرار سيُسجل في سجل الموافقات. الموافقة لا تعني تنفيذ الأمر تلقائياً.
            </p>

            <textarea
              value={decisionReason}
              onChange={(e) =>
                setDecisionReason(
                  e.target.value
                )
              }
              placeholder="سبب القرار (اختياري)"
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #dbe5de",
                borderRadius: "12px",
                padding: "12px",
                resize: "vertical",
                outline: "none",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                gap: "8px",
                marginTop: "14px",
              }}
            >
              <button
                onClick={() =>
                  decideApproval(
                    decisionModal.decision
                  )
                }
                disabled={saving}
                style={{
                  border: "none",
                  background:
                    decisionModal.decision ===
                    "approve"
                      ? GREEN
                      : "#dc2626",
                  color: "#fff",
                  borderRadius: "10px",
                  padding: "10px 16px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 700,
                }}
              >
                تأكيد
              </button>

              <button
                onClick={() => {
                  setDecisionModal(null);
                  setDecisionReason("");
                }}
                style={{
                  border:
                    "1px solid #dbe5de",
                  background: "#fff",
                  color: "#475569",
                  borderRadius: "10px",
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
