"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const EMPTY_FORM = {
  name: "",
  description: "",
  department_id: "",
  admin_id: "",
  specialization: "",
  personality: "",
  tone: "",
  avatar_url: "",
  status: "active",
  level: "junior",
  instructions: "",
  permissions: {
    products: false,
    marketing: false,
    design: false,
    video: false,
    analytics: false,
    moderation: false,
    publishing: false,
  },
};

const PERMISSION_LABELS = {
  products: "المنتجات",
  marketing: "التسويق",
  design: "التصميم",
  video: "الفيديو",
  analytics: "التحليلات",
  moderation: "المراجعة",
  publishing: "النشر",
};

export default function AIEmployeesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showModal, setShowModal] =
    useState(false);

  const [editingEmployee, setEditingEmployee] =
    useState(null);

  const [form, setForm] = useState(
    EMPTY_FORM
  );

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return false;
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select(
          "id,is_super_admin"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (!profile?.is_super_admin) {
      router.replace("/dashboard");
      return false;
    }

    return true;
  }

  async function loadData() {
    setLoading(true);

    const allowed =
      await checkAccess();

    if (!allowed) {
      setLoading(false);
      return;
    }

    const [
      employeesResult,
      departmentsResult,
      adminsResult,
    ] = await Promise.all([
      supabase
        .from("ai_employees")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("departments")
        .select("*")
        .order("name"),

      supabase
        .from("admins")
        .select("*")
        .order("full_name"),
    ]);

    if (employeesResult.error) {
      console.error(
        "AI EMPLOYEES LOAD ERROR:",
        employeesResult.error
      );
    }

    if (departmentsResult.error) {
      console.error(
        "DEPARTMENTS LOAD ERROR:",
        departmentsResult.error
      );
    }

    if (adminsResult.error) {
      console.error(
        "ADMINS LOAD ERROR:",
        adminsResult.error
      );
    }

    setEmployees(
      employeesResult.data || []
    );

    setDepartments(
      departmentsResult.data || []
    );

    setAdmins(
      adminsResult.data || []
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      permissions: {
        ...EMPTY_FORM.permissions,
      },
    });

    setEditingEmployee(null);
  }

  function openNew() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(employee) {
    setEditingEmployee(employee);

    setForm({
      name: employee.name || "",
      description:
        employee.description || "",
      department_id:
        employee.department_id || "",
      admin_id:
        employee.admin_id || "",
      specialization:
        employee.specialization || "",
      personality:
        employee.personality || "",
      tone:
        employee.tone || "",
      avatar_url:
        employee.avatar_url || "",
      status:
        employee.status || "active",
      level:
        employee.level || "junior",
      instructions:
        employee.instructions || "",
      permissions: {
        products:
          Boolean(
            employee.permissions?.products
          ),
        marketing:
          Boolean(
            employee.permissions?.marketing
          ),
        design:
          Boolean(
            employee.permissions?.design
          ),
        video:
          Boolean(
            employee.permissions?.video
          ),
        analytics:
          Boolean(
            employee.permissions?.analytics
          ),
        moderation:
          Boolean(
            employee.permissions?.moderation
          ),
        publishing:
          Boolean(
            employee.permissions?.publishing
          ),
      },
    });

    setShowModal(true);
  }

  function getDepartmentName(
    departmentId
  ) {
    return (
      departments.find(
        (item) =>
          item.id === departmentId
      )?.name ||
      "بدون قسم"
    );
  }

  function getAdminName(adminId) {
    return (
      admins.find(
        (item) =>
          item.id === adminId
      )?.full_name ||
      "بدون Admin"
    );
  }

  function updatePermission(
    permission,
    value
  ) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [permission]: value,
      },
    }));
  }

  async function saveEmployee() {
    if (!form.name.trim()) {
      alert(
        "اسم موظف AI مطلوب."
      );
      return;
    }

    if (!form.specialization.trim()) {
      alert(
        "تخصص موظف AI مطلوب."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        name: form.name.trim(),

        description:
          form.description.trim() ||
          null,

        department_id:
          form.department_id ||
          null,

        admin_id:
          form.admin_id ||
          null,

        specialization:
          form.specialization.trim(),

        personality:
          form.personality.trim() ||
          null,

        tone:
          form.tone.trim() ||
          null,

        avatar_url:
          form.avatar_url.trim() ||
          null,

        status:
          form.status,

        level:
          form.level,

        instructions:
          form.instructions.trim() ||
          null,

        permissions:
          form.permissions,
      };

      if (editingEmployee) {
        const { error } =
          await supabase
            .from("ai_employees")
            .update({
              ...payload,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              editingEmployee.id
            );

        if (error) {
          throw error;
        }
      } else {
        const { error } =
          await supabase
            .from("ai_employees")
            .insert({
              ...payload,
              created_by:
                user?.id || null,
            });

        if (error) {
          throw error;
        }
      }

      setShowModal(false);
      resetForm();

      await loadData();
    } catch (error) {
      console.error(
        "SAVE AI EMPLOYEE ERROR:",
        error
      );

      alert(
        error?.message ||
          "تعذر حفظ موظف AI."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(
    employee
  ) {
    const newStatus =
      employee.status === "active"
        ? "inactive"
        : "active";

    const { error } =
      await supabase
        .from("ai_employees")
        .update({
          status: newStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          employee.id
        );

    if (error) {
      alert(
        error.message ||
          "تعذر تغيير حالة الموظف."
      );
      return;
    }

    await loadData();
  }

  const filteredEmployees =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      return employees.filter(
        (employee) => {
          const matchesSearch =
            !value ||
            employee.name
              ?.toLowerCase()
              .includes(value) ||
            employee.specialization
              ?.toLowerCase()
              .includes(value) ||
            employee.personality
              ?.toLowerCase()
              .includes(value) ||
            getDepartmentName(
              employee.department_id
            )
              ?.toLowerCase()
              .includes(value) ||
            getAdminName(
              employee.admin_id
            )
              ?.toLowerCase()
              .includes(value);

          const matchesStatus =
            statusFilter === "all" ||
            employee.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      employees,
      search,
      statusFilter,
      departments,
      admins,
    ]);

  const stats = {
    total: employees.length,

    active: employees.filter(
      (item) =>
        item.status === "active"
    ).length,

    inactive: employees.filter(
      (item) =>
        item.status === "inactive"
    ).length,

    suspended: employees.filter(
      (item) =>
        item.status === "suspended"
    ).length,

    tasks: employees.reduce(
      (sum, item) =>
        sum +
        Number(
          item.tasks_completed || 0
        ),
      0
    ),

    cost: employees.reduce(
      (sum, item) =>
        sum +
        Number(
          item.total_cost || 0
        ),
      0
    ),
  };

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-green-50 p-6"
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            جاري تحميل موظفي AI...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-green-50 p-4 md:p-6"
    >
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
                الذكاء الاصطناعي
              </span>

              <h1 className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl">
                موظفو AI
              </h1>

              <p className="mt-2 text-gray-500">
                إدارة الموظفين الذكاء الاصطناعي
                وربطهم بالأقسام والـ Admins.
              </p>
            </div>

            <button
              onClick={openNew}
              className="rounded-2xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700"
            >
              + إضافة موظف AI
            </button>

          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-6">

          <Stat
            label="الإجمالي"
            value={stats.total}
          />

          <Stat
            label="نشط"
            value={stats.active}
            green
          />

          <Stat
            label="غير نشط"
            value={stats.inactive}
          />

          <Stat
            label="موقوف"
            value={stats.suspended}
          />

          <Stat
            label="المهام المكتملة"
            value={stats.tasks}
          />

          <Stat
            label="التكلفة"
            value={`${stats.cost.toFixed(4)} $`}
          />

        </div>

        {/* Search + Filter */}
        <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث عن موظف أو تخصص أو قسم..."
              className="rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500 md:col-span-2"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
            >
              <option value="all">
                جميع الحالات
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

        {/* Employees */}
        <div className="grid gap-5 md:grid-cols-2">

          {filteredEmployees.map(
            (employee) => (
              <div
                key={employee.id}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >

                <div className="flex items-start gap-4">

                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-green-100 text-3xl">
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
                      "🤖"
                    )}
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-xl font-bold text-gray-900">
                        {employee.name}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          employee.status ===
                          "active"
                            ? "bg-green-100 text-green-700"
                            : employee.status ===
                              "suspended"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {employee.status ===
                        "active"
                          ? "نشط"
                          : employee.status ===
                            "suspended"
                          ? "موقوف"
                          : "غير نشط"}
                      </span>

                    </div>

                    <p className="mt-1 font-semibold text-green-700">
                      {
                        employee.specialization
                      }
                    </p>

                    <p className="mt-2 text-sm text-gray-500">
                      القسم:{" "}
                      {getDepartmentName(
                        employee.department_id
                      )}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      المسؤول:{" "}
                      {getAdminName(
                        employee.admin_id
                      )}
                    </p>

                  </div>

                </div>

                {employee.description && (
                  <p className="mt-4 text-sm leading-6 text-gray-500">
                    {employee.description}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">

                  <MiniStat
                    label="المستوى"
                    value={
                      employee.level
                    }
                  />

                  <MiniStat
                    label="نجاح"
                    value={`${Number(
                      employee.success_rate ||
                        0
                    ).toFixed(1)}%`}
                  />

                  <MiniStat
                    label="تقييم"
                    value={`${Number(
                      employee.average_rating ||
                        0
                    ).toFixed(1)}/5`}
                  />

                </div>

                <div className="mt-4 flex flex-wrap gap-2">

                  {Object.entries(
                    employee.permissions ||
                      {}
                  )
                    .filter(
                      ([, enabled]) =>
                        enabled
                    )
                    .map(
                      ([permission]) => (
                        <span
                          key={
                            permission
                          }
                          className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                        >
                          {
                            PERMISSION_LABELS[
                              permission
                            ] ||
                            permission
                          }
                        </span>
                      )
                    )}

                </div>

                <div className="mt-5 flex gap-2">

                  <button
                    onClick={() =>
                      openEdit(
                        employee
                      )
                    }
                    className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-700 hover:bg-gray-200"
                  >
                    تعديل
                  </button>

                  <button
                    onClick={() =>
                      toggleStatus(
                        employee
                      )
                    }
                    className="flex-1 rounded-2xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700"
                  >
                    {employee.status ===
                    "active"
                      ? "تعطيل"
                      : "تفعيل"}
                  </button>

                </div>

              </div>
            )
          )}

          {!filteredEmployees.length && (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm md:col-span-2">

              <div className="text-5xl">
                🤖
              </div>

              <h2 className="mt-4 text-xl font-bold text-gray-900">
                لا يوجد موظفو AI حتى الآن
              </h2>

              <p className="mt-2 text-gray-500">
                أضف أول موظف AI واربطه بالقسم
                والـ Admin المسؤول عنه.
              </p>

              <button
                onClick={openNew}
                className="mt-5 rounded-2xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700"
              >
                + إضافة أول موظف AI
              </button>

            </div>
          )}

        </div>

      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">

          <div className="my-8 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">

            <div className="mb-6 flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingEmployee
                    ? "تعديل موظف AI"
                    : "إضافة موظف AI"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  عرّف شخصية الموظف وتخصصه وصلاحياته.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowModal(false)
                }
                className="rounded-xl bg-gray-100 px-3 py-2"
              >
                ✕
              </button>

            </div>

            <div className="space-y-4">

              <input
                value={form.name}
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="اسم موظف AI"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <input
                value={
                  form.specialization
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      specialization:
                        event.target.value,
                    })
                  )
                }
                placeholder="التخصص — مثال: مساعد التسويق"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <div className="grid gap-4 md:grid-cols-2">

                <select
                  value={
                    form.department_id
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        department_id:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="">
                    اختر القسم
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={
                          department.id
                        }
                        value={
                          department.id
                        }
                      >
                        {
                          department.name
                        }
                      </option>
                    )
                  )}
                </select>

                <select
                  value={
                    form.admin_id
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        admin_id:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="">
                    اختر الـ Admin المسؤول
                  </option>

                  {admins.map(
                    (admin) => (
                      <option
                        key={admin.id}
                        value={admin.id}
                      >
                        {
                          admin.full_name
                        }
                      </option>
                    )
                  )}
                </select>

              </div>

              <div className="grid gap-4 md:grid-cols-2">

                <input
                  value={
                    form.personality
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (current) => ({
                        ...current,
                        personality:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="الشخصية — مثال: هادئ، دقيق، عملي"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />

                <input
                  value={form.tone}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        tone:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="أسلوب الكلام — مثال: إماراتي احترافي"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                />

              </div>

              <div className="grid gap-4 md:grid-cols-2">

                <select
                  value={form.level}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        level:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="junior">
                    Junior
                  </option>

                  <option value="mid">
                    Mid
                  </option>

                  <option value="senior">
                    Senior
                  </option>

                  <option value="expert">
                    Expert
                  </option>
                </select>

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
                >
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

              <input
                value={
                  form.avatar_url
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      avatar_url:
                        event.target
                          .value,
                    })
                  )
                }
                placeholder="رابط صورة الموظف (اختياري)"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <textarea
                value={
                  form.description
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      description:
                        event.target
                          .value,
                    })
                  )
                }
                placeholder="وصف الموظف ومسؤولياته"
                rows={3}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <textarea
                value={
                  form.instructions
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      instructions:
                        event.target
                          .value,
                    })
                  )
                }
                placeholder="تعليمات خاصة للموظف AI"
                rows={5}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              {/* Permissions */}
              <div className="rounded-3xl bg-green-50 p-5">

                <h3 className="mb-4 font-bold text-gray-900">
                  صلاحيات الموظف AI
                </h3>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                  {Object.entries(
                    PERMISSION_LABELS
                  ).map(
                    ([
                      key,
                      label,
                    ]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-2xl bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            form
                              .permissions[
                              key
                            ]
                          )}
                          onChange={(
                            event
                          ) =>
                            updatePermission(
                              key,
                              event
                                .target
                                .checked
                            )
                          }
                        />

                        <span className="text-sm font-semibold text-gray-700">
                          {label}
                        </span>
                      </label>
                    )
                  )}

                </div>

              </div>

              <button
                disabled={saving}
                onClick={
                  saveEmployee
                }
                className="w-full rounded-2xl bg-green-600 px-4 py-4 font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving
                  ? "جاري الحفظ..."
                  : editingEmployee
                  ? "حفظ التعديلات"
                  : "إنشاء موظف AI"}
              </button>

            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function Stat({
  label,
  value,
  green = false,
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-bold ${
          green
            ? "text-green-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3 text-center">
      <div className="text-xs text-gray-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-gray-900">
        {value}
      </div>
    </div>
  );
}
