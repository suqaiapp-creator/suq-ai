"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const EMPTY_FORM = {
  name: "",
  specialization: "",
  department_id: "",
  admin_id: "",
  personality: "",
  tone: "",
  level: "senior",
  status: "active",
  avatar_url: "",
  description: "",
  instructions: "",
  permissions: {
    products: false,
    marketing: false,
    design: false,
    video: false,
    analytics: false,
    moderation: false,
    publishing: false,
    tasks: false,
  },
};

const LEVELS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "expert", label: "Expert" },
];

const STATUSES = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "suspended", label: "موقوف" },
];

const PERMISSIONS = [
  { key: "products", label: "المنتجات", icon: "▣" },
  { key: "marketing", label: "التسويق", icon: "✦" },
  { key: "design", label: "التصميم", icon: "◈" },
  { key: "video", label: "الفيديو", icon: "▶" },
  { key: "analytics", label: "التحليلات", icon: "⌁" },
  { key: "moderation", label: "المراجعة", icon: "✓" },
  { key: "publishing", label: "النشر", icon: "↗" },
  { key: "tasks", label: "المهام", icon: "☷" },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatCost(value) {
  return Number(value || 0).toFixed(4);
}

function statusLabel(status) {
  if (status === "active") return "نشط";
  if (status === "inactive") return "غير نشط";
  if (status === "suspended") return "موقوف";
  return "غير محدد";
}

function getAdminName(admin, profiles) {
  if (!admin) return "بدون Admin";

  const profile = profiles.find((p) => p.id === admin.user_id);

  return (
    admin.full_name ||
    profile?.full_name ||
    profile?.email ||
    "Admin"
  );
}

function levelLabel(level) {
  return (
    LEVELS.find((item) => item.value === level)?.label ||
    level ||
    "—"
  );
}

export default function AIEmployeesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name, role, is_super_admin")
          .eq("id", currentUser.id)
          .single();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        window.location.href = "/dashboard";
        return;
      }

      const [
        employeesResult,
        departmentsResult,
        adminsResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("ai_employees")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("departments")
          .select("*")
          .order("name", { ascending: true }),

        supabase
          .from("admins")
          .select("*")
          .order("full_name", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, full_name, role, is_super_admin"),
      ]);

      if (employeesResult.error) throw employeesResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (adminsResult.error) throw adminsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
      setAdmins(adminsResult.data || []);
      setProfiles(profilesResult.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    return {
      total: employees.length,
      active: employees.filter((x) => x.status === "active").length,
      inactive: employees.filter((x) => x.status === "inactive")
        .length,
      suspended: employees.filter((x) => x.status === "suspended")
        .length,
      tasks: employees.reduce(
        (sum, x) => sum + Number(x.tasks_completed || 0),
        0
      ),
      cost: employees.reduce(
        (sum, x) => sum + Number(x.total_cost || 0),
        0
      ),
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const department = departments.find(
        (x) => x.id === employee.department_id
      );

      const admin = admins.find(
        (x) => x.id === employee.admin_id
      );

      const adminName = getAdminName(admin, profiles);

      const matchesSearch =
        !query ||
        employee.name?.toLowerCase().includes(query) ||
        employee.specialization?.toLowerCase().includes(query) ||
        department?.name?.toLowerCase().includes(query) ||
        adminName?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        employee.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    employees,
    departments,
    admins,
    profiles,
    search,
    statusFilter,
  ]);

  function openCreate() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
      permissions: {
        ...EMPTY_FORM.permissions,
      },
    });

    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openEdit(employee) {
    setEditingId(employee.id);

    setForm({
      name: employee.name || "",
      specialization: employee.specialization || "",
      department_id: employee.department_id || "",
      admin_id: employee.admin_id || "",
      personality: employee.personality || "",
      tone: employee.tone || "",
      level: employee.level || "senior",
      status: employee.status || "active",
      avatar_url: employee.avatar_url || "",
      description: employee.description || "",
      instructions: employee.instructions || "",
      permissions: {
        ...EMPTY_FORM.permissions,
        ...(employee.permissions || {}),
      },
    });

    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function togglePermission(key) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: !current.permissions[key],
      },
    }));
  }

  async function saveEmployee(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!form.name.trim()) {
      setError("اسم موظف AI مطلوب");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        specialization:
          form.specialization.trim() || null,
        department_id: form.department_id || null,
        admin_id: form.admin_id || null,
        personality:
          form.personality.trim() || null,
        tone: form.tone.trim() || null,
        level: form.level,
        status: form.status,
        avatar_url:
          form.avatar_url.trim() || null,
        description:
          form.description.trim() || null,
        instructions:
          form.instructions.trim() || null,
        permissions: form.permissions,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("ai_employees")
          .update(payload)
          .eq("id", editingId);

        if (updateError) throw updateError;

        setMessage("تم تحديث موظف AI بنجاح");
      } else {
        const { error: insertError } = await supabase
          .from("ai_employees")
          .insert({
            ...payload,
            created_by: user?.id || null,
          });

        if (insertError) throw insertError;

        setMessage("تم إنشاء موظف AI بنجاح");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر حفظ موظف AI");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(employee) {
    setError("");

    const nextStatus =
      employee.status === "active"
        ? "inactive"
        : "active";

    try {
      const { error: updateError } = await supabase
        .from("ai_employees")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (updateError) throw updateError;

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تغيير حالة الموظف");
    }
  }

  function departmentName(id) {
    return (
      departments.find((x) => x.id === id)?.name ||
      "بدون قسم"
    );
  }

  function adminName(id) {
    const admin = admins.find((x) => x.id === id);
    return getAdminName(admin, profiles);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#f6f8f7] p-6"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-emerald-100 border-t-emerald-600" />
              <p className="text-sm text-gray-500">
                جاري تحميل موظفي AI...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f6f8f7] text-gray-900"
    >
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">

        {/* Top Header */}
        <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
              <span>الإدارة</span>
              <span className="text-gray-300">/</span>
              <span>الشركة</span>
              <span className="text-gray-300">/</span>
              <span className="font-medium text-emerald-600">
                موظفو AI
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-emerald-100 bg-white text-2xl shadow-sm">
                🤖
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  موظفو AI
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  إدارة فريق الذكاء الاصطناعي وربطه بالأقسام والـ Admins
                  والصلاحيات.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <span className="text-lg">+</span>
            إضافة موظف AI
          </button>
        </header>

        {/* Messages */}
        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Stats */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="إجمالي الموظفين"
            value={stats.total}
            icon="🤖"
          />

          <Stat
            label="نشط"
            value={stats.active}
            icon="●"
            green
          />

          <Stat
            label="غير نشط"
            value={stats.inactive}
            icon="○"
          />

          <Stat
            label="موقوف"
            value={stats.suspended}
            icon="!"
            red
          />

          <Stat
            label="المهام المكتملة"
            value={formatNumber(stats.tasks)}
            icon="✓"
          />

          <Stat
            label="إجمالي التكلفة"
            value={`${formatCost(stats.cost)} $`}
            icon="$"
          />
        </section>

        {/* Toolbar */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                ⌕
              </span>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن موظف، تخصص، قسم أو Admin..."
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-emerald-400"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="suspended">موقوف</option>
            </select>
          </div>
        </section>

        {/* Employees */}
        {filteredEmployees.length === 0 ? (
          <EmptyState
            hasEmployees={employees.length > 0}
            onCreate={openCreate}
          />
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((employee) => {
              const permissions = employee.permissions || {};

              const enabledPermissions =
                PERMISSIONS.filter(
                  (item) => permissions[item.key]
                );

              return (
                <article
                  key={employee.id}
                  className="group overflow-hidden rounded-[26px] border border-gray-200 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)]"
                >
                  {/* Employee top */}
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-gray-50 text-3xl">
                            {employee.avatar_url ? (
                              <img
                                src={employee.avatar_url}
                                alt={employee.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              "🤖"
                            )}
                          </div>

                          <span
                            className={`absolute -bottom-1 -left-1 h-4 w-4 rounded-full border-[3px] border-white ${
                              employee.status === "active"
                                ? "bg-emerald-500"
                                : employee.status ===
                                  "suspended"
                                ? "bg-red-500"
                                : "bg-gray-300"
                            }`}
                          />
                        </div>

                        <div>
                          <h2 className="text-lg font-bold">
                            {employee.name}
                          </h2>

                          <p className="mt-1 text-sm text-gray-500">
                            {employee.specialization ||
                              "موظف AI"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                          employee.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : employee.status === "suspended"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {statusLabel(employee.status)}
                      </span>
                    </div>

                    {/* Structure */}
                    <div className="mt-6 space-y-3">
                      <DataLine
                        icon="⌂"
                        label="القسم"
                        value={departmentName(
                          employee.department_id
                        )}
                      />

                      <DataLine
                        icon="◉"
                        label="Admin المسؤول"
                        value={adminName(
                          employee.admin_id
                        )}
                      />

                      <DataLine
                        icon="★"
                        label="المستوى"
                        value={levelLabel(employee.level)}
                      />
                    </div>
                  </div>

                  {/* Performance */}
                  <div className="border-y border-gray-100 bg-[#fafcfb] px-6 py-4">
                    <div className="grid grid-cols-3 gap-3">
                      <Performance
                        label="النجاح"
                        value={`${Number(
                          employee.success_rate || 0
                        ).toFixed(0)}%`}
                      />

                      <Performance
                        label="التقييم"
                        value={`${Number(
                          employee.average_rating || 0
                        ).toFixed(1)}`}
                      />

                      <Performance
                        label="المهام"
                        value={formatNumber(
                          employee.tasks_completed
                        )}
                      />
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="px-6 py-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">
                        الصلاحيات
                      </span>

                      <span className="text-[11px] text-gray-400">
                        {enabledPermissions.length} مفعلة
                      </span>
                    </div>

                    <div className="flex min-h-[34px] flex-wrap gap-2">
                      {enabledPermissions.length > 0 ? (
                        enabledPermissions.map((permission) => (
                          <span
                            key={permission.key}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-medium text-gray-600"
                          >
                            <span className="text-emerald-600">
                              {permission.icon}
                            </span>

                            {permission.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">
                          لم يتم تحديد صلاحيات
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-2 border-t border-gray-100 p-4">
                    <button
                      onClick={() =>
                        openEdit(employee)
                      }
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      تعديل الموظف
                    </button>

                    <button
                      onClick={() =>
                        toggleStatus(employee)
                      }
                      className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800"
                    >
                      {employee.status === "active"
                        ? "إيقاف"
                        : "تفعيل"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 px-3 py-5 backdrop-blur-[2px] sm:px-6">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">

            {/* Modal Header */}
            <div className="relative overflow-hidden bg-[#101815] px-6 py-7 text-white sm:px-8">
              <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="absolute -bottom-24 right-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-2xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-300">
                    <span>🤖</span>
                    <span>AI EMPLOYEE</span>
                  </div>

                  <h2 className="text-2xl font-bold">
                    {editingId
                      ? "تعديل موظف AI"
                      : "إضافة موظف AI"}
                  </h2>

                  <p className="mt-2 text-sm text-gray-400">
                    أنشئ ملف الموظف وحدد دوره وصلاحياته داخل سوق AI.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl text-gray-300 transition hover:bg-white/15 hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              onSubmit={saveEmployee}
              className="p-5 sm:p-8"
            >
              <FormSection
                icon="01"
                title="البيانات الأساسية"
                description="اسم الموظف وتخصصه وحالته."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="اسم موظف AI"
                    required
                    value={form.name}
                    onChange={(value) =>
                      updateField("name", value)
                    }
                    placeholder="مثال: والم"
                  />

                  <Field
                    label="التخصص"
                    value={form.specialization}
                    onChange={(value) =>
                      updateField(
                        "specialization",
                        value
                      )
                    }
                    placeholder="مثال: مساعد إدارة وتشغيل"
                  />

                  <Field
                    label="رابط الصورة"
                    value={form.avatar_url}
                    onChange={(value) =>
                      updateField("avatar_url", value)
                    }
                    placeholder="اختياري"
                  />

                  <SelectField
                    label="المستوى"
                    value={form.level}
                    onChange={(value) =>
                      updateField("level", value)
                    }
                    options={LEVELS}
                  />

                  <SelectField
                    label="الحالة"
                    value={form.status}
                    onChange={(value) =>
                      updateField("status", value)
                    }
                    options={STATUSES}
                  />
                </div>
              </FormSection>

              <FormSection
                icon="02"
                title="الهيكل الإداري"
                description="حدد القسم والـ Admin المسؤول."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <SelectField
                    label="القسم"
                    value={form.department_id}
                    onChange={(value) =>
                      updateField(
                        "department_id",
                        value
                      )
                    }
                    options={[
                      {
                        value: "",
                        label: "بدون قسم",
                      },
                      ...departments.map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    ]}
                  />

                  <SelectField
                    label="Admin المسؤول"
                    value={form.admin_id}
                    onChange={(value) =>
                      updateField(
                        "admin_id",
                        value
                      )
                    }
                    options={[
                      {
                        value: "",
                        label: "بدون Admin",
                      },
                      ...admins.map((item) => ({
                        value: item.id,
                        label: getAdminName(
                          item,
                          profiles
                        ),
                      })),
                    ]}
                  />
                </div>

                {(departments.length === 0 ||
                  admins.length === 0) && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-700">
                    {departments.length === 0 &&
                      "لا توجد أقسام حالياً. "}
                    {admins.length === 0 &&
                      "لا يوجد Admin حالياً."}
                    {" يمكنك ربط الموظف لاحقاً."}
                  </div>
                )}
              </FormSection>

              <FormSection
                icon="03"
                title="الشخصية والأسلوب"
                description="حدد شخصية الموظف وطريقة تواصله."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <TextArea
                    label="الشخصية"
                    value={form.personality}
                    onChange={(value) =>
                      updateField(
                        "personality",
                        value
                      )
                    }
                    placeholder="دقيق، عملي، مبادر، يراجع العمل قبل اعتماده..."
                  />

                  <TextArea
                    label="أسلوب الكلام"
                    value={form.tone}
                    onChange={(value) =>
                      updateField("tone", value)
                    }
                    placeholder="إماراتية احترافية وودية..."
                  />

                  <div className="md:col-span-2">
                    <TextArea
                      label="الوصف"
                      value={form.description}
                      onChange={(value) =>
                        updateField(
                          "description",
                          value
                        )
                      }
                      placeholder="ما وظيفة هذا الموظف داخل سوق AI؟"
                      rows={4}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection
                icon="04"
                title="طريقة العمل"
                description="تعليمات التشغيل التي يجب أن يلتزم بها الموظف."
              >
                <TextArea
                  label="التعليمات الأساسية"
                  value={form.instructions}
                  onChange={(value) =>
                    updateField(
                      "instructions",
                      value
                    )
                  }
                  placeholder="راجع المهمة قبل تنفيذها، لا تفترض معلومات غير مؤكدة، لا تدّعي إنجاز أي عمل لم يتم فعلياً..."
                  rows={6}
                />
              </FormSection>

              <FormSection
                icon="05"
                title="الصلاحيات"
                description="حدد المجالات التي يستطيع الموظف العمل فيها."
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PERMISSIONS.map((permission) => {
                    const enabled =
                      !!form.permissions[
                        permission.key
                      ];

                    return (
                      <button
                        key={permission.key}
                        type="button"
                        onClick={() =>
                          togglePermission(
                            permission.key
                          )
                        }
                        className={`rounded-2xl border p-4 text-right transition ${
                          enabled
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-gray-200 bg-gray-50 hover:bg-white"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span
                            className={`text-lg ${
                              enabled
                                ? "text-emerald-600"
                                : "text-gray-400"
                            }`}
                          >
                            {permission.icon}
                          </span>

                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                              enabled
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {enabled ? "✓" : ""}
                          </span>
                        </div>

                        <span
                          className={`text-xs font-bold ${
                            enabled
                              ? "text-emerald-700"
                              : "text-gray-600"
                          }`}
                        >
                          {permission.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FormSection>

              <FormSection
                icon="06"
                title="الأداء"
                description="يتم تحديث هذه الأرقام تلقائياً من نظام المهام."
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <MetricBox
                    label="مكتملة"
                    value={
                      editingId
                        ? formatNumber(
                            employees.find(
                              (x) =>
                                x.id === editingId
                            )?.tasks_completed
                          )
                        : "0"
                    }
                  />

                  <MetricBox
                    label="فاشلة"
                    value={
                      editingId
                        ? formatNumber(
                            employees.find(
                              (x) =>
                                x.id === editingId
                            )?.tasks_failed
                          )
                        : "0"
                    }
                  />

                  <MetricBox
                    label="نسبة النجاح"
                    value={
                      editingId
                        ? `${Number(
                            employees.find(
                              (x) =>
                                x.id === editingId
                            )?.success_rate || 0
                          ).toFixed(1)}%`
                        : "0%"
                    }
                  />

                  <MetricBox
                    label="التقييم"
                    value={
                      editingId
                        ? `${Number(
                            employees.find(
                              (x) =>
                                x.id === editingId
                            )?.average_rating || 0
                          ).toFixed(1)} / 5`
                        : "0 / 5"
                    }
                  />

                  <MetricBox
                    label="التكلفة"
                    value={
                      editingId
                        ? `${formatCost(
                            employees.find(
                              (x) =>
                                x.id === editingId
                            )?.total_cost
                          )} $`
                        : "0.0000 $"
                    }
                  />
                </div>
              </FormSection>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-7 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving
                    ? "جاري الحفظ..."
                    : editingId
                    ? "حفظ التعديلات"
                    : "إنشاء موظف AI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  green,
  red,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.025)]">
      <div
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
          red
            ? "bg-red-50 text-red-500"
            : green
            ? "bg-emerald-50 text-emerald-600"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {icon}
      </div>

      <p className="text-xs text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}

function DataLine({
  icon,
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="text-emerald-600">
          {icon}
        </span>

        <span>{label}</span>
      </div>

      <span className="max-w-[55%] truncate text-xs font-bold text-gray-700">
        {value}
      </span>
    </div>
  );
}

function Performance({
  label,
  value,
}) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-gray-400">
        {label}
      </p>
    </div>
  );
}

function EmptyState({
  hasEmployees,
  onCreate,
}) {
  return (
    <section className="rounded-[26px] border border-gray-200 bg-white px-6 py-20 text-center shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] bg-emerald-50 text-4xl">
        🤖
      </div>

      <h2 className="text-xl font-bold">
        {hasEmployees
          ? "لا توجد نتائج مطابقة"
          : "لا يوجد موظفو AI حتى الآن"}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-gray-500">
        {hasEmployees
          ? "جرّب تغيير البحث أو فلتر الحالة."
          : "أنشئ أول موظف AI وابدأ ببناء فريق الذكاء الاصطناعي داخل سوق AI."}
      </p>

      {!hasEmployees && (
        <button
          onClick={onCreate}
          className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          + إضافة أول موظف AI
        </button>
      )}
    </section>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}) {
  return (
    <section className="mb-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[10px] font-bold text-emerald-600">
          {icon}
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-gray-400">
            {description}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-gray-700">
        {label}
        {required && (
          <span className="mr-1 text-red-500">
            *
          </span>
        )}
      </span>

      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-gray-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 outline-none transition focus:border-emerald-400 focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-gray-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricBox({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-[10px] text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold text-gray-800">
        {value}
      </p>
    </div>
  );
}
