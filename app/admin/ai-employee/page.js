"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const riskLabels = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

const statusLabels = {
  pending: "معلق",
  approved: "معتمد",
  rejected: "مرفوض",
  running: "قيد التنفيذ",
  completed: "مكتمل",
  failed: "فشل",
  cancelled: "ملغي",
};

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("ar-AE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar-AE").format(Number(value || 0));
}

function riskClass(level) {
  if (level === "critical") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (level === "high") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  if (level === "medium") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function statusClass(status) {
  if (status === "completed" || status === "approved") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "failed" || status === "rejected") {
    return "bg-red-50 text-red-700";
  }

  if (status === "running") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default function AiEmployeeControlPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [employee, setEmployee] = useState(null);
  const [capabilities, setCapabilities] = useState([]);
  const [commands, setCommands] = useState([]);
  const [approvals, setApprovals] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");

  const [commandSearch, setCommandSearch] = useState("");
  const [commandFilter, setCommandFilter] = useState("all");

  const [decisionApproval, setDecisionApproval] = useState(null);
  const [decisionReason, setDecisionReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("يجب تسجيل الدخول أولاً");
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, role, is_super_admin, account_status"
          )
          .eq("id", user.id)
          .single();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        throw new Error(
          "غير مصرح. هذه الصفحة متاحة للـ Super Admin فقط."
        );
      }

      const {
        data: employeeData,
        error: employeeError,
      } = await supabase
        .from("ai_employees")
        .select(
          `
            id,
            name,
            description,
            specialization,
            personality,
            tone,
            avatar_url,
            status,
            level,
            permissions,
            instructions,
            tasks_completed,
            tasks_failed,
            success_rate,
            average_rating,
            average_speed_seconds,
            total_cost,
            last_active_at,
            created_at,
            updated_at,
            department_id,
            departments (
              id,
              name
            )
          `
        )
        .eq("name", "والم")
        .limit(1)
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
          .order("risk_level", { ascending: false })
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
          .limit(50),

        supabase
          .from("ai_employee_approvals")
          .select("*")
          .eq("ai_employee_id", employeeData.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(30),
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

      setCommands(commandsResult.data || []);

      setApprovals(
        approvalsResult.data || []
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "حدث خطأ أثناء تحميل البيانات."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleEmployeeStatus = async () => {
    if (!employee) return;

    const nextStatus =
      employee.status === "active"
        ? "inactive"
        : "active";

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("ai_employees")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (error) throw error;

      setEmployee((current) => ({
        ...current,
        status: nextStatus,
      }));

      setMessage(
        nextStatus === "active"
          ? "تم تفعيل والم."
          : "تم إيقاف والم."
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "تعذر تغيير حالة والم."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCapability = async (capability) => {
    if (!capability || !employee) return;

    setSaving(true);
    setMessage("");

    try {
      const nextEnabled =
        !capability.enabled;

      const { error } = await supabase
        .from("ai_employee_capabilities")
        .update({
          enabled: nextEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", capability.id)
        .eq(
          "ai_employee_id",
          employee.id
        );

      if (error) throw error;

      setCapabilities((current) =>
        current.map((item) =>
          item.id === capability.id
            ? {
                ...item,
                enabled: nextEnabled,
              }
            : item
        )
      );

      setMessage(
        nextEnabled
          ? `تم تفعيل: ${capability.capability_name}`
          : `تم تعطيل: ${capability.capability_name}`
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "تعذر تحديث الصلاحية."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * =====================================================
   * بدء تنفيذ الأمر
   *
   * مهم:
   * هذه العملية لا تنفذ AI أو Runway أو كود خارجي.
   * فقط تمر عبر بوابة التفويض وتحوّل الأمر إلى running.
   * =====================================================
   */
  const startCommand = async (command) => {
    if (!command) return;

    setSaving(true);
    setMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "start_ai_employee_command",
          {
            p_command_id: command.id,
          }
        );

      if (error) throw error;

      if (!data?.success) {
        const authorization =
          data?.authorization;

        throw new Error(
          authorization?.message ||
            data?.message ||
            "لم يسمح النظام ببدء الأمر."
        );
      }

      setCommands((current) =>
        current.map((item) =>
          item.id === command.id
            ? {
                ...item,
                status: "running",
                started_at:
                  data.started_at ||
                  new Date().toISOString(),
                updated_at:
                  data.started_at ||
                  new Date().toISOString(),
                execution_log: [
                  ...(item.execution_log || []),
                  {
                    event:
                      "execution_started",
                    timestamp:
                      data.started_at ||
                      new Date().toISOString(),
                  },
                ],
              }
            : item
        )
      );

      setMessage(
        "تم اجتياز بوابة الأمان وبدأت مرحلة التنفيذ. التنفيذ الفعلي لم يُربط بعد."
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "تعذر بدء الأمر."
      );
    } finally {
      setSaving(false);
    }
  };

  const openDecision = (
    approval,
    initialDecision = "approve"
  ) => {
    setDecisionApproval({
      ...approval,
      initialDecision,
    });

    setDecisionReason("");
    setMessage("");
  };

  const closeDecision = () => {
    if (saving) return;

    setDecisionApproval(null);
    setDecisionReason("");
  };

  const submitDecision = async (
    decision
  ) => {
    if (!decisionApproval) return;

    setSaving(true);
    setMessage("");

    try {
      const reason =
        decisionReason.trim() || null;

      const rpcName =
        decision === "approve"
          ? "approve_ai_employee_command"
          : "reject_ai_employee_command";

      const { data, error } =
        await supabase.rpc(
          rpcName,
          {
            p_approval_id:
              decisionApproval.id,
            p_reason: reason,
          }
        );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(
          "تعذر معالجة قرار الموافقة."
        );
      }

      setApprovals((current) =>
        current.map((item) =>
          item.id === decisionApproval.id
            ? {
                ...item,
                status:
                  decision === "approve"
                    ? "approved"
                    : "rejected",
                decision:
                  decision === "approve"
                    ? "approved"
                    : "rejected",
                reason,
                decided_at:
                  new Date().toISOString(),
              }
            : item
        )
      );

      if (data.command_id) {
        setCommands((current) =>
          current.map((item) =>
            item.id === data.command_id
              ? {
                  ...item,
                  approval_status:
                    decision === "approve"
                      ? "approved"
                      : "rejected",
                  status:
                    decision === "approve"
                      ? item.status
                      : "cancelled",
                  error_message:
                    decision === "approve"
                      ? item.error_message
                      : reason ||
                        "تم رفض الأمر من Super Admin",
                }
              : item
          )
        );
      }

      setMessage(
        decision === "approve"
          ? "تمت الموافقة على الأمر. لن يتم تشغيله تلقائيًا."
          : "تم رفض الأمر ومنع انتقاله للتنفيذ."
      );

      setDecisionApproval(null);
      setDecisionReason("");
    } catch (error) {
      setMessage(
        error?.message ||
          "حدث خطأ أثناء معالجة القرار."
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredCommands = useMemo(() => {
    const search =
      commandSearch.trim().toLowerCase();

    return commands.filter(
      (command) => {
        const matchesSearch =
          !search ||
          String(command.command || "")
            .toLowerCase()
            .includes(search);

        const matchesFilter =
          commandFilter === "all" ||
          command.status ===
            commandFilter;

        return (
          matchesSearch &&
          matchesFilter
        );
      }
    );
  }, [
    commands,
    commandSearch,
    commandFilter,
  ]);

  const pendingApprovals =
    approvals.filter(
      (item) =>
        item.status === "pending"
    ).length;

  const enabledCapabilities =
    capabilities.filter(
      (item) => item.enabled
    ).length;

  const completedCommands =
    commands.filter(
      (item) =>
        item.status === "completed"
    ).length;

  const failedCommands =
    commands.filter(
      (item) =>
        item.status === "failed"
    ).length;

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 text-slate-900"
      >
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="animate-pulse space-y-6">
            <div className="h-24 rounded-3xl bg-white" />

            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="h-28 rounded-2xl bg-white"
                  />
                )
              )}
            </div>

            <div className="h-96 rounded-3xl bg-white" />
          </div>
        </div>
      </main>
    );
  }

  if (!employee) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50"
      >
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
              ⚠️
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              تعذر تحميل والم
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {message ||
                "موظف AI غير موجود."}
            </p>

            <button
              onClick={loadData}
              className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-emerald-50 via-white to-white p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-3xl shadow-sm">
                  🤖
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                      والم
                    </h1>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      Super Admin AI
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        employee.status ===
                        "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {employee.status ===
                      "active"
                        ? "نشط"
                        : "متوقف"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {employee.specialization ||
                      "مساعد إدارة وتشغيل سوق AI"}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    مركز تحكم آمن. التنفيذ الفعلي للقدرات
                    البرمجية لم يتم ربطه بعد.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={loadData}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ↻ تحديث
                </button>

                <button
                  onClick={
                    toggleEmployeeStatus
                  }
                  disabled={saving}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
                    employee.status ===
                    "active"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {employee.status ===
                  "active"
                    ? "إيقاف والم"
                    : "تفعيل والم"}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-600">
              {message}
            </div>
          )}
        </header>

        {/* KPI */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="الصلاحيات المفعلة"
            value={`${enabledCapabilities}/${capabilities.length}`}
            icon="🔐"
          />

          <KpiCard
            title="الأوامر"
            value={formatNumber(
              commands.length
            )}
            icon="📋"
          />

          <KpiCard
            title="بانتظار الموافقة"
            value={formatNumber(
              pendingApprovals
            )}
            icon="🛡️"
            highlight={
              pendingApprovals > 0
            }
          />

          <KpiCard
            title="مكتملة"
            value={formatNumber(
              completedCommands
            )}
            icon="✅"
          />

          <KpiCard
            title="فاشلة"
            value={formatNumber(
              failedCommands
            )}
            icon="⚠️"
          />
        </section>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <TabButton
            active={
              activeTab === "overview"
            }
            onClick={() =>
              setActiveTab("overview")
            }
          >
            نظرة عامة
          </TabButton>

          <TabButton
            active={
              activeTab === "capabilities"
            }
            onClick={() =>
              setActiveTab(
                "capabilities"
              )
            }
          >
            الصلاحيات
          </TabButton>

          <TabButton
            active={
              activeTab === "commands"
            }
            onClick={() =>
              setActiveTab("commands")
            }
          >
            الأوامر
          </TabButton>

          <TabButton
            active={
              activeTab === "approvals"
            }
            onClick={() =>
              setActiveTab("approvals")
            }
          >
            الموافقات

            {pendingApprovals > 0 && (
              <span className="mr-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                {pendingApprovals}
              </span>
            )}
          </TabButton>

          <TabButton
            active={
              activeTab === "instructions"
            }
            onClick={() =>
              setActiveTab(
                "instructions"
              )
            }
          >
            شخصية وتعليمات
          </TabButton>
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-3">

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-5">
                <h2 className="text-lg font-black">
                  ملف والم
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  معلومات الموظف وحالته الحالية.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoBox
                  label="الاسم"
                  value={employee.name}
                />

                <InfoBox
                  label="القسم"
                  value={
                    employee.departments
                      ?.name ||
                    "الإدارة العامة"
                  }
                />

                <InfoBox
                  label="المستوى"
                  value={
                    employee.level ||
                    "—"
                  }
                />

                <InfoBox
                  label="التخصص"
                  value={
                    employee.specialization ||
                    "—"
                  }
                />

                <InfoBox
                  label="المهام المكتملة"
                  value={formatNumber(
                    employee.tasks_completed
                  )}
                />

                <InfoBox
                  label="المهام الفاشلة"
                  value={formatNumber(
                    employee.tasks_failed
                  )}
                />

                <InfoBox
                  label="نسبة النجاح"
                  value={`${Number(
                    employee.success_rate ||
                      0
                  ).toFixed(0)}%`}
                />

                <InfoBox
                  label="التكلفة المسجلة"
                  value={`$${Number(
                    employee.total_cost ||
                      0
                  ).toFixed(4)}`}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 text-sm font-bold text-slate-700">
                  الوصف
                </div>

                <p className="text-sm leading-7 text-slate-600">
                  {employee.description ||
                    "لا يوجد وصف مسجل."}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">
                حالة الأمان
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                العمليات الحساسة لا تنفذ تلقائيًا.
              </p>

              <div className="mt-5 space-y-3">
                <SecurityRow
                  label="صلاحيات محددة"
                  value="مفعلة"
                  good
                />

                <SecurityRow
                  label="موافقة للعمليات الحساسة"
                  value="مفعلة"
                  good
                />

                <SecurityRow
                  label="تعديل قاعدة البيانات"
                  value={
                    capabilities.some(
                      (item) =>
                        item.capability_key ===
                          "database_modify" &&
                        item.enabled
                    )
                      ? "مفعّل"
                      : "مقفل"
                  }
                  good={
                    !capabilities.some(
                      (item) =>
                        item.capability_key ===
                          "database_modify" &&
                        item.enabled
                    )
                  }
                />

                <SecurityRow
                  label="النشر إلى Vercel"
                  value={
                    capabilities.some(
                      (item) =>
                        item.capability_key ===
                          "deploy_vercel" &&
                        item.enabled
                    )
                      ? "مفعّل"
                      : "مقفل"
                  }
                  good={
                    !capabilities.some(
                      (item) =>
                        item.capability_key ===
                          "deploy_vercel" &&
                        item.enabled
                    )
                  }
                />

                <SecurityRow
                  label="Rollback"
                  value={
                    capabilities.some(
                      (item) =>
                        item.capability_key ===
                          "rollback" &&
                        item.enabled
                    )
                      ? "مفعّل"
                      : "مقفل"
                  }
                  good={
                    !capabilities.some(
                      (item) =>
                        item.capability_key ===
                          "rollback" &&
                        item.enabled
                    )
                  }
                />
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-sm font-black text-emerald-800">
                  قاعدة أساسية
                </div>

                <p className="mt-1 text-xs leading-6 text-emerald-700">
                  والم لا يحصل على صلاحية مفتوحة للمشروع.
                  كل قدرة مستقلة، والعمليات الحساسة تحتاج
                  موافقة Super Admin.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* Capabilities */}
        {activeTab === "capabilities" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">
                  صلاحيات وقدرات والم
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  تفعيل وتعطيل القدرات بشكل مستقل.
                </p>
              </div>

              <div className="text-sm font-bold text-slate-500">
                {enabledCapabilities} مفعلة من{" "}
                {capabilities.length}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {capabilities.map(
                (capability) => (
                  <div
                    key={capability.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900">
                          {capability.capability_name ||
                            capability.capability_key}
                        </h3>

                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          {capability.description ||
                            "—"}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          toggleCapability(
                            capability
                          )
                        }
                        disabled={saving}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                          capability.enabled
                            ? "bg-emerald-500"
                            : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                            capability.enabled
                              ? "right-1"
                              : "right-6"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${riskClass(
                          capability.risk_level
                        )}`}
                      >
                        خطورة:{" "}
                        {riskLabels[
                          capability
                            .risk_level
                        ] ||
                          capability.risk_level}
                      </span>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {capability.requires_approval
                          ? "تحتاج موافقة"
                          : "لا تحتاج موافقة"}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          capability.enabled
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {capability.enabled
                          ? "مفعلة"
                          : "مقفلة"}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>

            {capabilities.length ===
              0 && (
              <EmptyState text="لا توجد صلاحيات مسجلة." />
            )}

            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="text-sm font-black text-amber-800">
                تنبيه أمني
              </div>

              <p className="mt-1 text-xs leading-6 text-amber-700">
                تفعيل الصلاحية هنا لا يعني أن التنفيذ البرمجي
                أصبح متاحًا تلقائيًا.
              </p>
            </div>
          </section>
        )}

        {/* Commands */}
        {activeTab === "commands" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black">
                  أوامر والم
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  سجل الأوامر وحالات تنفيذها.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={commandSearch}
                  onChange={(event) =>
                    setCommandSearch(
                      event.target.value
                    )
                  }
                  placeholder="بحث في الأوامر..."
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                />

                <select
                  value={commandFilter}
                  onChange={(event) =>
                    setCommandFilter(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
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
                    مكتمل
                  </option>

                  <option value="failed">
                    فشل
                  </option>

                  <option value="cancelled">
                    ملغي
                  </option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredCommands.map(
                (command) => (
                  <div
                    key={command.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(
                                command.status
                              )}`}
                            >
                              {statusLabels[
                                command.status
                              ] ||
                                command.status}
                            </span>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${riskClass(
                                command.risk_level
                              )}`}
                            >
                              {riskLabels[
                                command.risk_level
                              ] ||
                                command.risk_level}
                            </span>

                            {command.requires_approval && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                يحتاج موافقة
                              </span>
                            )}

                            {command.approval_status ===
                              "approved" && (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                تمت الموافقة
                              </span>
                            )}
                          </div>

                          <p className="mt-3 break-words text-sm font-bold leading-6 text-slate-900">
                            {command.command}
                          </p>

                          <div className="mt-2 text-xs text-slate-400">
                            {formatDate(
                              command.created_at
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                          <MiniStat
                            label="النقاط"
                            value={
                              command.points_cost
                            }
                          />

                          <MiniStat
                            label="التكلفة"
                            value={`$${Number(
                              command.actual_cost ||
                                0
                            ).toFixed(4)}`}
                          />

                          <MiniStat
                            label="المدة"
                            value={`${Number(
                              command.duration_seconds ||
                                0
                            ).toFixed(0)}ث`}
                          />
                        </div>
                      </div>

                      {/* Execution Controls */}
                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        {command.status ===
                          "pending" &&
                          command.approval_status !==
                            "rejected" && (
                            <button
                              onClick={() =>
                                startCommand(
                                  command
                                )
                              }
                              disabled={saving}
                              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ▶ بدء التنفيذ
                            </button>
                          )}

                        {command.status ===
                          "pending" &&
                          command.requires_approval &&
                          command.approval_status !==
                            "approved" && (
                            <span className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-700">
                              ⏳ بانتظار الموافقة
                            </span>
                          )}

                        {command.status ===
                          "running" && (
                          <span className="rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700">
                            ⚙️ قيد التنفيذ
                          </span>
                        )}

                        {command.status ===
                          "completed" && (
                          <span className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                            ✓ اكتمل التنفيذ
                          </span>
                        )}

                        {command.status ===
                          "cancelled" && (
                          <span className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700">
                            ✕ تم إلغاء الأمر
                          </span>
                        )}
                      </div>
                    </div>

                    {command.result && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                        <span className="font-bold">
                          النتيجة:
                        </span>{" "}
                        {command.result}
                      </div>
                    )}

                    {command.error_message && (
                      <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-6 text-red-700">
                        <span className="font-bold">
                          الخطأ:
                        </span>{" "}
                        {command.error_message}
                      </div>
                    )}

                    {command.execution_log?.length >
                      0 && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
                        <div className="mb-2 text-xs font-black text-slate-500">
                          سجل التنفيذ
                        </div>

                        <div className="space-y-2">
                          {command.execution_log.map(
                            (log, index) => (
                              <div
                                key={`${command.id}-log-${index}`}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px]"
                              >
                                <span className="font-bold text-slate-600">
                                  {log.event ||
                                    "event"}
                                </span>

                                <span className="text-slate-400">
                                  {formatDate(
                                    log.timestamp
                                  )}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {filteredCommands.length ===
              0 && (
              <EmptyState text="لا توجد أوامر مطابقة." />
            )}
          </section>
        )}

        {/* Approvals */}
        {activeTab === "approvals" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-black">
                موافقات والم
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                العمليات الحساسة التي تتطلب قرار Super Admin.
              </p>
            </div>

            <div className="space-y-3">
              {approvals.map(
                (approval) => (
                  <div
                    key={approval.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(
                              approval.status
                            )}`}
                          >
                            {approval.status ===
                            "pending"
                              ? "بانتظار القرار"
                              : approval.status ===
                                "approved"
                              ? "تمت الموافقة"
                              : approval.status ===
                                "rejected"
                              ? "مرفوض"
                              : approval.status}
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${riskClass(
                              approval.risk_level
                            )}`}
                          >
                            {riskLabels[
                              approval
                                .risk_level
                            ] ||
                              approval.risk_level}
                          </span>
                        </div>

                        <div className="mt-3 break-all text-sm font-bold text-slate-900">
                          أمر مرتبط:
                          <span className="mr-2 font-mono text-xs text-slate-500">
                            {
                              approval.command_id
                            }
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {formatDate(
                            approval.created_at
                          )}
                        </div>

                        {approval.reason && (
                          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                            <span className="font-bold">
                              السبب:
                            </span>{" "}
                            {approval.reason}
                          </div>
                        )}

                        {approval.decided_at && (
                          <div className="mt-2 text-xs text-slate-400">
                            وقت القرار:{" "}
                            {formatDate(
                              approval.decided_at
                            )}
                          </div>
                        )}
                      </div>

                      {approval.status ===
                        "pending" && (
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() =>
                              openDecision(
                                approval,
                                "approve"
                              )
                            }
                            disabled={saving}
                            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            ✓ موافقة
                          </button>

                          <button
                            onClick={() =>
                              openDecision(
                                approval,
                                "reject"
                              )
                            }
                            disabled={saving}
                            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            ✕ رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            {approvals.length ===
              0 && (
              <EmptyState text="لا توجد طلبات موافقة حتى الآن." />
            )}
          </section>
        )}

        {/* Instructions */}
        {activeTab ===
          "instructions" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">
                شخصية والم
              </h2>

              <div className="mt-5 space-y-4">
                <InfoBox
                  label="الشخصية"
                  value={
                    employee.personality ||
                    "لم يتم تحديد الشخصية بعد."
                  }
                />

                <InfoBox
                  label="نبرة التواصل"
                  value={
                    employee.tone ||
                    "إماراتية، واضحة، عملية."
                  }
                />

                <InfoBox
                  label="التعليمات"
                  value={
                    employee.instructions ||
                    "لا توجد تعليمات إضافية مسجلة."
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h2 className="text-lg font-black text-emerald-900">
                مبدأ والم
              </h2>

              <p className="mt-4 text-sm leading-8 text-emerald-800">
                والم موظف مساعد لسوق AI، هدفه تجهيز المهمة
                وفهمها ومراجعة العمل قبل تنفيذه، وليس تنفيذ
                عمليات حساسة بدون صلاحية أو موافقة.
              </p>

              <div className="mt-5 space-y-2 text-sm text-emerald-800">
                <div>✓ يفهم المهمة قبل التنفيذ</div>
                <div>✓ يلتزم بالصلاحيات</div>
                <div>✓ يسجل ما فعله</div>
                <div>✓ يوضح الأخطاء</div>
                <div>✓ يطلب الموافقة عند الحاجة</div>
                <div>✓ لا يتجاوز Super Admin</div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {decisionApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  قرار Super Admin
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  راجع الأمر قبل اتخاذ القرار.
                </p>
              </div>

              <button
                onClick={closeDecision}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-400">
                مستوى الخطورة
              </div>

              <div
                className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${riskClass(
                  decisionApproval.risk_level
                )}`}
              >
                {riskLabels[
                  decisionApproval
                    .risk_level
                ] ||
                  decisionApproval.risk_level}
              </div>

              <div className="mt-4 text-xs font-bold text-slate-400">
                معرف الأمر
              </div>

              <div className="mt-2 break-all font-mono text-xs text-slate-700">
                {decisionApproval.command_id}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-slate-700">
                سبب القرار
              </span>

              <textarea
                value={decisionReason}
                onChange={(event) =>
                  setDecisionReason(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="اكتب ملاحظة أو سبب القرار..."
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </label>

            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-6 text-amber-700">
              <strong>مهم:</strong> الموافقة لا تشغّل
              الأمر مباشرة. هي فقط تسمح له بالانتقال إلى
              طبقة التنفيذ.
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
              <button
                onClick={closeDecision}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                onClick={() =>
                  submitDecision(
                    "reject"
                  )
                }
                disabled={saving}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving
                  ? "جارٍ المعالجة..."
                  : "رفض الأمر"}
              </button>

              <button
                onClick={() =>
                  submitDecision(
                    "approve"
                  )
                }
                disabled={saving}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving
                  ? "جارٍ المعالجة..."
                  : "الموافقة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function KpiCard({
  title,
  value,
  icon,
  highlight = false,
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        highlight
          ? "border-amber-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">
          {title}
        </span>

        <span className="text-lg">
          {icon}
        </span>
      </div>

      <div className="mt-3 text-2xl font-black text-slate-900">
        {value}
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-emerald-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function InfoBox({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-bold text-slate-400">
        {label}
      </div>

      <div className="mt-2 whitespace-pre-wrap text-sm font-bold leading-7 text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

function SecurityRow({
  label,
  value,
  good,
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
      <span className="text-xs font-bold text-slate-600">
        {label}
      </span>

      <span
        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
          good
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
}) {
  return (
    <div className="min-w-[72px] rounded-xl bg-slate-50 px-2 py-2">
      <div className="text-[10px] font-bold text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-xs font-black text-slate-700">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
      {text}
    </div>
  );
}
