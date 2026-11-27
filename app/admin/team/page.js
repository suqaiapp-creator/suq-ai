"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function AdminTeamPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [activeTab, setActiveTab] = useState("departments");

  const [search, setSearch] = useState("");

  const [showDepartmentModal, setShowDepartmentModal] =
    useState(false);

  const [showAdminModal, setShowAdminModal] =
    useState(false);

  const [editingDepartment, setEditingDepartment] =
    useState(null);

  const [editingAdmin, setEditingAdmin] =
    useState(null);

  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    description: "",
    status: "active",
  });

  const [adminForm, setAdminForm] = useState({
    user_id: "",
    department_id: "",
    full_name: "",
    title: "",
    specialization: "",
    description: "",
    status: "active",
    permissions: {
      products: false,
      marketing: false,
      design: false,
      video: false,
      analytics: false,
      moderation: false,
      publishing: false,
    },
  });

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return false;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id,is_super_admin")
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

    const allowed = await checkAccess();

    if (!allowed) {
      setLoading(false);
      return;
    }

    const [
      departmentsResult,
      adminsResult,
      profilesResult,
    ] = await Promise.all([
      supabase
        .from("departments")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("admins")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("profiles")
        .select(
          "id,full_name,phone,role,account_status,is_super_admin"
        )
        .order("created_at", {
          ascending: false,
        }),
    ]);

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

    if (profilesResult.error) {
      console.error(
        "PROFILES LOAD ERROR:",
        profilesResult.error
      );
    }

    setDepartments(
      departmentsResult.data || []
    );

    setAdmins(
      adminsResult.data || []
    );

    setProfiles(
      profilesResult.data || []
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetDepartmentForm() {
    setDepartmentForm({
      name: "",
      description: "",
      status: "active",
    });

    setEditingDepartment(null);
  }

  function resetAdminForm() {
    setAdminForm({
      user_id: "",
      department_id: "",
      full_name: "",
      title: "",
      specialization: "",
      description: "",
      status: "active",
      permissions: {
        products: false,
        marketing: false,
        design: false,
        video: false,
        analytics: false,
        moderation: false,
        publishing: false,
      },
    });

    setEditingAdmin(null);
  }

  function openNewDepartment() {
    resetDepartmentForm();
    setShowDepartmentModal(true);
  }

  function openEditDepartment(department) {
    setEditingDepartment(department);

    setDepartmentForm({
      name: department.name || "",
      description:
        department.description || "",
      status:
        department.status || "active",
    });

    setShowDepartmentModal(true);
  }

  async function saveDepartment() {
    if (!departmentForm.name.trim()) {
      alert("اسم القسم مطلوب.");
      return;
    }

    setSaving(true);

    try {
      if (editingDepartment) {
        const { error } = await supabase
          .from("departments")
          .update({
            name:
              departmentForm.name.trim(),
            description:
              departmentForm.description.trim() ||
              null,
            status:
              departmentForm.status,
            updated_at: new Date().toISOString(),
          })
          .eq(
            "id",
            editingDepartment.id
          );

        if (error) {
          throw error;
        }
      } else {
        const {
          data: {
            user,
          },
        } = await supabase.auth.getUser();

        const { error } = await supabase
          .from("departments")
          .insert({
            name:
              departmentForm.name.trim(),
            description:
              departmentForm.description.trim() ||
              null,
            status:
              departmentForm.status,
            created_by: user?.id || null,
          });

        if (error) {
          throw error;
        }
      }

      setShowDepartmentModal(false);
      resetDepartmentForm();

      await loadData();
    } catch (error) {
      console.error(
        "SAVE DEPARTMENT ERROR:",
        error
      );

      alert(
        error?.message ||
          "تعذر حفظ القسم."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleDepartment(
    department
  ) {
    const newStatus =
      department.status === "active"
        ? "inactive"
        : "active";

    const { error } = await supabase
      .from("departments")
      .update({
        status: newStatus,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        department.id
      );

    if (error) {
      alert(
        error.message ||
          "تعذر تحديث حالة القسم."
      );
      return;
    }

    await loadData();
  }

  function openNewAdmin() {
    resetAdminForm();
    setShowAdminModal(true);
  }

  function openEditAdmin(admin) {
    setEditingAdmin(admin);

    setAdminForm({
      user_id:
        admin.user_id || "",
      department_id:
        admin.department_id || "",
      full_name:
        admin.full_name || "",
      title:
        admin.title || "",
      specialization:
        admin.specialization || "",
      description:
        admin.description || "",
      status:
        admin.status || "active",
      permissions: {
        products:
          Boolean(
            admin.permissions?.products
          ),
        marketing:
          Boolean(
            admin.permissions?.marketing
          ),
        design:
          Boolean(
            admin.permissions?.design
          ),
        video:
          Boolean(
            admin.permissions?.video
          ),
        analytics:
          Boolean(
            admin.permissions?.analytics
          ),
        moderation:
          Boolean(
            admin.permissions?.moderation
          ),
        publishing:
          Boolean(
            admin.permissions?.publishing
          ),
      },
    });

    setShowAdminModal(true);
  }

  function selectProfile(userId) {
    const profile = profiles.find(
      (item) =>
        item.id === userId
    );

    if (!profile) {
      return;
    }

    setAdminForm((current) => ({
      ...current,
      user_id: userId,
      full_name:
        profile.full_name || "",
    }));
  }

  async function saveAdmin() {
    if (!adminForm.user_id) {
      alert(
        "اختر مستخدمًا للحساب الإداري."
      );
      return;
    }

    if (!adminForm.full_name.trim()) {
      alert(
        "اسم الـ Admin مطلوب."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      const payload = {
        user_id:
          adminForm.user_id,
        department_id:
          adminForm.department_id ||
          null,
        full_name:
          adminForm.full_name.trim(),
        title:
          adminForm.title.trim() ||
          null,
        specialization:
          adminForm.specialization.trim() ||
          null,
        description:
          adminForm.description.trim() ||
          null,
        status:
          adminForm.status,
        permissions:
          adminForm.permissions,
      };

      if (editingAdmin) {
        const { error } = await supabase
          .from("admins")
          .update({
            ...payload,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            editingAdmin.id
          );

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("admins")
          .insert({
            ...payload,
            created_by:
              user?.id || null,
          });

        if (error) {
          throw error;
        }
      }

      setShowAdminModal(false);
      resetAdminForm();

      await loadData();
    } catch (error) {
      console.error(
        "SAVE ADMIN ERROR:",
        error
      );

      alert(
        error?.message ||
          "تعذر حفظ الـ Admin."
      );
    } finally {
      setSaving(false);
    }
  }

  function getDepartmentName(
    departmentId
  ) {
    return (
      departments.find(
        (department) =>
          department.id ===
          departmentId
      )?.name ||
      "بدون قسم"
    );
  }

  const filteredDepartments =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return departments;
      }

      return departments.filter(
        (department) =>
          department.name
            ?.toLowerCase()
            .includes(value) ||
          department.description
            ?.toLowerCase()
            .includes(value)
      );
    }, [
      departments,
      search,
    ]);

  const filteredAdmins =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return admins;
      }

      return admins.filter(
        (admin) =>
          admin.full_name
            ?.toLowerCase()
            .includes(value) ||
          admin.title
            ?.toLowerCase()
            .includes(value) ||
          admin.specialization
            ?.toLowerCase()
            .includes(value) ||
          getDepartmentName(
            admin.department_id
          )
            ?.toLowerCase()
            .includes(value)
      );
    }, [
      admins,
      search,
      departments,
    ]);

  const availableProfiles =
    profiles.filter(
      (profile) =>
        !profile.is_super_admin &&
        (
          !admins.some(
            (admin) =>
              admin.user_id ===
              profile.id
          ) ||
          editingAdmin?.user_id ===
            profile.id
        )
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-green-50 p-6 text-right">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            جاري تحميل إدارة الشركة...
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
              <div className="mb-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                إدارة الشركة
              </div>

              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                الأقسام والـ Admins
              </h1>

              <p className="mt-2 text-gray-500">
                إدارة هيكل سوق AI الداخلي
                وربط كل Admin بتخصصه وقسمه وصلاحياته.
              </p>
            </div>

            <button
              onClick={() =>
                activeTab ===
                "departments"
                  ? openNewDepartment()
                  : openNewAdmin()
              }
              className="rounded-2xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700"
            >
              +{" "}
              {activeTab ===
              "departments"
                ? "إضافة قسم"
                : "إضافة Admin"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              الأقسام
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {departments.length}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              الأقسام النشطة
            </div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {
                departments.filter(
                  (item) =>
                    item.status ===
                    "active"
                ).length
              }
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              Admins
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {admins.length}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              Admins النشطون
            </div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {
                admins.filter(
                  (item) =>
                    item.status ===
                    "active"
                ).length
              }
            </div>
          </div>

        </div>

        {/* Tabs */}
        <div className="mb-6 rounded-3xl bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">

            <button
              onClick={() => {
                setActiveTab(
                  "departments"
                );
                setSearch("");
              }}
              className={`rounded-2xl px-4 py-3 font-bold transition ${
                activeTab ===
                "departments"
                  ? "bg-green-600 text-white"
                  : "text-gray-600 hover:bg-green-50"
              }`}
            >
              الأقسام
            </button>

            <button
              onClick={() => {
                setActiveTab("admins");
                setSearch("");
              }}
              className={`rounded-2xl px-4 py-3 font-bold transition ${
                activeTab ===
                "admins"
                  ? "bg-green-600 text-white"
                  : "text-gray-600 hover:bg-green-50"
              }`}
            >
              Admins
            </button>

          </div>
        </div>

        {/* Search */}
        <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder={
              activeTab ===
              "departments"
                ? "ابحث عن قسم..."
                : "ابحث عن Admin أو تخصص أو قسم..."
            }
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none transition focus:border-green-500"
          />
        </div>

        {/* Departments */}
        {activeTab ===
          "departments" && (
          <div className="grid gap-4 md:grid-cols-2">

            {filteredDepartments.map(
              (department) => (
                <div
                  key={department.id}
                  className="rounded-3xl bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {department.name}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {department.description ||
                          "لا يوجد وصف للقسم."}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        department.status ===
                        "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {department.status ===
                      "active"
                        ? "نشط"
                        : "غير نشط"}
                    </span>

                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">

                    <button
                      onClick={() =>
                        openEditDepartment(
                          department
                        )
                      }
                      className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                    >
                      تعديل
                    </button>

                    <button
                      onClick={() =>
                        toggleDepartment(
                          department
                        )
                      }
                      className="rounded-xl bg-green-100 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-200"
                    >
                      {department.status ===
                      "active"
                        ? "تعطيل"
                        : "تفعيل"}
                    </button>

                  </div>
                </div>
              )
            )}

            {!filteredDepartments.length && (
              <div className="rounded-3xl bg-white p-10 text-center text-gray-500 md:col-span-2">
                لا توجد أقسام مطابقة.
              </div>
            )}

          </div>
        )}

        {/* Admins */}
        {activeTab ===
          "admins" && (
          <div className="grid gap-4 md:grid-cols-2">

            {filteredAdmins.map(
              (admin) => (
                <div
                  key={admin.id}
                  className="rounded-3xl bg-white p-6 shadow-sm"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {admin.full_name}
                      </h2>

                      <p className="mt-1 text-sm font-semibold text-green-700">
                        {admin.title ||
                          "Admin"}
                      </p>

                      <p className="mt-2 text-sm text-gray-500">
                        القسم:{" "}
                        {getDepartmentName(
                          admin.department_id
                        )}
                      </p>

                      {admin.specialization && (
                        <p className="mt-1 text-sm text-gray-500">
                          التخصص:{" "}
                          {
                            admin.specialization
                          }
                        </p>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        admin.status ===
                        "active"
                          ? "bg-green-100 text-green-700"
                          : admin.status ===
                            "suspended"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {admin.status ===
                      "active"
                        ? "نشط"
                        : admin.status ===
                          "suspended"
                        ? "موقوف"
                        : "غير نشط"}
                    </span>

                  </div>

                  {admin.description && (
                    <p className="mt-4 text-sm leading-6 text-gray-500">
                      {admin.description}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">

                    {Object.entries(
                      admin.permissions || {}
                    )
                      .filter(
                        ([, enabled]) =>
                          enabled
                      )
                      .map(
                        ([
                          permission,
                        ]) => (
                          <span
                            key={
                              permission
                            }
                            className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                          >
                            {permission}
                          </span>
                        )
                      )}

                  </div>

                  <button
                    onClick={() =>
                      openEditAdmin(
                        admin
                      )
                    }
                    className="mt-5 w-full rounded-2xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700"
                  >
                    تعديل Admin
                  </button>

                </div>
              )
            )}

            {!filteredAdmins.length && (
              <div className="rounded-3xl bg-white p-10 text-center text-gray-500 md:col-span-2">
                لا يوجد Admins حتى الآن.
              </div>
            )}

          </div>
        )}

      </div>

      {/* Department Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">

            <div className="mb-5 flex items-center justify-between">

              <h2 className="text-xl font-bold text-gray-900">
                {editingDepartment
                  ? "تعديل القسم"
                  : "إضافة قسم"}
              </h2>

              <button
                onClick={() =>
                  setShowDepartmentModal(
                    false
                  )
                }
                className="rounded-xl bg-gray-100 px-3 py-2"
              >
                ✕
              </button>

            </div>

            <div className="space-y-4">

              <input
                value={
                  departmentForm.name
                }
                onChange={(event) =>
                  setDepartmentForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="اسم القسم"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <textarea
                value={
                  departmentForm.description
                }
                onChange={(event) =>
                  setDepartmentForm(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    })
                  )
                }
                placeholder="وصف القسم"
                rows={4}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <select
                value={
                  departmentForm.status
                }
                onChange={(event) =>
                  setDepartmentForm(
                    (current) => ({
                      ...current,
                      status:
                        event.target.value,
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
              </select>

              <button
                disabled={saving}
                onClick={
                  saveDepartment
                }
                className="w-full rounded-2xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving
                  ? "جاري الحفظ..."
                  : "حفظ القسم"}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">

          <div className="my-8 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">

            <div className="mb-5 flex items-center justify-between">

              <h2 className="text-xl font-bold text-gray-900">
                {editingAdmin
                  ? "تعديل Admin"
                  : "إضافة Admin"}
              </h2>

              <button
                onClick={() =>
                  setShowAdminModal(
                    false
                  )
                }
                className="rounded-xl bg-gray-100 px-3 py-2"
              >
                ✕
              </button>

            </div>

            <div className="space-y-4">

              <select
                value={
                  adminForm.user_id
                }
                onChange={(event) =>
                  selectProfile(
                    event.target.value
                  )
                }
                disabled={
                  Boolean(editingAdmin)
                }
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500 disabled:bg-gray-100"
              >
                <option value="">
                  اختر حساب المستخدم
                </option>

                {availableProfiles.map(
                  (profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.full_name ||
                        profile.phone ||
                        profile.id}
                    </option>
                  )
                )}
              </select>

              <input
                value={
                  adminForm.full_name
                }
                onChange={(event) =>
                  setAdminForm(
                    (current) => ({
                      ...current,
                      full_name:
                        event.target.value,
                    })
                  )
                }
                placeholder="اسم الـ Admin"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <input
                value={
                  adminForm.title
                }
                onChange={(event) =>
                  setAdminForm(
                    (current) => ({
                      ...current,
                      title:
                        event.target.value,
                    })
                  )
                }
                placeholder="المسمى الوظيفي"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <select
                value={
                  adminForm.department_id
                }
                onChange={(event) =>
                  setAdminForm(
                    (current) => ({
                      ...current,
                      department_id:
                        event.target.value,
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

              <input
                value={
                  adminForm.specialization
                }
                onChange={(event) =>
                  setAdminForm(
                    (current) => ({
                      ...current,
                      specialization:
                        event.target.value,
                    })
                  )
                }
                placeholder="التخصص"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <textarea
                value={
                  adminForm.description
                }
                onChange={(event) =>
                  setAdminForm(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    })
                  )
                }
                placeholder="وصف ومسؤوليات الـ Admin"
                rows={4}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
              />

              <select
                value={
                  adminForm.status
                }
                onChange={(event) =>
                  setAdminForm(
                    (current) => ({
                      ...current,
                      status:
                        event.target.value,
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

              <div className="rounded-2xl bg-green-50 p-4">

                <h3 className="mb-3 font-bold text-gray-900">
                  صلاحيات الـ Admin
                </h3>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">

                  {[
                    [
                      "products",
                      "المنتجات",
                    ],
                    [
                      "marketing",
                      "التسويق",
                    ],
                    [
                      "design",
                      "التصميم",
                    ],
                    [
                      "video",
                      "الفيديو",
                    ],
                    [
                      "analytics",
                      "التحليلات",
                    ],
                    [
                      "moderation",
                      "المراجعة",
                    ],
                    [
                      "publishing",
                      "النشر",
                    ],
                  ].map(
                    ([
                      key,
                      label,
                    ]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-xl bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            adminForm
                              .permissions[
                              key
                            ]
                          )}
                          onChange={(
                            event
                          ) =>
                            setAdminForm(
                              (current) => ({
                                ...current,
                                permissions:
                                  {
                                    ...current.permissions,
                                    [key]:
                                      event
                                        .target
                                        .checked,
                                  },
                              })
                            )
                          }
                        />

                        <span className="text-sm font-semibold">
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
                  saveAdmin
                }
                className="w-full rounded-2xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving
                  ? "جاري الحفظ..."
                  : "حفظ Admin"}
              </button>

            </div>
          </div>
        </div>
      )}

    </main>
  );
}
