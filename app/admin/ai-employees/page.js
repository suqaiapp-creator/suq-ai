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

  const profile = profiles.find(
    (item) => item.id === admin.user_id
  );

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

  const [selectedId, setSelectedId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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

      if (employeesResult.error) {
        throw employeesResult.error;
      }

      if (departmentsResult.error) {
        throw departmentsResult.error;
      }

      if (adminsResult.error) {
        throw adminsResult.error;
      }

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      const employeeData = employeesResult.data || [];

      setEmployees(employeeData);
      setDepartments(departmentsResult.data || []);
      setAdmins(adminsResult.data || []);
      setProfiles(profilesResult.data || []);

      if (!selectedId && employeeData.length > 0) {
        setSelectedId(employeeData[0].id);
      }

      if (
        selectedId &&
        !employeeData.some((item) => item.id === selectedId)
      ) {
        setSelectedId(employeeData[0]?.id || null);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || "حدث خطأ أثناء تحميل موظفي AI"
      );
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
      active: employees.filter(
        (x) => x.status === "active"
      ).length,
      inactive: employees.filter(
        (x) => x.status === "inactive"
      ).length,
      suspended: employees.filter(
        (x) => x.status === "suspended"
      ).length,
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
        (item) => item.id === employee.department_id
      );

      const admin = admins.find(
        (item) => item.id === employee.admin_id
      );

      const adminName = getAdminName(admin, profiles);

      const matchesSearch =
        !query ||
        employee.name?.toLowerCase().includes(query) ||
        employee.specialization
          ?.toLowerCase()
          .includes(query) ||
        department?.name
          ?.toLowerCase()
          .includes(query) ||
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

  const selectedEmployee = useMemo(() => {
    return (
      employees.find(
        (employee) => employee.id === selectedId
      ) || null
    );
  }, [employees, selectedId]);

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
        department_id:
          form.department_id || null,
        admin_id:
          form.admin_id || null,
        personality:
          form.personality.trim() || null,
        tone:
          form.tone.trim() || null,
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
        const { error: updateError } =
          await supabase
            .from("ai_employees")
            .update(payload)
            .eq("id", editingId);

        if (updateError) throw updateError;

        setMessage("تم تحديث الموظف بنجاح");
      } else {
        const { data, error: insertError } =
          await supabase
            .from("ai_employees")
            .insert({
              ...payload,
              created_by: user?.id || null,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        if (data?.id) {
          setSelectedId(data.id);
        }

        setMessage("تم إنشاء موظف AI بنجاح");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "تعذر حفظ موظف AI"
      );
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
      const { error: updateError } =
        await supabase
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
      setError(
        err.message ||
          "تعذر تغيير حالة الموظف"
      );
    }
  }

  function departmentName(id) {
    return (
      departments.find(
        (item) => item.id === id
      )?.name || "بدون قسم"
    );
  }

  function adminName(id) {
    const admin = admins.find(
      (item) => item.id === id
    );

    return getAdminName(admin, profiles);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#f7f8f8]"
      >
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-100 border-t-emerald-600" />
            <p className="text-sm text-gray-500">
              جاري تحميل إدارة موظفي AI...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f8f8]"
    >
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 text-xs text-gray-400">
              الإدارة الداخلية / موظفو AI
            </div>

            <h1 className="text-2xl font-bold text-gray-950">
              فريق الذكاء الاصطناعي
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              أنشئ موظفي AI واربطهم بالأقسام والـ Admins
              وأدر صلاحياتهم وأدائهم.
            </p>
          </div>

          <button
            onClick={openCreate}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <span className="text-lg">+</span>
            موظف AI جديد
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Overview */}
        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Overview
            title="الموظفون"
            value={stats.total}
          />

          <Overview
            title="نشط"
            value={stats.active}
            green
          />

          <Overview
            title="غير نشط"
            value={stats.inactive}
          />

          <Overview
            title="موقوف"
            value={stats.suspended}
          />

          <Overview
            title="المهام"
            value={formatNumber(stats.tasks)}
          />

          <Overview
            title="التكلفة"
            value={`${formatCost(stats.cost)} $`}
          />
        </section>

        {/* Workspace */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_2px_18px_rgba(0,0,0,0.035)]">

          {/* Toolbar */}
          <div className="border-b border-gray-100 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  ⌕
                </span>

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="بحث عن موظف..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pr-10 pl-4 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-emerald-400"
              >
                <option value="all">
                  كل الحالات
                </option>

                <option value="active">
                  نشط
                </option>

                <option value="inactive">
                  غير نشط
                </option>

                <option value="suspended">
                  موقوف
                </option>
              </select>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <EmptyState
              hasEmployees={employees.length > 0}
              onCreate={openCreate}
            />
          ) : (
            <div className="grid min-h-[620px] lg:grid-cols-[310px_1fr]">

              {/* Employee list */}
              <aside className="border-b border-gray-100 bg-[#fbfcfc] lg:border-l lg:border-b-0">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      الموظفون
                    </span>

                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500">
                      {filteredEmployees.length}
                    </span>
                  </div>
                </div>

                <div className="max-h-[650px] overflow-y-auto p-2">
                  {filteredEmployees.map(
                    (employee) => {
                      const active =
                        employee.id === selectedId;

                      return (
                        <button
                          key={employee.id}
                          onClick={() =>
                            setSelectedId(
                              employee.id
                            )
                          }
                          className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-right transition ${
                            active
                              ? "bg-emerald-50"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <div className="relative shrink-0">
                            <div
                              className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl ${
                                active
                                  ? "bg-white"
                                  : "bg-gray-100"
                              }`}
                            >
                              {employee.avatar_url ? (
                                <img
                                  src={
                                    employee.avatar_url
                                  }
                                  alt={
                                    employee.name
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xl">
                                  🤖
                                </span>
                              )}
                            </div>

                            <span
                              className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white ${
                                employee.status ===
                                "active"
                                  ? "bg-emerald-500"
                                  : employee.status ===
                                    "suspended"
                                  ? "bg-red-500"
                                  : "bg-gray-300"
                              }`}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div
                              className={`truncate text-sm font-bold ${
                                active
                                  ? "text-emerald-800"
                                  : "text-gray-800"
                              }`}
                            >
                              {employee.name}
                            </div>

                            <div className="mt-0.5 truncate text-[11px] text-gray-400">
                              {employee.specialization ||
                                "موظف AI"}
                            </div>
                          </div>

                          {active && (
                            <span className="text-emerald-600">
                              ←
                            </span>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </aside>

              {/* Employee profile */}
              <div className="bg-white">
                {selectedEmployee ? (
                  <EmployeeProfile
                    employee={
                      selectedEmployee
                    }
                    departmentName={
                      departmentName
                    }
                    adminName={adminName}
                    openEdit={openEdit}
                    toggleStatus={
                      toggleStatus
                    }
                  />
                ) : (
                  <div className="flex h-full min-h-[600px] items-center justify-center">
                    <p className="text-sm text-gray-400">
                      اختر موظفاً لعرض ملفه
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modal */}
      {modalOpen && (
        <EmployeeModal
          editingId={editingId}
          form={form}
          saving={saving}
          departments={departments}
          admins={admins}
          profiles={profiles}
          employees={employees}
          updateField={updateField}
          togglePermission={
            togglePermission
          }
          closeModal={closeModal}
          saveEmployee={saveEmployee}
        />
      )}
    </main>
  );
}

function EmployeeProfile({
  employee,
  departmentName,
  adminName,
  openEdit,
  toggleStatus,
}) {
  const permissions =
    employee.permissions || {};

  const enabledPermissions =
    PERMISSIONS.filter(
      (item) => permissions[item.key]
    );

  return (
    <div>
      {/* Profile header */}
      <div className="border-b border-gray-100 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-gray-50 text-4xl">
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
                className={`absolute -bottom-1 -left-1 h-5 w-5 rounded-full border-[3px] border-white ${
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
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-950">
                  {employee.name}
                </h2>

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    employee.status ===
                    "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : employee.status ===
                        "suspended"
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {statusLabel(
                    employee.status
                  )}
                </span>
              </div>

              <p className="text-sm text-gray-500">
                {employee.specialization ||
                  "موظف ذكاء اصطناعي"}
              </p>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                <span>
                  {departmentName(
                    employee.department_id
                  )}
                </span>

                <span>•</span>

                <span>
                  {levelLabel(
                    employee.level
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                openEdit(employee)
              }
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              تعديل
            </button>

            <button
              onClick={() =>
                toggleStatus(employee)
              }
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800"
            >
              {employee.status === "active"
                ? "إيقاف"
                : "تفعيل"}
            </button>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 border-b border-gray-100 sm:grid-cols-4">
        <ProfileStat
          label="المهام المكتملة"
          value={formatNumber(
            employee.tasks_completed
          )}
        />

        <ProfileStat
          label="نسبة النجاح"
          value={`${Number(
            employee.success_rate || 0
          ).toFixed(1)}%`}
        />

        <ProfileStat
          label="التقييم"
          value={`${Number(
            employee.average_rating || 0
          ).toFixed(1)} / 5`}
        />

        <ProfileStat
          label="التكلفة"
          value={`${formatCost(
            employee.total_cost
          )} $`}
        />
      </div>

      {/* Details */}
      <div className="grid gap-6 p-5 sm:p-8 xl:grid-cols-2">

        <ProfileSection
          title="الهيكل الإداري"
          icon="⌂"
        >
          <Detail
            label="القسم"
            value={departmentName(
              employee.department_id
            )}
          />

          <Detail
            label="Admin المسؤول"
            value={adminName(
              employee.admin_id
            )}
          />

          <Detail
            label="المستوى"
            value={levelLabel(
              employee.level
            )}
          />

          <Detail
            label="الحالة"
            value={statusLabel(
              employee.status
            )}
          />
        </ProfileSection>

        <ProfileSection
          title="الشخصية والأسلوب"
          icon="✦"
        >
          <Detail
            label="الشخصية"
            value={
              employee.personality ||
              "لم يتم تحديدها"
            }
          />

          <Detail
            label="أسلوب الكلام"
            value={
              employee.tone ||
              "لم يتم تحديده"
            }
          />
        </ProfileSection>

        <ProfileSection
          title="الوصف"
          icon="i"
        >
          <p className="text-sm leading-7 text-gray-600">
            {employee.description ||
              "لا يوجد وصف لهذا الموظف حتى الآن."}
          </p>
        </ProfileSection>

        <ProfileSection
          title="التعليمات"
          icon="!"
        >
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600">
            {employee.instructions ||
              "لا توجد تعليمات مخصصة حتى الآن."}
          </p>
        </ProfileSection>

        <div className="xl:col-span-2">
          <ProfileSection
            title="الصلاحيات"
            icon="✓"
          >
            {enabledPermissions.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {enabledPermissions.map(
                  (permission) => (
                    <div
                      key={permission.key}
                      className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm text-emerald-600">
                        {permission.icon}
                      </span>

                      <span className="text-xs font-bold text-emerald-800">
                        {permission.label}
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                لم يتم تحديد صلاحيات لهذا الموظف.
              </p>
            )}
          </ProfileSection>
        </div>

        <div className="xl:col-span-2">
          <ProfileSection
            title="الأداء التشغيلي"
            icon="⌁"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <OperationMetric
                label="المهام المكتملة"
                value={formatNumber(
                  employee.tasks_completed
                )}
              />

              <OperationMetric
                label="المهام الفاشلة"
                value={formatNumber(
                  employee.tasks_failed
                )}
              />

              <OperationMetric
                label="متوسط سرعة التنفيذ"
                value={`${Number(
                  employee.average_speed_seconds ||
                    0
                ).toFixed(0)} ثانية`}
              />
            </div>
          </ProfileSection>
        </div>
      </div>
    </div>
  );
}

function EmployeeModal({
  editingId,
  form,
  saving,
  departments,
  admins,
  profiles,
  updateField,
  togglePermission,
  closeModal,
  saveEmployee,
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-3 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">

        <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600">
                AI EMPLOYEE
              </p>

              <h2 className="mt-1 text-xl font-bold">
                {editingId
                  ? "تعديل موظف AI"
                  : "إضافة موظف AI"}
              </h2>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              ×
            </button>
          </div>
        </div>

        <form
          onSubmit={saveEmployee}
          className="max-h-[75vh] overflow-y-auto p-5 sm:p-7"
        >
          <div className="space-y-6">

            <ModalSection title="البيانات الأساسية">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="اسم الموظف"
                  required
                  value={form.name}
                  onChange={(value) =>
                    updateField(
                      "name",
                      value
                    )
                  }
                  placeholder="مثال: والم"
                />

                <Input
                  label="التخصص"
                  value={
                    form.specialization
                  }
                  onChange={(value) =>
                    updateField(
                      "specialization",
                      value
                    )
                  }
                  placeholder="مثال: مساعد إدارة وتشغيل"
                />

                <Input
                  label="رابط الصورة"
                  value={
                    form.avatar_url
                  }
                  onChange={(value) =>
                    updateField(
                      "avatar_url",
                      value
                    )
                  }
                  placeholder="اختياري"
                />

                <Select
                  label="المستوى"
                  value={form.level}
                  onChange={(value) =>
                    updateField(
                      "level",
                      value
                    )
                  }
                  options={LEVELS}
                />

                <Select
                  label="الحالة"
                  value={form.status}
                  onChange={(value) =>
                    updateField(
                      "status",
                      value
                    )
                  }
                  options={STATUSES}
                />
              </div>
            </ModalSection>

            <ModalSection title="الهيكل الإداري">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="القسم"
                  value={
                    form.department_id
                  }
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
                    ...departments.map(
                      (item) => ({
                        value: item.id,
                        label: item.name,
                      })
                    ),
                  ]}
                />

                <Select
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
                    ...admins.map(
                      (item) => ({
                        value: item.id,
                        label: getAdminName(
                          item,
                          profiles
                        ),
                      })
                    ),
                  ]}
                />
              </div>
            </ModalSection>

            <ModalSection title="الشخصية وطريقة العمل">
              <div className="space-y-4">
                <TextArea
                  label="الشخصية"
                  value={
                    form.personality
                  }
                  onChange={(value) =>
                    updateField(
                      "personality",
                      value
                    )
                  }
                  placeholder="دقيق، عملي، مبادر..."
                />

                <TextArea
                  label="أسلوب الكلام"
                  value={form.tone}
                  onChange={(value) =>
                    updateField(
                      "tone",
                      value
                    )
                  }
                  placeholder="إماراتية احترافية وودية..."
                />

                <TextArea
                  label="الوصف"
                  value={
                    form.description
                  }
                  onChange={(value) =>
                    updateField(
                      "description",
                      value
                    )
                  }
                  placeholder="ما دور الموظف داخل سوق AI؟"
                />

                <TextArea
                  label="التعليمات الأساسية"
                  value={
                    form.instructions
                  }
                  onChange={(value) =>
                    updateField(
                      "instructions",
                      value
                    )
                  }
                  placeholder="تعليمات يجب على الموظف الالتزام بها..."
                  rows={6}
                />
              </div>
            </ModalSection>

            <ModalSection title="الصلاحيات">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PERMISSIONS.map(
                  (permission) => {
                    const enabled =
                      !!form.permissions[
                        permission.key
                      ];

                    return (
                      <button
                        type="button"
                        key={permission.key}
                        onClick={() =>
                          togglePermission(
                            permission.key
                          )
                        }
                        className={`rounded-xl border p-3 text-right transition ${
                          enabled
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm">
                            {
                              permission.icon
                            }
                          </span>

                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                              enabled
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {enabled
                              ? "✓"
                              : ""}
                          </span>
                        </div>

                        <div
                          className={`mt-2 text-xs font-bold ${
                            enabled
                              ? "text-emerald-700"
                              : "text-gray-600"
                          }`}
                        >
                          {
                            permission.label
                          }
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </ModalSection>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving
                ? "جاري الحفظ..."
                : editingId
                ? "حفظ التعديلات"
                : "إنشاء الموظف"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Overview({
  title,
  value,
  green,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.025)]">
      <p className="text-[11px] text-gray-400">
        {title}
      </p>

      <p
        className={`mt-2 text-xl font-bold ${
          green
            ? "text-emerald-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ProfileStat({
  label,
  value,
}) {
  return (
    <div className="border-l border-gray-100 px-5 py-5 text-center last:border-l-0">
      <div className="text-lg font-bold text-gray-900">
        {value}
      </div>

      <div className="mt-1 text-[10px] text-gray-400">
        {label}
      </div>
    </div>
  );
}

function ProfileSection({
  title,
  icon,
  children,
}) {
  return (
    <section className="rounded-2xl border border-gray-200 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm text-emerald-600">
          {icon}
        </span>

        <h3 className="text-sm font-bold">
          {title}
        </h3>
      </div>

      {children}
    </section>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <span className="text-xs text-gray-400">
        {label}
      </span>

      <span className="max-w-[65%] text-left text-xs font-bold leading-5 text-gray-700">
        {value}
      </span>
    </div>
  );
}

function OperationMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-[10px] text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function ModalSection({
  title,
  children,
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-gray-900">
        {title}
      </h3>

      <div className="rounded-xl border border-gray-200 p-4">
        {children}
      </div>
    </section>
  );
}

function Input({
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
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
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
        className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 outline-none focus:border-emerald-400 focus:bg-white"
      />
    </label>
  );
}

function Select({
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
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
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

function EmptyState({
  hasEmployees,
  onCreate,
}) {
  return (
    <div className="flex min-h-[500px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 text-4xl">
          🤖
        </div>

        <h2 className="text-xl font-bold">
          {hasEmployees
            ? "لا توجد نتائج"
            : "لا يوجد موظفو AI حتى الآن"}
        </h2>

        <p className="mt-2 text-sm leading-7 text-gray-500">
          {hasEmployees
            ? "جرّب تغيير البحث أو فلتر الحالة."
            : "أنشئ أول موظف AI وابدأ ببناء فريق الذكاء الاصطناعي داخل سوق AI."}
        </p>

        {!hasEmployees && (
          <button
            onClick={onCreate}
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            + إضافة أول موظف AI
          </button>
        )}
      </div>
    </div>
  );
}
