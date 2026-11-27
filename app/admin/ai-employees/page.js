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

const PERMISSIONS = [
  ["products", "المنتجات"],
  ["marketing", "التسويق"],
  ["design", "التصميم"],
  ["video", "الفيديو"],
  ["analytics", "التحليلات"],
  ["moderation", "المراجعة"],
  ["publishing", "النشر"],
  ["tasks", "المهام"],
];

const LEVELS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "expert", label: "Expert" },
];

function statusText(status) {
  if (status === "active") return "نشط";
  if (status === "inactive") return "غير نشط";
  if (status === "suspended") return "موقوف";
  return "غير محدد";
}

function levelText(level) {
  return (
    LEVELS.find((item) => item.value === level)?.label ||
    level ||
    "—"
  );
}

function money(value) {
  return Number(value || 0).toFixed(4);
}

function number(value) {
  return Number(value || 0).toLocaleString("en-US");
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
  const [filter, setFilter] = useState("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [notice, setNotice] = useState("");
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
          .order("name"),

        supabase
          .from("admins")
          .select("*")
          .order("full_name"),

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

      const list = employeesResult.data || [];

      setEmployees(list);
      setDepartments(departmentsResult.data || []);
      setAdmins(adminsResult.data || []);
      setProfiles(profilesResult.data || []);

      if (list.length === 0) {
        setSelectedId(null);
      } else if (
        !selectedId ||
        !list.some((item) => item.id === selectedId)
      ) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || "تعذر تحميل موظفي الذكاء الاصطناعي"
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
        (item) => item.status === "active"
      ).length,
      inactive: employees.filter(
        (item) => item.status === "inactive"
      ).length,
      suspended: employees.filter(
        (item) => item.status === "suspended"
      ).length,
      tasks: employees.reduce(
        (sum, item) =>
          sum + Number(item.tasks_completed || 0),
        0
      ),
      cost: employees.reduce(
        (sum, item) =>
          sum + Number(item.total_cost || 0),
        0
      ),
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const department = departments.find(
        (item) => item.id === employee.department_id
      );

      const matchesSearch =
        !q ||
        employee.name?.toLowerCase().includes(q) ||
        employee.specialization
          ?.toLowerCase()
          .includes(q) ||
        department?.name?.toLowerCase().includes(q);

      const matchesFilter =
        filter === "all" ||
        employee.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [
    employees,
    departments,
    search,
    filter,
  ]);

  const selectedEmployee = employees.find(
    (item) => item.id === selectedId
  );

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

    if (!admin) return "بدون Admin";

    const profile = profiles.find(
      (item) => item.id === admin.user_id
    );

    return (
      admin.full_name ||
      profile?.full_name ||
      "Admin"
    );
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      permissions: {
        ...EMPTY_FORM.permissions,
      },
    });
    setError("");
    setNotice("");
    setEditorOpen(true);
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
    setNotice("");
    setEditorOpen(true);
  }

  function updateForm(field, value) {
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

    if (!form.name.trim()) {
      setError("اكتب اسم موظف AI أولاً");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

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

        setNotice("تم تحديث موظف AI");
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

        setNotice("تم إنشاء موظف AI");
      }

      setEditorOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر حفظ الموظف");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(employee) {
    setError("");

    const next =
      employee.status === "active"
        ? "inactive"
        : "active";

    try {
      const { error: updateError } =
        await supabase
          .from("ai_employees")
          .update({
            status: next,
            updated_at: new Date().toISOString(),
          })
          .eq("id", employee.id);

      if (updateError) throw updateError;

      setNotice(
        next === "active"
          ? "تم تفعيل الموظف"
          : "تم إيقاف الموظف"
      );

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "تعذر تغيير حالة الموظف"
      );
    }
  }

  if (loading) {
    return (
      <main className="ai-page" dir="rtl">
        <div className="loading-box">
          <div className="loading-spinner" />
          <div>جاري تحميل موظفي AI...</div>
        </div>

        <Styles />
      </main>
    );
  }

  return (
    <main className="ai-page" dir="rtl">
      <Styles />

      <div className="ai-shell">

        {/* HEADER */}
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              الإدارة الداخلية
              <span>/</span>
              موظفو AI
            </div>

            <div className="title-row">
              <div className="title-mark">
                AI
              </div>

              <div>
                <h1>موظفو الذكاء الاصطناعي</h1>

                <p>
                  إدارة موظفي AI وربطهم بالأقسام
                  والـ Admins والصلاحيات.
                </p>
              </div>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={openCreate}
          >
            <span>＋</span>
            موظف AI جديد
          </button>
        </header>

        {/* NOTICES */}
        {notice && (
          <div className="notice success">
            <span>✓</span>
            {notice}
          </div>
        )}

        {error && (
          <div className="notice danger">
            <span>!</span>
            {error}
          </div>
        )}

        {/* STATS */}
        <section className="stats-grid">
          <Stat
            label="إجمالي الموظفين"
            value={stats.total}
            main
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
            value={number(stats.tasks)}
          />

          <Stat
            label="التكلفة"
            value={`${money(stats.cost)} $`}
          />
        </section>

        {/* MAIN WORKSPACE */}
        <section className="workspace">

          {/* TOOLBAR */}
          <div className="toolbar">
            <div className="toolbar-title">
              <strong>فريق AI</strong>
              <span>{filteredEmployees.length}</span>
            </div>

            <div className="toolbar-actions">
              <div className="search">
                <span>⌕</span>

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="ابحث عن موظف..."
                />
              </div>

              <select
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value)
                }
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
            <Empty
              hasEmployees={
                employees.length > 0
              }
              onCreate={openCreate}
            />
          ) : (
            <div className="employee-layout">

              {/* EMPLOYEE LIST */}
              <aside className="employee-list">
                <div className="list-heading">
                  <span>الموظفون</span>
                  <b>
                    {filteredEmployees.length}
                  </b>
                </div>

                {filteredEmployees.map(
                  (employee) => {
                    const active =
                      employee.id === selectedId;

                    return (
                      <button
                        key={employee.id}
                        className={`employee-item ${
                          active ? "selected" : ""
                        }`}
                        onClick={() =>
                          setSelectedId(
                            employee.id
                          )
                        }
                      >
                        <div className="avatar">
                          {employee.avatar_url ? (
                            <img
                              src={
                                employee.avatar_url
                              }
                              alt=""
                            />
                          ) : (
                            <span>AI</span>
                          )}

                          <i
                            className={
                              employee.status ===
                              "active"
                                ? "online"
                                : ""
                            }
                          />
                        </div>

                        <div className="employee-summary">
                          <strong>
                            {employee.name}
                          </strong>

                          <small>
                            {employee.specialization ||
                              "موظف AI"}
                          </small>

                          <em>
                            {departmentName(
                              employee.department_id
                            )}
                          </em>
                        </div>

                        {active && (
                          <div className="selected-line" />
                        )}
                      </button>
                    );
                  }
                )}
              </aside>

              {/* PROFILE */}
              <div className="profile">

                {selectedEmployee && (
                  <>
                    <div className="profile-header">
                      <div className="profile-identity">
                        <div className="big-avatar">
                          {selectedEmployee.avatar_url ? (
                            <img
                              src={
                                selectedEmployee.avatar_url
                              }
                              alt=""
                            />
                          ) : (
                            <span>AI</span>
                          )}
                        </div>

                        <div>
                          <div className="profile-name">
                            <h2>
                              {selectedEmployee.name}
                            </h2>

                            <span
                              className={`status ${
                                selectedEmployee.status
                              }`}
                            >
                              <i />
                              {statusText(
                                selectedEmployee.status
                              )}
                            </span>
                          </div>

                          <p>
                            {selectedEmployee.specialization ||
                              "موظف ذكاء اصطناعي"}
                          </p>

                          <div className="meta">
                            <span>
                              {departmentName(
                                selectedEmployee.department_id
                              )}
                            </span>

                            <span>•</span>

                            <span>
                              {levelText(
                                selectedEmployee.level
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="profile-actions">
                        <button
                          className="secondary-button"
                          onClick={() =>
                            openEdit(
                              selectedEmployee
                            )
                          }
                        >
                          تعديل الموظف
                        </button>

                        <button
                          className="dark-button"
                          onClick={() =>
                            toggleStatus(
                              selectedEmployee
                            )
                          }
                        >
                          {selectedEmployee.status ===
                          "active"
                            ? "إيقاف الموظف"
                            : "تفعيل الموظف"}
                        </button>
                      </div>
                    </div>

                    {/* PERFORMANCE */}
                    <div className="performance">
                      <Metric
                        label="المهام المكتملة"
                        value={number(
                          selectedEmployee.tasks_completed
                        )}
                      />

                      <Metric
                        label="نسبة النجاح"
                        value={`${Number(
                          selectedEmployee.success_rate ||
                            0
                        ).toFixed(1)}%`}
                      />

                      <Metric
                        label="التقييم"
                        value={`${Number(
                          selectedEmployee.average_rating ||
                            0
                        ).toFixed(1)} / 5`}
                      />

                      <Metric
                        label="التكلفة"
                        value={`${money(
                          selectedEmployee.total_cost
                        )} $`}
                      />
                    </div>

                    {/* INFO GRID */}
                    <div className="content-grid">

                      <InfoBox title="الهيكل الإداري">
                        <InfoRow
                          label="القسم"
                          value={departmentName(
                            selectedEmployee.department_id
                          )}
                        />

                        <InfoRow
                          label="Admin المسؤول"
                          value={adminName(
                            selectedEmployee.admin_id
                          )}
                        />

                        <InfoRow
                          label="المستوى"
                          value={levelText(
                            selectedEmployee.level
                          )}
                        />

                        <InfoRow
                          label="الحالة"
                          value={statusText(
                            selectedEmployee.status
                          )}
                        />
                      </InfoBox>

                      <InfoBox title="الشخصية والأسلوب">
                        <InfoRow
                          label="الشخصية"
                          value={
                            selectedEmployee.personality ||
                            "غير محددة"
                          }
                        />

                        <InfoRow
                          label="الأسلوب"
                          value={
                            selectedEmployee.tone ||
                            "غير محدد"
                          }
                        />
                      </InfoBox>

                      <InfoBox
                        title="الصلاحيات"
                        wide
                      >
                        <div className="permissions">
                          {PERMISSIONS.map(
                            ([key, label]) => {
                              const enabled =
                                !!(
                                  selectedEmployee
                                    .permissions || {}
                                )[key];

                              return (
                                <div
                                  key={key}
                                  className={`permission ${
                                    enabled
                                      ? "enabled"
                                      : ""
                                  }`}
                                >
                                  <span>
                                    {enabled
                                      ? "✓"
                                      : "—"}
                                  </span>

                                  {label}
                                </div>
                              );
                            }
                          )}
                        </div>
                      </InfoBox>

                      <InfoBox
                        title="وصف الموظف"
                        wide
                      >
                        <p className="description">
                          {selectedEmployee.description ||
                            "لم تتم إضافة وصف لهذا الموظف."}
                        </p>
                      </InfoBox>

                      <InfoBox
                        title="تعليمات التشغيل"
                        wide
                      >
                        <p className="description">
                          {selectedEmployee.instructions ||
                            "لم تتم إضافة تعليمات تشغيل لهذا الموظف."}
                        </p>
                      </InfoBox>

                      <InfoBox
                        title="الأداء التشغيلي"
                        wide
                      >
                        <div className="operation-grid">
                          <Operation
                            label="المهام المكتملة"
                            value={number(
                              selectedEmployee.tasks_completed
                            )}
                          />

                          <Operation
                            label="المهام الفاشلة"
                            value={number(
                              selectedEmployee.tasks_failed
                            )}
                          />

                          <Operation
                            label="متوسط السرعة"
                            value={`${Number(
                              selectedEmployee.average_speed_seconds ||
                                0
                            ).toFixed(0)} ثانية`}
                          />
                        </div>
                      </InfoBox>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* EDITOR */}
      {editorOpen && (
        <Editor
          form={form}
          editingId={editingId}
          saving={saving}
          departments={departments}
          admins={admins}
          profiles={profiles}
          updateForm={updateForm}
          togglePermission={
            togglePermission
          }
          onClose={() =>
            setEditorOpen(false)
          }
          onSave={saveEmployee}
        />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  green,
  main,
}) {
  return (
    <div
      className={`stat ${
        main ? "main" : ""
      }`}
    >
      <span>{label}</span>

      <strong
        className={green ? "green" : ""}
      >
        {value}
      </strong>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoBox({
  title,
  children,
  wide,
}) {
  return (
    <div
      className={`info-box ${
        wide ? "wide" : ""
      }`}
    >
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Operation({ label, value }) {
  return (
    <div className="operation">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({
  hasEmployees,
  onCreate,
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        AI
      </div>

      <h2>
        {hasEmployees
          ? "لا توجد نتائج"
          : "لا يوجد موظفو AI حتى الآن"}
      </h2>

      <p>
        {hasEmployees
          ? "غيّر البحث أو فلتر الحالة."
          : "أنشئ أول موظف AI داخل سوق AI."}
      </p>

      {!hasEmployees && (
        <button
          className="primary-button"
          onClick={onCreate}
        >
          ＋ إضافة أول موظف
        </button>
      )}
    </div>
  );
}

function Editor({
  form,
  editingId,
  saving,
  departments,
  admins,
  profiles,
  updateForm,
  togglePermission,
  onClose,
  onSave,
}) {
  return (
    <div className="editor-overlay">
      <div className="editor">

        <div className="editor-header">
          <div>
            <span>AI EMPLOYEE</span>
            <h2>
              {editingId
                ? "تعديل موظف AI"
                : "موظف AI جديد"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="close-button"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSave}>
          <div className="form-content">

            <FormSection title="البيانات الأساسية">
              <div className="form-grid">
                <Field
                  label="اسم الموظف"
                  required
                  value={form.name}
                  onChange={(value) =>
                    updateForm(
                      "name",
                      value
                    )
                  }
                  placeholder="مثال: والم"
                />

                <Field
                  label="التخصص"
                  value={
                    form.specialization
                  }
                  onChange={(value) =>
                    updateForm(
                      "specialization",
                      value
                    )
                  }
                  placeholder="مثال: مساعد إدارة وتشغيل"
                />

                <SelectField
                  label="المستوى"
                  value={form.level}
                  onChange={(value) =>
                    updateForm(
                      "level",
                      value
                    )
                  }
                  options={LEVELS}
                />

                <SelectField
                  label="الحالة"
                  value={form.status}
                  onChange={(value) =>
                    updateForm(
                      "status",
                      value
                    )
                  }
                  options={[
                    {
                      value: "active",
                      label: "نشط",
                    },
                    {
                      value: "inactive",
                      label: "غير نشط",
                    },
                    {
                      value: "suspended",
                      label: "موقوف",
                    },
                  ]}
                />
              </div>
            </FormSection>

            <FormSection title="الهيكل الإداري">
              <div className="form-grid">
                <SelectField
                  label="القسم"
                  value={
                    form.department_id
                  }
                  onChange={(value) =>
                    updateForm(
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

                <SelectField
                  label="Admin المسؤول"
                  value={form.admin_id}
                  onChange={(value) =>
                    updateForm(
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
                      (admin) => {
                        const profile =
                          profiles.find(
                            (item) =>
                              item.id ===
                              admin.user_id
                          );

                        return {
                          value: admin.id,
                          label:
                            admin.full_name ||
                            profile?.full_name ||
                            "Admin",
                        };
                      }
                    ),
                  ]}
                />
              </div>
            </FormSection>

            <FormSection title="الشخصية">
              <div className="form-grid">
                <Field
                  label="الشخصية"
                  value={
                    form.personality
                  }
                  onChange={(value) =>
                    updateForm(
                      "personality",
                      value
                    )
                  }
                  placeholder="دقيق، عملي، مبادر..."
                />

                <Field
                  label="أسلوب الكلام"
                  value={form.tone}
                  onChange={(value) =>
                    updateForm(
                      "tone",
                      value
                    )
                  }
                  placeholder="إماراتية احترافية وودية"
                />
              </div>
            </FormSection>

            <FormSection title="التعريف والتعليمات">
              <TextArea
                label="وصف الموظف"
                value={form.description}
                onChange={(value) =>
                  updateForm(
                    "description",
                    value
                  )
                }
                placeholder="اكتب دور الموظف داخل سوق AI..."
              />

              <TextArea
                label="تعليمات التشغيل"
                value={form.instructions}
                onChange={(value) =>
                  updateForm(
                    "instructions",
                    value
                  )
                }
                placeholder="ما الذي يجب على الموظف فعله وما الذي يجب عليه تجنبه؟"
              />
            </FormSection>

            <FormSection title="الصلاحيات">
              <div className="permission-editor">
                {PERMISSIONS.map(
                  ([key, label]) => {
                    const enabled =
                      !!form.permissions[
                        key
                      ];

                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() =>
                          togglePermission(
                            key
                          )
                        }
                        className={`permission-option ${
                          enabled
                            ? "active"
                            : ""
                        }`}
                      >
                        <span>
                          {enabled
                            ? "✓"
                            : ""}
                        </span>

                        {label}
                      </button>
                    );
                  }
                )}
              </div>
            </FormSection>
          </div>

          <div className="editor-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
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

function FormSection({
  title,
  children,
}) {
  return (
    <section className="form-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && (
          <b>*</b>
        )}
      </span>

      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="field full">
      <span>{label}</span>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        rows={4}
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
    <label className="field">
      <span>{label}</span>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
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

function Styles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #f5f7f6;
        color: #111827;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
      }

      button,
      input,
      select,
      textarea {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      .ai-page {
        min-height: 100vh;
        background: #f5f7f6;
      }

      .ai-shell {
        width: min(1480px, calc(100% - 28px));
        margin: 0 auto;
        padding: 28px 0 50px;
      }

      .page-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 24px;
      }

      .breadcrumb {
        display: flex;
        gap: 8px;
        align-items: center;
        color: #8b9490;
        font-size: 12px;
        margin-bottom: 12px;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .title-mark {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        background: #e7f6ee;
        color: #08783f;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: -0.5px;
      }

      h1 {
        margin: 0;
        font-size: clamp(24px, 3vw, 34px);
        line-height: 1.2;
        letter-spacing: -1px;
      }

      .title-row p {
        margin: 7px 0 0;
        color: #69736f;
        font-size: 13px;
      }

      .primary-button,
      .secondary-button,
      .dark-button {
        border: 0;
        border-radius: 11px;
        min-height: 42px;
        padding: 0 17px;
        font-size: 13px;
        font-weight: 800;
        transition: 0.18s ease;
      }

      .primary-button {
        background: #079447;
        color: white;
        box-shadow: 0 5px 15px rgba(7, 148, 71, 0.14);
      }

      .primary-button:hover {
        background: #067d3c;
        transform: translateY(-1px);
      }

      .secondary-button {
        background: white;
        color: #26302c;
        border: 1px solid #dfe5e2;
      }

      .secondary-button:hover {
        background: #f7f9f8;
      }

      .dark-button {
        background: #17201c;
        color: white;
      }

      .dark-button:hover {
        background: #0e1512;
      }

      .notice {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 12px 15px;
        border-radius: 11px;
        margin-bottom: 16px;
        font-size: 13px;
        font-weight: 700;
      }

      .notice.success {
        color: #08783f;
        background: #e9f8f0;
        border: 1px solid #c8ecd9;
      }

      .notice.danger {
        color: #b42318;
        background: #fff0ee;
        border: 1px solid #ffd4cf;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }

      .stat {
        background: white;
        border: 1px solid #e2e7e4;
        border-radius: 14px;
        padding: 15px 16px;
        min-height: 84px;
      }

      .stat span {
        display: block;
        color: #8b9490;
        font-size: 11px;
        margin-bottom: 9px;
      }

      .stat strong {
        display: block;
        font-size: 22px;
        line-height: 1;
        letter-spacing: -0.5px;
      }

      .stat strong.green {
        color: #079447;
      }

      .stat.main {
        border-color: #cfe9db;
      }

      .workspace {
        overflow: hidden;
        background: white;
        border: 1px solid #dfe5e2;
        border-radius: 16px;
        box-shadow: 0 5px 25px rgba(20, 35, 28, 0.035);
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        padding: 14px 16px;
        border-bottom: 1px solid #edf0ee;
      }

      .toolbar-title {
        display: flex;
        align-items: center;
        gap: 9px;
        white-space: nowrap;
      }

      .toolbar-title strong {
        font-size: 14px;
      }

      .toolbar-title span {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 25px;
        height: 22px;
        padding: 0 7px;
        border-radius: 20px;
        background: #edf1ef;
        color: #68716d;
        font-size: 10px;
        font-weight: 800;
      }

      .toolbar-actions {
        display: flex;
        gap: 8px;
        flex: 1;
        justify-content: flex-end;
      }

      .search {
        width: min(340px, 100%);
        height: 39px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 11px;
        border: 1px solid #dfe5e2;
        border-radius: 10px;
        background: #fafbfa;
      }

      .search span {
        color: #89938e;
        font-size: 18px;
      }

      .search input {
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        font-size: 12px;
        color: #17201c;
      }

      .toolbar-actions select {
        min-width: 125px;
        height: 39px;
        border: 1px solid #dfe5e2;
        border-radius: 10px;
        background: white;
        padding: 0 10px;
        color: #39423e;
        outline: 0;
        font-size: 12px;
      }

      .employee-layout {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        min-height: 650px;
      }

      .employee-list {
        background: #fafbfa;
        border-left: 1px solid #edf0ee;
        padding: 10px;
      }

      .list-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 8px 13px;
        color: #69736f;
        font-size: 11px;
        font-weight: 800;
      }

      .list-heading b {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 23px;
        height: 21px;
        border-radius: 20px;
        background: #e9efec;
        font-size: 10px;
      }

      .employee-item {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 9px;
        border: 0;
        border-radius: 11px;
        background: transparent;
        text-align: right;
        margin-bottom: 3px;
      }

      .employee-item:hover {
        background: #f0f4f2;
      }

      .employee-item.selected {
        background: #e8f6ef;
      }

      .selected-line {
        position: absolute;
        right: 0;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 4px;
        background: #079447;
      }

      .avatar {
        position: relative;
        width: 43px;
        height: 43px;
        flex: 0 0 43px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
        border-radius: 12px;
        background: #e8f6ef;
        color: #08783f;
        font-size: 11px;
        font-weight: 900;
      }

      .avatar img,
      .big-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar i {
        position: absolute;
        left: -2px;
        bottom: -2px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #b8c1bd;
        border: 2px solid white;
      }

      .avatar i.online {
        background: #12b76a;
      }

      .employee-summary {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .employee-summary strong {
        overflow: hidden;
        color: #1b2420;
        font-size: 12px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .employee-summary small,
      .employee-summary em {
        overflow: hidden;
        color: #8a948f;
        font-size: 10px;
        font-style: normal;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .employee-summary em {
        color: #079447;
      }

      .profile {
        min-width: 0;
      }

      .profile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 28px 30px;
        border-bottom: 1px solid #edf0ee;
      }

      .profile-identity {
        display: flex;
        align-items: center;
        gap: 15px;
        min-width: 0;
      }

      .big-avatar {
        width: 74px;
        height: 74px;
        flex: 0 0 74px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 19px;
        background: #e8f6ef;
        color: #08783f;
        font-size: 17px;
        font-weight: 900;
      }

      .profile-name {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 9px;
      }

      .profile-name h2 {
        margin: 0;
        color: #111916;
        font-size: 24px;
      }

      .profile-identity p {
        margin: 5px 0 7px;
        color: #66716c;
        font-size: 12px;
      }

      .meta {
        display: flex;
        gap: 7px;
        color: #87918c;
        font-size: 10px;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        border-radius: 20px;
        font-size: 9px;
        font-weight: 800;
      }

      .status i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
      }

      .status.active {
        background: #e8f7ef;
        color: #08783f;
      }

      .status.inactive {
        background: #f0f2f1;
        color: #747d79;
      }

      .status.suspended {
        background: #fff0ee;
        color: #b42318;
      }

      .profile-actions {
        display: flex;
        gap: 7px;
        flex-shrink: 0;
      }

      .performance {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        border-bottom: 1px solid #edf0ee;
      }

      .metric {
        padding: 19px 22px;
        border-left: 1px solid #edf0ee;
      }

      .metric:last-child {
        border-left: 0;
      }

      .metric span {
        display: block;
        color: #8a948f;
        font-size: 10px;
        margin-bottom: 7px;
      }

      .metric strong {
        font-size: 19px;
        color: #18201d;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 20px 22px 25px;
      }

      .info-box {
        min-width: 0;
        padding: 17px;
        border: 1px solid #e6ebe8;
        border-radius: 13px;
        background: #fff;
      }

      .info-box.wide {
        grid-column: 1 / -1;
      }

      .info-box h3 {
        margin: 0 0 13px;
        color: #27312d;
        font-size: 12px;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;
        padding: 9px 0;
        border-bottom: 1px solid #f0f2f1;
      }

      .info-row:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }

      .info-row span {
        color: #8a948f;
        font-size: 10px;
      }

      .info-row strong {
        max-width: 60%;
        color: #35403b;
        font-size: 11px;
        text-align: left;
      }

      .permissions {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
      }

      .permission {
        padding: 9px 10px;
        border-radius: 9px;
        background: #f5f7f6;
        color: #a0a8a4;
        font-size: 10px;
        font-weight: 700;
      }

      .permission span {
        margin-left: 5px;
      }

      .permission.enabled {
        background: #e8f6ef;
        color: #08783f;
      }

      .description {
        margin: 0;
        color: #68736e;
        font-size: 11px;
        line-height: 1.9;
        white-space: pre-wrap;
      }

      .operation-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .operation {
        padding: 12px;
        border-radius: 10px;
        background: #f7f9f8;
      }

      .operation span {
        display: block;
        margin-bottom: 5px;
        color: #89938e;
        font-size: 9px;
      }

      .operation strong {
        color: #1c2521;
        font-size: 14px;
      }

      .empty {
        min-height: 500px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 30px;
        text-align: center;
      }

      .empty-icon {
        width: 70px;
        height: 70px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
        border-radius: 18px;
        background: #e8f6ef;
        color: #08783f;
        font-size: 16px;
        font-weight: 900;
      }

      .empty h2 {
        margin: 0;
        font-size: 18px;
      }

      .empty p {
        max-width: 380px;
        margin: 8px 0 18px;
        color: #7b8580;
        font-size: 12px;
      }

      .editor-overlay {
        position: fixed;
        z-index: 1000;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 18px;
        background: rgba(12, 18, 15, 0.52);
        backdrop-filter: blur(4px);
      }

      .editor {
        width: min(760px, 100%);
        max-height: calc(100vh - 36px);
        overflow: hidden;
        border-radius: 17px;
        background: white;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.2);
      }

      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 22px;
        border-bottom: 1px solid #edf0ee;
      }

      .editor-header span {
        color: #079447;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .editor-header h2 {
        margin: 4px 0 0;
        font-size: 19px;
      }

      .close-button {
        width: 35px;
        height: 35px;
        border: 0;
        border-radius: 9px;
        background: #f2f4f3;
        color: #68726e;
        font-size: 21px;
      }

      .form-content {
        max-height: calc(100vh - 180px);
        overflow-y: auto;
        padding: 20px 22px;
      }

      .form-section {
        padding-bottom: 20px;
        margin-bottom: 20px;
        border-bottom: 1px solid #edf0ee;
      }

      .form-section:last-child {
        margin-bottom: 0;
        border-bottom: 0;
      }

      .form-section h3 {
        margin: 0 0 12px;
        font-size: 12px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .field {
        display: block;
      }

      .field.full {
        margin-bottom: 12px;
      }

      .field span {
        display: block;
        margin-bottom: 6px;
        color: #4e5954;
        font-size: 10px;
        font-weight: 800;
      }

      .field span b {
        margin-right: 4px;
        color: #d92d20;
      }

      .field input,
      .field select,
      .field textarea {
        width: 100%;
        border: 1px solid #dfe5e2;
        border-radius: 9px;
        background: #fafbfa;
        color: #1a231f;
        outline: none;
        font-size: 12px;
      }

      .field input,
      .field select {
        height: 40px;
        padding: 0 11px;
      }

      .field textarea {
        resize: vertical;
        min-height: 90px;
        padding: 10px 11px;
        line-height: 1.7;
      }

      .field input:focus,
      .field select:focus,
      .field textarea:focus {
        border-color: #079447;
        background: white;
      }

      .permission-editor {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
      }

      .permission-option {
        min-height: 42px;
        border: 1px solid #e0e6e3;
        border-radius: 9px;
        background: #fafbfa;
        color: #68736e;
        font-size: 10px;
        font-weight: 700;
      }

      .permission-option span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 17px;
        height: 17px;
        margin-left: 5px;
        border-radius: 50%;
        background: #e7ebe9;
        color: transparent;
      }

      .permission-option.active {
        border-color: #bfe7d0;
        background: #e9f7f0;
        color: #08783f;
      }

      .permission-option.active span {
        background: #079447;
        color: white;
      }

      .editor-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 14px 22px;
        border-top: 1px solid #edf0ee;
        background: #fcfdfc;
      }

      .loading-box {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #6f7975;
        font-size: 12px;
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #dcefe4;
        border-top-color: #079447;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 1100px) {
        .stats-grid {
          grid-template-columns: repeat(3, 1fr);
        }

        .employee-layout {
          grid-template-columns: 250px minmax(0, 1fr);
        }

        .permissions {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 800px) {
        .ai-shell {
          width: min(100% - 20px, 680px);
          padding-top: 16px;
        }

        .page-header {
          align-items: stretch;
          flex-direction: column;
          gap: 16px;
        }

        .page-header .primary-button {
          width: 100%;
        }

        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .toolbar {
          align-items: stretch;
          flex-direction: column;
        }

        .toolbar-actions {
          justify-content: stretch;
        }

        .search {
          flex: 1;
        }

        .employee-layout {
          display: block;
        }

        .employee-list {
          border-left: 0;
          border-bottom: 1px solid #edf0ee;
        }

        .employee-item {
          display: inline-flex;
          width: calc(50% - 4px);
          vertical-align: top;
        }

        .profile-header {
          align-items: stretch;
          flex-direction: column;
          padding: 20px;
        }

        .profile-actions {
          width: 100%;
        }

        .profile-actions button {
          flex: 1;
        }

        .performance {
          grid-template-columns: repeat(2, 1fr);
        }

        .metric:nth-child(2) {
          border-left: 0;
        }

        .metric:nth-child(3),
        .metric:nth-child(4) {
          border-top: 1px solid #edf0ee;
        }

        .content-grid {
          grid-template-columns: 1fr;
          padding: 15px;
        }

        .info-box.wide {
          grid-column: auto;
        }

        .permission-editor {
          grid-template-columns: repeat(2, 1fr);
        }

        .operation-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 520px) {
        .ai-shell {
          width: calc(100% - 14px);
        }

        .title-row {
          align-items: flex-start;
        }

        .title-mark {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
        }

        h1 {
          font-size: 23px;
        }

        .title-row p {
          line-height: 1.7;
        }

        .stats-grid {
          gap: 7px;
        }

        .stat {
          min-height: 75px;
          padding: 12px;
        }

        .stat strong {
          font-size: 19px;
        }

        .toolbar-actions {
          flex-direction: column;
        }

        .search,
        .toolbar-actions select {
          width: 100%;
        }

        .employee-item {
          width: 100%;
        }

        .profile-identity {
          align-items: flex-start;
        }

        .big-avatar {
          width: 60px;
          height: 60px;
          flex-basis: 60px;
          border-radius: 15px;
        }

        .profile-name h2 {
          font-size: 21px;
        }

        .profile-actions {
          flex-direction: column;
        }

        .performance {
          grid-template-columns: 1fr 1fr;
        }

        .metric {
          padding: 15px;
        }

        .content-grid {
          padding: 12px;
        }

        .permissions {
          grid-template-columns: 1fr 1fr;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }

        .permission-editor {
          grid-template-columns: 1fr 1fr;
        }

        .editor-overlay {
          padding: 0;
          align-items: flex-end;
        }

        .editor {
          max-height: 94vh;
          border-radius: 17px 17px 0 0;
        }

        .form-content {
          max-height: calc(94vh - 145px);
        }

        .editor-footer {
          padding: 12px;
        }

        .editor-footer button {
          flex: 1;
        }
      }
    `}</style>
  );
}
