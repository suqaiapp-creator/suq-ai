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
  { key: "products", label: "المنتجات" },
  { key: "marketing", label: "التسويق" },
  { key: "design", label: "التصميم" },
  { key: "video", label: "الفيديو" },
  { key: "analytics", label: "التحليلات" },
  { key: "moderation", label: "المراجعة" },
  { key: "publishing", label: "النشر" },
  { key: "tasks", label: "إدارة المهام" },
];

function statusLabel(status) {
  if (status === "active") return "نشط";
  if (status === "inactive") return "غير نشط";
  if (status === "suspended") return "موقوف";
  return status || "غير محدد";
}

function statusClass(status) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "suspended") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-gray-50 text-gray-600 border-gray-200";
}

function levelLabel(level) {
  return LEVELS.find((item) => item.value === level)?.label || level || "—";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatCost(value) {
  return Number(value || 0).toFixed(4);
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

      const { data: profile, error: profileError } = await supabase
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
    const total = employees.length;

    const active = employees.filter(
      (item) => item.status === "active"
    ).length;

    const inactive = employees.filter(
      (item) => item.status === "inactive"
    ).length;

    const suspended = employees.filter(
      (item) => item.status === "suspended"
    ).length;

    const tasks = employees.reduce(
      (sum, item) => sum + Number(item.tasks_completed || 0),
      0
    );

    const cost = employees.reduce(
      (sum, item) => sum + Number(item.total_cost || 0),
      0
    );

    return {
      total,
      active,
      inactive,
      suspended,
      tasks,
      cost,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const department = departments.find(
        (item) => item.id === employee.department_id
      );

      const admin = admins.find(
        (item) => item.id === employee.admin_id
      );

      const adminName = getAdminName(admin, profiles);

      const matchesSearch =
        !query ||
        employee.name?.toLowerCase().includes(query) ||
        employee.specialization?.toLowerCase().includes(query) ||
        employee.description?.toLowerCase().includes(query) ||
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

    setMessage("");
    setError("");
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

    setMessage("");
    setError("");
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
        specialization: form.specialization.trim() || null,
        department_id: form.department_id || null,
        admin_id: form.admin_id || null,
        personality: form.personality.trim() || null,
        tone: form.tone.trim() || null,
        level: form.level,
        status: form.status,
        avatar_url: form.avatar_url.trim() || null,
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
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
    const nextStatus =
      employee.status === "active" ? "inactive" : "active";

    setError("");

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
      departments.find((item) => item.id === id)?.name ||
      "بدون قسم"
    );
  }

  function adminName(id) {
    const admin = admins.find((item) => item.id === id);
    return getAdminName(admin, profiles);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 p-6"
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
            <p className="text-gray-600">
              جاري تحميل موظفي AI...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6"
    >
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <section className="rounded-3xl bg-gradient-to-l from-emerald-700 to-green-600 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl">
                  🤖
                </div>

                <div>
                  <p className="text-sm text-emerald-100">
                    الإدارة الداخلية
                  </p>

                  <h1 className="text-2xl font-bold">
                    موظفو AI
                  </h1>
                </div>
              </div>

              <p className="max-w-2xl text-sm leading-7 text-emerald-50">
                إدارة موظفي الذكاء الاصطناعي وربط كل موظف بالقسم
                والـ Admin والتخصص والصلاحيات ومتابعة أدائه.
              </p>
            </div>

            <button
              onClick={openCreate}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              + إضافة موظف AI
            </button>
          </div>
        </section>

        {/* Messages */}
        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatCard
            label="الإجمالي"
            value={stats.total}
            icon="🤖"
          />

          <StatCard
            label="نشط"
            value={stats.active}
            icon="🟢"
          />

          <StatCard
            label="غير نشط"
            value={stats.inactive}
            icon="⚪"
          />

          <StatCard
            label="موقوف"
            value={stats.suspended}
            icon="🔴"
          />

          <StatCard
            label="المهام المكتملة"
            value={stats.tasks}
            icon="✅"
          />

          <StatCard
            label="التكلفة"
            value={`${formatCost(stats.cost)} $`}
            icon="💰"
          />
        </section>

        {/* Filters */}
        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم الموظف أو التخصص أو القسم أو الـ Admin..."
              className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-emerald-500"
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
          <section className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-4xl">
              🤖
            </div>

            <h2 className="text-xl font-bold text-gray-900">
              {employees.length === 0
                ? "لا يوجد موظفو AI حتى الآن"
                : "لا توجد نتائج مطابقة"}
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-500">
              {employees.length === 0
                ? "أضف أول موظف AI واربطه بالقسم والـ Admin المسؤول عنه."
                : "جرّب تغيير البحث أو فلتر الحالة."}
            </p>

            {employees.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-6 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700"
              >
                + إضافة أول موظف AI
              </button>
            )}
          </section>
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((employee) => {
              const permissions = employee.permissions || {};

              return (
                <article
                  key={employee.id}
                  className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Card Header */}
                  <div className="border-b border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50 text-2xl">
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

                        <div>
                          <h2 className="font-bold text-gray-900">
                            {employee.name}
                          </h2>

                          <p className="mt-1 text-xs text-gray-500">
                            {employee.specialization || "بدون تخصص محدد"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                          employee.status
                        )}`}
                      >
                        {statusLabel(employee.status)}
                      </span>
                    </div>
                  </div>

                  {/* Structure */}
                  <div className="space-y-3 p-5">
                    <InfoRow
                      icon="🏢"
                      label="القسم"
                      value={departmentName(employee.department_id)}
                    />

                    <InfoRow
                      icon="👤"
                      label="Admin المسؤول"
                      value={adminName(employee.admin_id)}
                    />

                    <InfoRow
                      icon="⭐"
                      label="المستوى"
                      value={levelLabel(employee.level)}
                    />

                    <InfoRow
                      icon="🎯"
                      label="نسبة النجاح"
                      value={`${Number(
                        employee.success_rate || 0
                      ).toFixed(1)}%`}
                    />

                    <InfoRow
                      icon="📊"
                      label="التقييم"
                      value={`${Number(
                        employee.average_rating || 0
                      ).toFixed(1)} / 5`}
                    />
                  </div>

                  {/* Permissions */}
                  <div className="border-t border-gray-100 p-5">
                    <p className="mb-3 text-xs font-bold text-gray-500">
                      الصلاحيات
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {PERMISSIONS.filter(
                        (item) => permissions[item.key]
                      ).map((item) => (
                        <span
                          key={item.key}
                          className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                        >
                          {item.label}
                        </span>
                      ))}

                      {!PERMISSIONS.some(
                        (item) => permissions[item.key]
                      ) && (
                        <span className="text-xs text-gray-400">
                          لم يتم تحديد صلاحيات
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Performance */}
                  <div className="grid grid-cols-3 border-t border-gray-100">
                    <MiniStat
                      label="مكتملة"
                      value={formatNumber(employee.tasks_completed)}
                    />

                    <MiniStat
                      label="فاشلة"
                      value={formatNumber(employee.tasks_failed)}
                    />

                    <MiniStat
                      label="التكلفة"
                      value={formatCost(employee.total_cost)}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-gray-100 p-4">
                    <button
                      onClick={() => openEdit(employee)}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      تعديل
                    </button>

                    <button
                      onClick={() => toggleStatus(employee)}
                      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                        employee.status === "active"
                          ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-6 w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">

            {/* Modal Header */}
            <div className="border-b border-gray-100 bg-gradient-to-l from-emerald-700 to-green-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-100">
                    {editingId
                      ? "تعديل موظف AI"
                      : "إنشاء موظف AI جديد"}
                  </p>

                  <h2 className="mt-1 text-xl font-bold">
                    {editingId
                      ? form.name || "موظف AI"
                      : "إضافة موظف AI"}
                  </h2>
                </div>

                <button
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl hover:bg-white/20"
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={saveEmployee} className="p-6">

              {/* Section 1 */}
              <FormSection
                number="01"
                title="البيانات الأساسية"
                description="المعلومات الرئيسية التي تظهر في بطاقة الموظف."
              >
                <div className="grid gap-4 md:grid-cols-2">
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
                      updateField("specialization", value)
                    }
                    placeholder="مثال: مساعد إدارة وتشغيل"
                  />

                  <Field
                    label="الصورة / Avatar"
                    value={form.avatar_url}
                    onChange={(value) =>
                      updateField("avatar_url", value)
                    }
                    placeholder="رابط الصورة - اختياري"
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

              {/* Section 2 */}
              <FormSection
                number="02"
                title="الهيكل الإداري"
                description="حدد القسم والـ Admin المسؤول عن هذا الموظف."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="القسم"
                    value={form.department_id}
                    onChange={(value) =>
                      updateField("department_id", value)
                    }
                    options={[
                      {
                        value: "",
                        label: "بدون قسم",
                      },
                      ...departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                      })),
                    ]}
                  />

                  <SelectField
                    label="Admin المسؤول"
                    value={form.admin_id}
                    onChange={(value) =>
                      updateField("admin_id", value)
                    }
                    options={[
                      {
                        value: "",
                        label: "بدون Admin",
                      },
                      ...admins.map((admin) => ({
                        value: admin.id,
                        label: getAdminName(admin, profiles),
                      })),
                    ]}
                  />
                </div>

                {departments.length === 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    لا توجد أقسام حالياً. أنشئ قسمًا من صفحة إدارة الشركة
                    ثم ارجع هنا لربط الموظف به.
                  </div>
                )}

                {admins.length === 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    لا يوجد Admin حاليًا. يمكنك إنشاء الموظف الآن بدون
                    Admin، ثم ربطه لاحقًا.
                  </div>
                )}
              </FormSection>

              {/* Section 3 */}
              <FormSection
                number="03"
                title="الشخصية والأسلوب"
                description="كيف يفكر الموظف وكيف يتعامل مع المستخدمين والفريق."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <TextAreaField
                    label="الشخصية"
                    value={form.personality}
                    onChange={(value) =>
                      updateField("personality", value)
                    }
                    placeholder="مثال: دقيق، عملي، مبادر، يراجع العمل قبل اعتماده..."
                  />

                  <TextAreaField
                    label="أسلوب الكلام"
                    value={form.tone}
                    onChange={(value) =>
                      updateField("tone", value)
                    }
                    placeholder="مثال: إماراتية احترافية وودية..."
                  />

                  <div className="md:col-span-2">
                    <TextAreaField
                      label="الوصف"
                      value={form.description}
                      onChange={(value) =>
                        updateField("description", value)
                      }
                      placeholder="اشرح وظيفة الموظف ودوره داخل سوق AI..."
                      rows={4}
                    />
                  </div>
                </div>
              </FormSection>

              {/* Section 4 */}
              <FormSection
                number="04"
                title="طريقة العمل والتعليمات"
                description="تعليمات التشغيل التي يجب على موظف AI الالتزام بها."
              >
                <TextAreaField
                  label="التعليمات الأساسية"
                  value={form.instructions}
                  onChange={(value) =>
                    updateField("instructions", value)
                  }
                  placeholder="مثال: راجع المهمة قبل تنفيذها، لا تفترض معلومات غير مؤكدة، لا تدّعي إنجاز أي عمل لم يتم فعليًا..."
                  rows={6}
                />
              </FormSection>

              {/* Section 5 */}
              <FormSection
                number="05"
                title="الصلاحيات"
                description="حدد المجالات التي يستطيع موظف AI العمل فيها."
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {PERMISSIONS.map((permission) => {
                    const enabled =
                      !!form.permissions[permission.key];

                    return (
                      <button
                        key={permission.key}
                        type="button"
                        onClick={() =>
                          togglePermission(permission.key)
                        }
                        className={`rounded-2xl border p-4 text-right transition ${
                          enabled
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-gray-200 bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`text-sm font-bold ${
                              enabled
                                ? "text-emerald-700"
                                : "text-gray-600"
                            }`}
                          >
                            {permission.label}
                          </span>

                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              enabled
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {enabled ? "✓" : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </FormSection>

              {/* Section 6 */}
              <FormSection
                number="06"
                title="الأداء"
                description="هذه البيانات يتم تحديثها تلقائياً من نظام المهام لاحقاً."
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <ReadonlyMetric
                    label="المهام المكتملة"
                    value={
                      editingId
                        ? formatNumber(
                            employees.find(
                              (item) => item.id === editingId
                            )?.tasks_completed
                          )
                        : "0"
                    }
                  />

                  <ReadonlyMetric
                    label="المهام الفاشلة"
                    value={
                      editingId
                        ? formatNumber(
                            employees.find(
                              (item) => item.id === editingId
                            )?.tasks_failed
                          )
                        : "0"
                    }
                  />

                  <ReadonlyMetric
                    label="نسبة النجاح"
                    value={
                      editingId
                        ? `${Number(
                            employees.find(
                              (item) => item.id === editingId
                            )?.success_rate || 0
                          ).toFixed(1)}%`
                        : "0%"
                    }
                  />

                  <ReadonlyMetric
                    label="التقييم"
                    value={
                      editingId
                        ? `${Number(
                            employees.find(
                              (item) => item.id === editingId
                            )?.average_rating || 0
                          ).toFixed(1)} / 5`
                        : "0 / 5"
                    }
                  />

                  <ReadonlyMetric
                    label="التكلفة"
                    value={
                      editingId
                        ? `${formatCost(
                            employees.find(
                              (item) => item.id === editingId
                            )?.total_cost
                          )} $`
                        : "0.0000 $"
                    }
                  />
                </div>
              </FormSection>

              {/* Footer */}
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-2xl border border-gray-200 px-6 py-3 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-emerald-600 px-7 py-3 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-xl">{icon}</div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{icon}</span>
        <span>{label}</span>
      </div>

      <span className="max-w-[60%] truncate text-xs font-bold text-gray-800">
        {value}
      </span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="p-3 text-center">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-800">
        {value}
      </p>
    </div>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}) {
  return (
    <section className="mb-8 rounded-3xl border border-gray-200 bg-gray-50/70 p-5">
      <div className="mb-5 flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-bold text-emerald-700">
          {number}
        </div>

        <div>
          <h3 className="font-bold text-gray-900">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-6 text-gray-500">
            {description}
          </p>
        </div>
      </div>

      {children}
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
      <span className="mb-2 block text-sm font-bold text-gray-700">
        {label}
        {required && (
          <span className="mr-1 text-red-500">*</span>
        )}
      </span>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-gray-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
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
      <span className="mb-2 block text-sm font-bold text-gray-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
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

function ReadonlyMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-gray-800">
        {value}
      </p>
    </div>
  );
}
