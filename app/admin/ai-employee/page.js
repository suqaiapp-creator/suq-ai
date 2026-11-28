"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const STATUS_LABELS = {
  pending: "معلق",
  running: "قيد التنفيذ",
  completed: "مكتملة",
  failed: "فشلت",
  cancelled: "ملغاة",
};

const RISK_LABELS = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("ar-AE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
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

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

function riskLabel(level) {
  return RISK_LABELS[level] || level || "—";
}

function statusClass(status) {
  if (status === "completed") return "success";
  if (status === "running") return "running";
  if (status === "failed") return "danger";
  if (status === "cancelled") return "muted";
  return "pending";
}

function riskClass(level) {
  if (level === "critical") return "danger";
  if (level === "high") return "warning";
  if (level === "medium") return "medium";
  return "low";
}

export default function AIEmployeePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [profile, setProfile] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [capabilities, setCapabilities] = useState([]);
  const [commands, setCommands] = useState([]);
  const [approvals, setApprovals] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");

  const [commandSearch, setCommandSearch] = useState("");
  const [commandFilter, setCommandFilter] = useState("all");

  const [approvalModal, setApprovalModal] = useState(null);
  const [approvalReason, setApprovalReason] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("يجب تسجيل الدخول أولاً");
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData?.is_super_admin) {
        throw new Error(
          "هذه الصفحة متاحة للـ Super Admin فقط."
        );
      }

      setProfile(profileData);

      const { data: employeeData, error: employeeError } =
        await supabase
          .from("ai_employees")
          .select("*")
          .eq("name", "والم")
          .maybeSingle();

      if (employeeError) throw employeeError;

      if (!employeeData) {
        throw new Error("موظف AI «والم» غير موجود.");
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
          .order("created_at", {
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

      setCapabilities(
        capabilitiesResult.data || []
      );

      setCommands(
        commandsResult.data || []
      );

      setApprovals(
        approvalsResult.data || []
      );
    } catch (err) {
      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل صفحة والم."
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
    setError("");
    setMessage("");

    try {
      const nextStatus =
        employee.status === "active"
          ? "inactive"
          : "active";

      const { data, error: updateError } =
        await supabase
          .from("ai_employees")
          .update({
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", employee.id)
          .select()
          .single();

      if (updateError) throw updateError;

      setEmployee(data);

      setMessage(
        nextStatus === "active"
          ? "تم تفعيل والم."
          : "تم إيقاف والم."
      );
    } catch (err) {
      setError(
        err?.message ||
          "تعذر تغيير حالة الموظف."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCapability(capability) {
    setError("");
    setMessage("");

    try {
      const { data, error: updateError } =
        await supabase
          .from("ai_employee_capabilities")
          .update({
            enabled: !capability.enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("id", capability.id)
          .select()
          .single();

      if (updateError) throw updateError;

      setCapabilities((current) =>
        current.map((item) =>
          item.id === capability.id
            ? data
            : item
        )
      );

      setMessage(
        `${capability.capability_name}: ${
          data.enabled
            ? "تم التفعيل"
            : "تم التعطيل"
        }`
      );
    } catch (err) {
      setError(
        err?.message ||
          "تعذر تحديث الصلاحية."
      );
    }
  }

  async function decideApproval(decision) {
    if (!approvalModal?.id) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const functionName =
        decision === "approve"
          ? "approve_ai_employee_command"
          : "reject_ai_employee_command";

      const { data, error: rpcError } =
        await supabase.rpc(functionName, {
          p_approval_id: approvalModal.id,
          p_reason:
            approvalReason.trim() || null,
        });

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "تعذر تسجيل القرار."
        );
      }

      setApprovalModal(null);
      setApprovalReason("");

      setMessage(
        decision === "approve"
          ? "تمت الموافقة على الأمر. الموافقة لا تشغّل الأمر تلقائيًا."
          : "تم رفض الأمر."
      );

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "تعذر تسجيل قرار الموافقة."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * المرحلة الأولى من التنفيذ:
   * start_ai_employee_command
   * ينقل الأمر من pending إلى running
   * ويمرره عبر بوابة الصلاحيات.
   */
  async function startCommand(command) {
    if (!command?.id) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } =
        await supabase.rpc(
          "start_ai_employee_command",
          {
            p_command_id: command.id,
          }
        );

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "تعذر بدء الأمر."
        );
      }

      setMessage(
        "تم اجتياز بوابة الأمان وبدأت مرحلة التنفيذ."
      );

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "تعذر بدء الأمر."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * التنفيذ الفعلي للصلاحية:
   * read_project_files فقط.
   *
   * هذا الطلب يذهب إلى:
   * /api/admin/ai-employee/execute
   *
   * والـ API يتحقق مرة أخرى من:
   * - Super Admin
   * - الأمر
   * - الصلاحية
   * - GitHub token
   * - المسار المسموح
   *
   * ثم يقرأ هيكل المشروع ويكمل الأمر.
   */
  async function executeCommand(command) {
    if (!command?.id) return;

    setExecuting(true);
    setError("");
    setMessage("");

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
          data?.error ||
            "تعذر تنفيذ الأمر."
        );
      }

      setMessage(
        "🟢 تمت قراءة هيكل مشروع سوق AI بنجاح."
      );

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "حدث خطأ أثناء تنفيذ القراءة."
      );
    } finally {
      setExecuting(false);
    }
  }

  const filteredCommands = useMemo(() => {
    const search =
      commandSearch.trim().toLowerCase();

    return commands.filter((command) => {
      const matchesSearch =
        !search ||
        String(command.command || "")
          .toLowerCase()
          .includes(search) ||
        String(command.command_type || "")
          .toLowerCase()
          .includes(search);

      const matchesFilter =
        commandFilter === "all" ||
        command.status === commandFilter;

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [
    commands,
    commandSearch,
    commandFilter,
  ]);

  const pendingApprovals = approvals.filter(
    (item) =>
      item.status === "pending"
  );

  const enabledCapabilities =
    capabilities.filter(
      (item) => item.enabled
    ).length;

  const completedCommands =
    commands.filter(
      (item) =>
        item.status === "completed"
    ).length;

  const runningCommands =
    commands.filter(
      (item) =>
        item.status === "running"
    ).length;

  const failedCommands =
    commands.filter(
      (item) =>
        item.status === "failed"
    ).length;

  if (loading) {
    return (
      <main className="page">
        <div className="loading">
          جارٍ تحميل والم...
        </div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6faf7;
            padding: 24px;
            color: #17231b;
          }

          .loading {
            max-width: 1200px;
            margin: 80px auto;
            background: #fff;
            border: 1px solid #dce9df;
            border-radius: 22px;
            padding: 40px;
            text-align: center;
            font-size: 18px;
          }
        `}</style>
      </main>
    );
  }

  if (!profile || !employee) {
    return (
      <main className="page">
        <div className="errorBox">
          {error ||
            "تعذر تحميل بيانات والم."}
        </div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6faf7;
            padding: 24px;
          }

          .errorBox {
            max-width: 700px;
            margin: 80px auto;
            padding: 24px;
            background: #fff;
            border: 1px solid #fecaca;
            color: #991b1b;
            border-radius: 18px;
            text-align: center;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div>
            <div className="eyebrow">
              Super Admin AI Employee
            </div>

            <h1>
              والم
              <span className="onlineDot" />
            </h1>

            <p>
              الموظف الذكي المسؤول عن مساعدة
              إدارة وتشغيل سوق AI.
            </p>
          </div>

          <button
            className={
              employee.status === "active"
                ? "statusButton active"
                : "statusButton inactive"
            }
            onClick={toggleEmployeeStatus}
            disabled={saving}
          >
            <span />
            {employee.status === "active"
              ? "نشط"
              : "غير نشط"}
          </button>
        </header>

        {(message || error) && (
          <div
            className={
              error
                ? "alert error"
                : "alert success"
            }
          >
            {error || message}
          </div>
        )}

        <section className="kpis">
          <div className="kpi">
            <span>الحالة</span>
            <strong>
              {employee.status === "active"
                ? "نشط"
                : "غير نشط"}
            </strong>
          </div>

          <div className="kpi">
            <span>الصلاحيات المفعلة</span>
            <strong>
              {enabledCapabilities}
            </strong>
          </div>

          <div className="kpi">
            <span>الأوامر</span>
            <strong>
              {commands.length}
            </strong>
          </div>

          <div className="kpi">
            <span>مكتملة</span>
            <strong>
              {completedCommands}
            </strong>
          </div>

          <div className="kpi">
            <span>قيد التنفيذ</span>
            <strong>
              {runningCommands}
            </strong>
          </div>

          <div className="kpi">
            <span>فشلت</span>
            <strong>
              {failedCommands}
            </strong>
          </div>

          <div className="kpi">
            <span>موافقات معلقة</span>
            <strong>
              {pendingApprovals.length}
            </strong>
          </div>
        </section>

        <nav className="tabs">
          <button
            className={
              activeTab === "overview"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("overview")
            }
          >
            نظرة عامة
          </button>

          <button
            className={
              activeTab === "capabilities"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("capabilities")
            }
          >
            الصلاحيات
          </button>

          <button
            className={
              activeTab === "commands"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("commands")
            }
          >
            الأوامر
          </button>

          <button
            className={
              activeTab === "approvals"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("approvals")
            }
          >
            الموافقات
          </button>

          <button
            className={
              activeTab === "instructions"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("instructions")
            }
          >
            الشخصية والتعليمات
          </button>
        </nav>

        {activeTab === "overview" && (
          <section className="grid">
            <div className="card">
              <div className="cardTitle">
                <h2>ملف الموظف</h2>
              </div>

              <div className="profileHero">
                <div className="avatar">
                  والم
                </div>

                <div>
                  <h3>{employee.name}</h3>

                  <p>
                    {employee.specialization ||
                      "مساعد إدارة وتشغيل سوق AI"}
                  </p>

                  <div className="badges">
                    <span className="badge green">
                      {employee.level ||
                        "lead"}
                    </span>

                    <span className="badge">
                      {employee.tone ||
                        "إماراتي عملي"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="infoList">
                <div>
                  <span>الوصف</span>
                  <strong>
                    {employee.description ||
                      "مساعد داخلي لإدارة وتشغيل سوق AI."}
                  </strong>
                </div>

                <div>
                  <span>آخر نشاط</span>
                  <strong>
                    {formatDate(
                      employee.last_active_at
                    )}
                  </strong>
                </div>

                <div>
                  <span>المهام المكتملة</span>
                  <strong>
                    {employee.tasks_completed ||
                      0}
                  </strong>
                </div>

                <div>
                  <span>نسبة النجاح</span>
                  <strong>
                    {Number(
                      employee.success_rate || 0
                    ).toFixed(0)}
                    %
                  </strong>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">
                <h2>حالة الأمان</h2>
              </div>

              <div className="securityBox">
                <div className="securityIcon">
                  ✓
                </div>

                <div>
                  <strong>
                    بوابة التنفيذ مفعلة
                  </strong>

                  <p>
                    كل أمر يمر عبر الصلاحيات
                    والموافقة قبل الوصول إلى
                    طبقة التنفيذ.
                  </p>
                </div>
              </div>

              <div className="securityRules">
                <div>
                  <span>قراءة الملفات</span>
                  <b className="allowed">
                    مسموح
                  </b>
                </div>

                <div>
                  <span>تعديل الملفات</span>
                  <b>يتطلب موافقة</b>
                </div>

                <div>
                  <span>قاعدة البيانات</span>
                  <b>مقيد</b>
                </div>

                <div>
                  <span>Deploy</span>
                  <b>مقيد</b>
                </div>

                <div>
                  <span>Rollback</span>
                  <b>مقيد</b>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "capabilities" && (
          <section className="card">
            <div className="cardTitle">
              <div>
                <h2>صلاحيات والم</h2>
                <p>
                  كل صلاحية مستقلة ويمكن تعطيلها
                  بدون تعطيل الموظف بالكامل.
                </p>
              </div>
            </div>

            <div className="capabilities">
              {capabilities.map(
                (capability) => (
                  <div
                    className="capability"
                    key={capability.id}
                  >
                    <div>
                      <div className="capName">
                        <strong>
                          {
                            capability.capability_name
                          }
                        </strong>

                        <span
                          className={`risk ${riskClass(
                            capability.risk_level
                          )}`}
                        >
                          {riskLabel(
                            capability.risk_level
                          )}
                        </span>
                      </div>

                      <p>
                        {capability.description ||
                          capability.capability_key}
                      </p>

                      <small>
                        {capability.requires_approval
                          ? "تحتاج موافقة قبل التنفيذ"
                          : "لا تحتاج موافقة"}
                      </small>
                    </div>

                    <button
                      className={
                        capability.enabled
                          ? "toggle on"
                          : "toggle"
                      }
                      onClick={() =>
                        toggleCapability(
                          capability
                        )
                      }
                      disabled={saving}
                      aria-label={`تفعيل ${capability.capability_name}`}
                    >
                      <span />
                    </button>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {activeTab === "commands" && (
          <section className="card">
            <div className="cardTitle commandHeader">
              <div>
                <h2>أوامر والم</h2>
                <p>
                  سجل الأوامر وحالات تنفيذها.
                </p>
              </div>

              <div className="commandStats">
                <span>
                  {commands.length} أمر
                </span>
              </div>
            </div>

            <div className="filters">
              <input
                value={commandSearch}
                onChange={(event) =>
                  setCommandSearch(
                    event.target.value
                  )
                }
                placeholder="بحث في الأوامر..."
              />

              <select
                value={commandFilter}
                onChange={(event) =>
                  setCommandFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  كل الحالات
                </option>
                <option value="pending">
                  معلقة
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

            <div className="commands">
              {filteredCommands.length === 0 ? (
                <div className="empty">
                  لا توجد أوامر.
                </div>
              ) : (
                filteredCommands.map(
                  (command) => {
                    const isReadProjectFiles =
                      command.command_type ===
                      "read_project_files";

                    const canExecute =
                      command.status ===
                        "running" &&
                      isReadProjectFiles &&
                      !executing;

                    return (
                      <article
                        className="command"
                        key={command.id}
                      >
                        <div className="commandMain">
                          <div className="commandTop">
                            <h3>
                              {command.command}
                            </h3>

                            <span
                              className={`status ${statusClass(
                                command.status
                              )}`}
                            >
                              {statusLabel(
                                command.status
                              )}
                            </span>

                            <span
                              className={`risk ${riskClass(
                                command.risk_level
                              )}`}
                            >
                              {riskLabel(
                                command.risk_level
                              )}
                            </span>
                          </div>

                          <div className="commandMeta">
                            <span>
                              {formatDate(
                                command.created_at
                              )}
                            </span>

                            <span>
                              النقاط{" "}
                              {Number(
                                command.points_cost ||
                                  0
                              ).toFixed(0)}
                            </span>

                            <span>
                              التكلفة $
                              {Number(
                                command.actual_cost ||
                                  command.estimated_cost ||
                                  0
                              ).toFixed(4)}
                            </span>

                            <span>
                              المدة{" "}
                              {formatDuration(
                                command.duration_seconds
                              )}
                            </span>
                          </div>

                          {command.error_message && (
                            <div className="commandError">
                              {command.error_message}
                            </div>
                          )}

                          {command.result && (
                            <div className="resultBox">
                              <strong>
                                النتيجة
                              </strong>

                              <p>
                                {command.result}
                              </p>
                            </div>
                          )}

                          {Array.isArray(
                            command.execution_log
                          ) &&
                            command.execution_log
                              .length > 0 && (
                              <div className="timeline">
                                <strong>
                                  سجل التنفيذ
                                </strong>

                                {command.execution_log.map(
                                  (
                                    item,
                                    index
                                  ) => (
                                    <div
                                      className="timelineItem"
                                      key={`${command.id}-${index}`}
                                    >
                                      <span className="timelineDot" />

                                      <div>
                                        <b>
                                          {
                                            item.event
                                          }
                                        </b>

                                        <small>
                                          {formatDate(
                                            item.at ||
                                              item.created_at
                                          )}
                                        </small>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                        </div>

                        <div className="commandActions">
                          {command.status ===
                            "pending" && (
                            <button
                              className="primaryButton"
                              onClick={() =>
                                startCommand(
                                  command
                                )
                              }
                              disabled={
                                saving ||
                                executing
                              }
                            >
                              ▶ بدء التنفيذ
                            </button>
                          )}

                          {canExecute && (
                            <button
                              className="executeButton"
                              onClick={() =>
                                executeCommand(
                                  command
                                )
                              }
                              disabled={
                                executing
                              }
                            >
                              {executing
                                ? "⏳ جارٍ قراءة المشروع..."
                                : "📂 تنفيذ القراءة"}
                            </button>
                          )}

                          {command.status ===
                            "running" &&
                            !isReadProjectFiles && (
                              <span className="waiting">
                                التنفيذ الفعلي لهذه
                                الصلاحية لم يُربط
                                بعد.
                              </span>
                            )}

                          {command.status ===
                            "completed" && (
                            <span className="completedText">
                              ✓ تم التنفيذ
                            </span>
                          )}

                          {command.status ===
                            "failed" && (
                            <span className="failedText">
                              ✕ فشل التنفيذ
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  }
                )
              )}
            </div>
          </section>
        )}

        {activeTab === "approvals" && (
          <section className="card">
            <div className="cardTitle">
              <div>
                <h2>موافقات والم</h2>
                <p>
                  الموافقة تسمح بالتنفيذ فقط،
                  ولا تشغّل الأمر تلقائيًا.
                </p>
              </div>
            </div>

            {approvals.length === 0 ? (
              <div className="empty">
                لا توجد طلبات موافقة.
              </div>
            ) : (
              <div className="approvals">
                {approvals.map(
                  (approval) => (
                    <div
                      className="approval"
                      key={approval.id}
                    >
                      <div>
                        <div className="approvalTop">
                          <strong>
                            {approval.status ===
                            "pending"
                              ? "طلب موافقة"
                              : approval.decision ===
                                "approved"
                              ? "تمت الموافقة"
                              : "تم الرفض"}
                          </strong>

                          <span
                            className={`status ${statusClass(
                              approval.status ===
                                "approved"
                                ? "completed"
                                : approval.status ===
                                  "rejected"
                                ? "failed"
                                : "pending"
                            )}`}
                          >
                            {approval.status}
                          </span>
                        </div>

                        <p>
                          مستوى الخطورة:{" "}
                          {riskLabel(
                            approval.risk_level
                          )}
                        </p>

                        <small>
                          {formatDate(
                            approval.created_at
                          )}
                        </small>

                        {approval.reason && (
                          <div className="reason">
                            السبب:{" "}
                            {approval.reason}
                          </div>
                        )}
                      </div>

                      {approval.status ===
                        "pending" && (
                        <div className="approvalActions">
                          <button
                            className="approveButton"
                            onClick={() => {
                              setApprovalModal(
                                approval
                              );
                              setApprovalReason("");
                            }}
                            disabled={saving}
                          >
                            موافقة
                          </button>

                          <button
                            className="rejectButton"
                            onClick={() => {
                              setApprovalModal(
                                {
                                  ...approval,
                                  reject: true,
                                }
                              );
                              setApprovalReason("");
                            }}
                            disabled={saving}
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === "instructions" && (
          <section className="grid">
            <div className="card">
              <div className="cardTitle">
                <h2>الشخصية</h2>
              </div>

              <div className="textBlock">
                <label>الاسم</label>
                <div>
                  {employee.name}
                </div>
              </div>

              <div className="textBlock">
                <label>التخصص</label>
                <div>
                  {employee.specialization ||
                    "مساعد إدارة وتشغيل سوق AI"}
                </div>
              </div>

              <div className="textBlock">
                <label>النبرة</label>
                <div>
                  {employee.tone ||
                    "إماراتي، واضح، عملي"}
                </div>
              </div>

              <div className="textBlock">
                <label>الشخصية</label>
                <div>
                  {employee.personality ||
                    "مجهّز للمهمة، يراجع قبل التنفيذ ولا يتجاوز الصلاحيات."}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">
                <h2>تعليمات الموظف</h2>
              </div>

              <div className="instructions">
                {employee.instructions ||
                  "لم تتم إضافة تعليمات مخصصة بعد."}
              </div>
            </div>
          </section>
        )}
      </div>

      {approvalModal && (
        <div
          className="modalBackdrop"
          onClick={() =>
            !saving &&
            setApprovalModal(null)
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <h2>
              {approvalModal.reject
                ? "رفض الأمر"
                : "الموافقة على الأمر"}
            </h2>

            <p>
              {approvalModal.reject
                ? "يمكنك إضافة سبب الرفض."
                : "الموافقة تسمح للأمر بالانتقال إلى التنفيذ، ولا تشغله تلقائيًا."}
            </p>

            <textarea
              value={approvalReason}
              onChange={(event) =>
                setApprovalReason(
                  event.target.value
                )
              }
              placeholder="السبب أو الملاحظة..."
              rows={5}
            />

            <div className="modalActions">
              <button
                className="secondaryButton"
                onClick={() =>
                  setApprovalModal(null)
                }
                disabled={saving}
              >
                إلغاء
              </button>

              <button
                className={
                  approvalModal.reject
                    ? "rejectButton"
                    : "approveButton"
                }
                onClick={() =>
                  decideApproval(
                    approvalModal.reject
                      ? "reject"
                      : "approve"
                  )
                }
                disabled={saving}
              >
                {saving
                  ? "جارٍ الحفظ..."
                  : approvalModal.reject
                  ? "تأكيد الرفض"
                  : "تأكيد الموافقة"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #f6faf7;
          color: #17231b;
          padding: 24px;
        }

        .container {
          width: min(1250px, 100%);
          margin: 0 auto;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          color: #15803d;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        h1 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -1px;
        }

        .onlineDot {
          display: inline-block;
          width: 10px;
          height: 10px;
          background: #16a34a;
          border-radius: 50%;
          margin-right: 9px;
          vertical-align: middle;
        }

        .header p {
          margin: 7px 0 0;
          color: #64746a;
        }

        .statusButton {
          border: 1px solid #d7e6db;
          background: #fff;
          padding: 11px 16px;
          border-radius: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
        }

        .statusButton span {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #94a3b8;
        }

        .statusButton.active span {
          background: #16a34a;
        }

        .statusButton.inactive span {
          background: #ef4444;
        }

        .alert {
          border-radius: 14px;
          padding: 13px 15px;
          margin-bottom: 18px;
          font-weight: 700;
        }

        .alert.success {
          background: #ecfdf3;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }

        .kpi {
          background: #fff;
          border: 1px solid #dce9df;
          border-radius: 16px;
          padding: 15px;
        }

        .kpi span {
          display: block;
          color: #718078;
          font-size: 12px;
          margin-bottom: 7px;
        }

        .kpi strong {
          font-size: 20px;
        }

        .tabs {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          background: #fff;
          border: 1px solid #dce9df;
          padding: 7px;
          border-radius: 16px;
          margin-bottom: 18px;
        }

        .tab {
          border: 0;
          background: transparent;
          padding: 11px 14px;
          border-radius: 11px;
          color: #66736c;
          cursor: pointer;
          white-space: nowrap;
          font-weight: 800;
        }

        .tab.active {
          background: #eaf8ee;
          color: #15803d;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .card {
          background: #fff;
          border: 1px solid #dce9df;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 6px 24px rgba(
            20,
            60,
            35,
            0.035
          );
        }

        .cardTitle {
          margin-bottom: 18px;
        }

        .cardTitle h2 {
          margin: 0;
          font-size: 20px;
        }

        .cardTitle p {
          margin: 6px 0 0;
          color: #718078;
          font-size: 14px;
        }

        .profileHero {
          display: flex;
          align-items: center;
          gap: 15px;
          padding-bottom: 18px;
          border-bottom: 1px solid #edf2ee;
        }

        .avatar {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #dcfce7;
          color: #166534;
          font-weight: 900;
          font-size: 20px;
        }

        .profileHero h3 {
          margin: 0 0 4px;
          font-size: 20px;
        }

        .profileHero p {
          margin: 0;
          color: #68756e;
        }

        .badges {
          display: flex;
          gap: 7px;
          margin-top: 8px;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 999px;
          background: #f1f5f2;
          color: #55625b;
          font-size: 11px;
          font-weight: 800;
        }

        .badge.green {
          background: #dcfce7;
          color: #166534;
        }

        .infoList {
          display: grid;
          gap: 13px;
          margin-top: 18px;
        }

        .infoList div {
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        .infoList span {
          color: #7a867f;
        }

        .infoList strong {
          text-align: left;
          max-width: 65%;
        }

        .securityBox {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #effdf4;
          border: 1px solid #bbf7d0;
          border-radius: 16px;
        }

        .securityIcon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #16a34a;
          color: #fff;
          display: grid;
          place-items: center;
          font-weight: 900;
        }

        .securityBox strong {
          display: block;
          margin-bottom: 5px;
        }

        .securityBox p {
          margin: 0;
          color: #64746a;
          line-height: 1.7;
          font-size: 13px;
        }

        .securityRules {
          margin-top: 16px;
          display: grid;
          gap: 9px;
        }

        .securityRules div {
          display: flex;
          justify-content: space-between;
          padding: 11px 0;
          border-bottom: 1px solid #edf2ee;
        }

        .securityRules span {
          color: #536159;
        }

        .securityRules b {
          font-size: 12px;
          color: #9a6700;
        }

        .securityRules .allowed {
          color: #15803d;
        }

        .capabilities {
          display: grid;
          gap: 10px;
        }

        .capability {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          padding: 15px;
          border: 1px solid #e3ece6;
          border-radius: 15px;
          background: #fbfdfb;
        }

        .capability p {
          margin: 5px 0;
          color: #69766e;
          font-size: 13px;
        }

        .capability small {
          color: #8a968f;
        }

        .capName {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .risk,
        .status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .risk.low {
          background: #ecfdf3;
          color: #15803d;
        }

        .risk.medium {
          background: #fff7df;
          color: #9a6700;
        }

        .risk.warning {
          background: #fff7df;
          color: #9a6700;
        }

        .risk.danger {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status.pending {
          background: #fff7df;
          color: #9a6700;
        }

        .status.running {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status.success {
          background: #ecfdf3;
          color: #15803d;
        }

        .status.danger {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status.muted {
          background: #f1f5f2;
          color: #64746a;
        }

        .toggle {
          flex: 0 0 auto;
          width: 48px;
          height: 28px;
          border: 0;
          border-radius: 999px;
          background: #d5ded8;
          padding: 3px;
          cursor: pointer;
        }

        .toggle span {
          display: block;
          width: 22px;
          height: 22px;
          background: #fff;
          border-radius: 50%;
          transition: 0.2s;
        }

        .toggle.on {
          background: #16a34a;
        }

        .toggle.on span {
          transform: translateX(20px);
        }

        .commandHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .commandStats {
          color: #15803d;
          font-weight: 800;
          font-size: 13px;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 180px;
          gap: 10px;
          margin-bottom: 15px;
        }

        .filters input,
        .filters select,
        .modal textarea {
          width: 100%;
          border: 1px solid #d8e5dc;
          background: #fff;
          border-radius: 12px;
          padding: 11px 13px;
          outline: none;
          font-family: inherit;
        }

        .filters input:focus,
        .filters select:focus,
        .modal textarea:focus {
          border-color: #22c55e;
        }

        .commands {
          display: grid;
          gap: 12px;
        }

        .command {
          border: 1px solid #e1ebe4;
          border-radius: 17px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          gap: 18px;
        }

        .commandMain {
          min-width: 0;
          flex: 1;
        }

        .commandTop {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .commandTop h3 {
          margin: 0;
          font-size: 16px;
        }

        .commandMeta {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 10px;
          color: #77837c;
          font-size: 12px;
        }

        .commandActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          min-width: 145px;
        }

        .primaryButton,
        .executeButton,
        .approveButton,
        .rejectButton,
        .secondaryButton {
          border: 0;
          border-radius: 11px;
          padding: 10px 13px;
          font-family: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .primaryButton {
          background: #15803d;
          color: #fff;
        }

        .executeButton {
          background: #166534;
          color: #fff;
          box-shadow: 0 5px 15px rgba(
            22,
            101,
            52,
            0.18
          );
        }

        .approveButton {
          background: #16a34a;
          color: #fff;
        }

        .rejectButton {
          background: #fee2e2;
          color: #b91c1c;
        }

        .secondaryButton {
          background: #f1f5f2;
          color: #526059;
        }

        .primaryButton:disabled,
        .executeButton:disabled,
        .approveButton:disabled,
        .rejectButton:disabled,
        .secondaryButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .waiting {
          color: #9a6700;
          font-size: 12px;
          line-height: 1.5;
        }

        .completedText {
          color: #15803d;
          font-weight: 800;
          font-size: 13px;
        }

        .failedText {
          color: #b91c1c;
          font-weight: 800;
          font-size: 13px;
        }

        .commandError {
          margin-top: 12px;
          padding: 10px;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
        }

        .resultBox {
          margin-top: 12px;
          padding: 12px;
          border-radius: 12px;
          background: #f5faf6;
          border: 1px solid #dce9df;
        }

        .resultBox strong {
          display: block;
          margin-bottom: 5px;
        }

        .resultBox p {
          margin: 0;
          color: #58655e;
          white-space: pre-wrap;
          line-height: 1.6;
          font-size: 13px;
        }

        .timeline {
          margin-top: 14px;
          padding-top: 13px;
          border-top: 1px solid #edf2ee;
        }

        .timeline > strong {
          display: block;
          margin-bottom: 10px;
        }

        .timelineItem {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          margin: 7px 0;
        }

        .timelineDot {
          width: 7px;
          height: 7px;
          margin-top: 6px;
          border-radius: 50%;
          background: #16a34a;
        }

        .timelineItem b {
          display: block;
          font-size: 12px;
        }

        .timelineItem small {
          color: #87928b;
        }

        .approvals {
          display: grid;
          gap: 12px;
        }

        .approval {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 16px;
          border: 1px solid #e1ebe4;
          border-radius: 16px;
        }

        .approvalTop {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .approval p {
          margin: 8px 0 3px;
          color: #68756e;
          font-size: 13px;
        }

        .approval small {
          color: #89948e;
        }

        .approvalActions {
          display: flex;
          gap: 7px;
          align-items: center;
        }

        .reason {
          margin-top: 9px;
          padding: 9px;
          background: #f7faf8;
          border-radius: 9px;
          color: #59665f;
          font-size: 12px;
        }

        .textBlock {
          margin-bottom: 15px;
        }

        .textBlock label {
          display: block;
          color: #7a867f;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .textBlock div {
          background: #f8fbf9;
          border: 1px solid #e1ebe4;
          border-radius: 12px;
          padding: 12px;
          line-height: 1.7;
        }

        .instructions {
          background: #f8fbf9;
          border: 1px solid #e1ebe4;
          border-radius: 14px;
          padding: 16px;
          line-height: 1.9;
          white-space: pre-wrap;
          min-height: 180px;
        }

        .empty {
          padding: 35px;
          text-align: center;
          color: #7b877f;
          background: #f8fbf9;
          border-radius: 15px;
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 18, 0.42);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 100;
        }

        .modal {
          width: min(500px, 100%);
          background: #fff;
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 20px 70px rgba(
            0,
            0,
            0,
            0.18
          );
        }

        .modal h2 {
          margin: 0;
        }

        .modal p {
          color: #68756e;
          line-height: 1.7;
        }

        .modal textarea {
          resize: vertical;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 14px;
        }

        @media (max-width: 1100px) {
          .kpis {
            grid-template-columns: repeat(
              4,
              1fr
            );
          }
        }

        @media (max-width: 800px) {
          .page {
            padding: 14px;
          }

          .header {
            align-items: flex-start;
            flex-direction: column;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .kpis {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .command {
            flex-direction: column;
          }

          .commandActions {
            justify-content: flex-start;
            min-width: 0;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .approval {
            flex-direction: column;
          }

          .approvalActions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 480px) {
          .kpis {
            grid-template-columns: 1fr 1fr;
          }

          h1 {
            font-size: 28px;
          }

          .infoList div {
            flex-direction: column;
            gap: 3px;
          }

          .infoList strong {
            max-width: 100%;
            text-align: right;
          }
        }
      `}</style>
    </main>
  );
}
