"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const STATUS = {
  pending: {
    label: "معلقة",
    className: "pending",
  },
  processing: {
    label: "قيد التنفيذ",
    className: "processing",
  },
  completed: {
    label: "مكتملة",
    className: "completed",
  },
  failed: {
    label: "فاشلة",
    className: "failed",
  },
  cancelled: {
    label: "ملغاة",
    className: "cancelled",
  },
};

const PRIORITIES = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

const emptyForm = {
  title: "",
  description: "",
  task_type: "",
  ai_employee_id: "",
  department_id: "",
  admin_id: "",
  priority: "normal",
  points_cost: 0,
  estimated_cost: 0,
};

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("ar-AE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function money(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function getStatus(status) {
  return STATUS[status] || {
    label: status || "غير معروف",
    className: "unknown",
  };
}

export default function AITasksPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [selectedTask, setSelectedTask] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_super_admin")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        window.location.href = "/dashboard";
        return;
      }

      const [
        tasksResult,
        employeesResult,
        departmentsResult,
        adminsResult,
      ] = await Promise.all([
        supabase
          .from("ai_tasks")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("ai_employees")
          .select(
            "id, name, specialization, department_id, admin_id, status, level"
          )
          .order("name"),

        supabase
          .from("departments")
          .select("id, name, status")
          .order("name"),

        supabase
          .from("admins")
          .select(
            "id, user_id, department_id, full_name, title, specialization, status"
          )
          .order("full_name"),
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (employeesResult.error) throw employeesResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (adminsResult.error) throw adminsResult.error;

      setTasks(tasksResult.data || []);
      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
      setAdmins(adminsResult.data || []);

      if (selectedTask) {
        const freshSelected = (tasksResult.data || []).find(
          (task) => task.id === selectedTask.id
        );

        if (freshSelected) {
          setSelectedTask(freshSelected);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر تحميل بيانات المهام.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;

    const pending = tasks.filter((t) => t.status === "pending").length;
    const processing = tasks.filter((t) => t.status === "processing").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;

    const totalCost = tasks.reduce(
      (sum, task) => sum + Number(task.actual_cost || task.estimated_cost || 0),
      0
    );

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      totalCost,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const employee = employees.find(
        (employeeItem) => employeeItem.id === task.ai_employee_id
      );

      const department = departments.find(
        (departmentItem) => departmentItem.id === task.department_id
      );

      const matchesSearch =
        !query ||
        String(task.title || "").toLowerCase().includes(query) ||
        String(task.description || "").toLowerCase().includes(query) ||
        String(employee?.name || "").toLowerCase().includes(query) ||
        String(department?.name || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tasks, employees, departments, search, statusFilter]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleEmployeeChange(employeeId) {
    const employee = employees.find((item) => item.id === employeeId);

    setForm((current) => ({
      ...current,
      ai_employee_id: employeeId,
      department_id: employee?.department_id || current.department_id || "",
      admin_id: employee?.admin_id || current.admin_id || "",
    }));
  }

  async function createTask(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("اسم المهمة مطلوب.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        task_type: form.task_type.trim() || null,
        ai_employee_id: form.ai_employee_id || null,
        department_id: form.department_id || null,
        admin_id: form.admin_id || null,
        created_by: user?.id || null,
        priority: form.priority,
        status: "pending",
        input_data: {},
        output_data: {},
        result: null,
        review_notes: null,
        points_cost: Number(form.points_cost || 0),
        estimated_cost: Number(form.estimated_cost || 0),
        actual_cost: 0,
        started_at: null,
        completed_at: null,
      };

      const { data, error: insertError } = await supabase
        .from("ai_tasks")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) throw insertError;

      setTasks((current) => [data, ...current]);
      setSelectedTask(data);

      setForm(emptyForm);
      setShowCreate(false);
      setMessage("تم إنشاء المهمة بنجاح.");

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر إنشاء المهمة.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(nextStatus) {
    if (!selectedTask) return;

    const allowedTransitions = {
      pending: ["processing", "cancelled"],
      processing: ["completed", "failed"],
      completed: [],
      failed: [],
      cancelled: [],
    };

    const allowed = allowedTransitions[selectedTask.status] || [];

    if (!allowed.includes(nextStatus)) {
      setError("لا يمكن تنفيذ هذه الخطوة من حالة المهمة الحالية.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updates = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === "processing") {
        updates.started_at =
          selectedTask.started_at || new Date().toISOString();
      }

      if (nextStatus === "completed") {
        updates.completed_at = new Date().toISOString();

        if (!selectedTask.result) {
          updates.result =
            "تم إنهاء المهمة بنجاح. التنفيذ الذكي سيتم ربطه لاحقًا.";
        }

        updates.actual_cost = Number(selectedTask.actual_cost || 0);
      }

      if (nextStatus === "failed") {
        updates.result = "تم تسجيل المهمة كفاشلة يدويًا.";
      }

      if (nextStatus === "cancelled") {
        updates.result = "تم إلغاء المهمة.";
      }

      const { data, error: updateError } = await supabase
        .from("ai_tasks")
        .update(updates)
        .eq("id", selectedTask.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setTasks((current) =>
        current.map((task) => (task.id === data.id ? data : task))
      );

      setSelectedTask(data);

      setMessage(
        nextStatus === "processing"
          ? "تم بدء المهمة."
          : nextStatus === "completed"
          ? "تم إنهاء المهمة بنجاح."
          : nextStatus === "cancelled"
          ? "تم إلغاء المهمة."
          : "تم تحديث حالة المهمة."
      );

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر تحديث حالة المهمة.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!selectedTask) return;

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذه المهمة؟"
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("ai_tasks")
        .delete()
        .eq("id", selectedTask.id);

      if (deleteError) throw deleteError;

      setTasks((current) =>
        current.filter((task) => task.id !== selectedTask.id)
      );

      setSelectedTask(null);
      setMessage("تم حذف المهمة.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر حذف المهمة.");
    } finally {
      setSaving(false);
    }
  }

  function employeeName(id) {
    return (
      employees.find((employee) => employee.id === id)?.name || "غير محدد"
    );
  }

  function employeeDetails(id) {
    return employees.find((employee) => employee.id === id) || null;
  }

  function departmentName(id) {
    return (
      departments.find((department) => department.id === id)?.name ||
      "غير محدد"
    );
  }

  function adminName(id) {
    return admins.find((admin) => admin.id === id)?.full_name || "غير محدد";
  }

  function openCreate() {
    setError("");
    setMessage("");
    setForm(emptyForm);
    setShowCreate(true);
  }

  if (loading) {
    return (
      <main dir="rtl" className="page">
        <div className="loading">جاري تحميل مهام موظفي AI...</div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f5f7f6;
            padding: 32px;
            font-family: Arial, sans-serif;
          }

          .loading {
            max-width: 1100px;
            margin: 80px auto;
            text-align: center;
            color: #64748b;
            font-size: 16px;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main dir="rtl" className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="eyebrow">الإدارة الداخلية</div>
            <h1>مهام موظفي AI</h1>
            <p>
              إدارة وتوزيع ومتابعة المهام الخاصة بموظفي الذكاء الاصطناعي.
            </p>
          </div>

          <button className="primaryButton" onClick={openCreate}>
            <span>＋</span>
            إنشاء مهمة
          </button>
        </header>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        <section className="stats">
          <div className="stat">
            <span>إجمالي المهام</span>
            <strong>{stats.total}</strong>
          </div>

          <div className="stat">
            <span>معلقة</span>
            <strong>{stats.pending}</strong>
          </div>

          <div className="stat">
            <span>قيد التنفيذ</span>
            <strong>{stats.processing}</strong>
          </div>

          <div className="stat">
            <span>مكتملة</span>
            <strong>{stats.completed}</strong>
          </div>

          <div className="stat">
            <span>فاشلة</span>
            <strong>{stats.failed}</strong>
          </div>

          <div className="stat">
            <span>التكلفة</span>
            <strong>{money(stats.totalCost)}</strong>
          </div>
        </section>

        <section className="toolbar">
          <div className="search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث عن مهمة أو موظف أو قسم..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="pending">معلقة</option>
            <option value="processing">قيد التنفيذ</option>
            <option value="completed">مكتملة</option>
            <option value="failed">فاشلة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </section>

        <section className="workspace">
          <div className="taskList">
            <div className="listHeader">
              <strong>قائمة المهام</strong>
              <span>{filteredTasks.length}</span>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="empty">
                <div className="emptyIcon">✓</div>
                <strong>لا توجد مهام</strong>
                <p>أنشئ أول مهمة لموظف AI.</p>
                <button className="secondaryButton" onClick={openCreate}>
                  إنشاء مهمة
                </button>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const status = getStatus(task.status);
                const employee = employeeDetails(task.ai_employee_id);

                return (
                  <button
                    key={task.id}
                    className={`taskItem ${
                      selectedTask?.id === task.id ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedTask(task);
                      setError("");
                      setMessage("");
                    }}
                  >
                    <div className="taskTop">
                      <strong>{task.title}</strong>
                      <span className={`badge ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <p>
                      {task.description ||
                        "لا يوجد وصف لهذه المهمة."}
                    </p>

                    <div className="taskMeta">
                      <span>🤖 {employee?.name || "غير محدد"}</span>
                      <span>
                        {PRIORITIES[task.priority] || "عادية"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="details">
            {!selectedTask ? (
              <div className="detailsEmpty">
                <div className="detailsIcon">🤖</div>
                <h2>اختر مهمة</h2>
                <p>
                  اختر مهمة من القائمة لعرض تفاصيلها وإدارتها.
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const status = getStatus(selectedTask.status);
                  const employee = employeeDetails(
                    selectedTask.ai_employee_id
                  );

                  return (
                    <>
                      <div className="detailsHeader">
                        <div>
                          <div className="detailsEyebrow">
                            تفاصيل المهمة
                          </div>

                          <h2>{selectedTask.title}</h2>

                          <div className="created">
                            أنشئت في{" "}
                            {formatDate(selectedTask.created_at)}
                          </div>
                        </div>

                        <span className={`bigBadge ${status.className}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="actions">
                        {selectedTask.status === "pending" && (
                          <>
                            <button
                              className="startButton"
                              disabled={saving}
                              onClick={() =>
                                updateTaskStatus("processing")
                              }
                            >
                              ▶ بدء المهمة
                            </button>

                            <button
                              className="cancelButton"
                              disabled={saving}
                              onClick={() =>
                                updateTaskStatus("cancelled")
                              }
                            >
                              إلغاء
                            </button>
                          </>
                        )}

                        {selectedTask.status === "processing" && (
                          <button
                            className="completeButton"
                            disabled={saving}
                            onClick={() =>
                              updateTaskStatus("completed")
                            }
                          >
                            ✓ إنهاء المهمة
                          </button>
                        )}

                        {(selectedTask.status === "completed" ||
                          selectedTask.status === "failed" ||
                          selectedTask.status === "cancelled") && (
                          <button
                            className="deleteButton"
                            disabled={saving}
                            onClick={deleteTask}
                          >
                            حذف المهمة
                          </button>
                        )}
                      </div>

                      <div className="infoGrid">
                        <div className="infoCard">
                          <span>🤖</span>
                          <div>
                            <small>موظف AI</small>
                            <strong>
                              {employee?.name || "غير محدد"}
                            </strong>
                            {employee?.specialization && (
                              <em>{employee.specialization}</em>
                            )}
                          </div>
                        </div>

                        <div className="infoCard">
                          <span>🏢</span>
                          <div>
                            <small>القسم</small>
                            <strong>
                              {departmentName(
                                selectedTask.department_id
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="infoCard">
                          <span>👤</span>
                          <div>
                            <small>Admin المسؤول</small>
                            <strong>
                              {adminName(selectedTask.admin_id)}
                            </strong>
                          </div>
                        </div>

                        <div className="infoCard">
                          <span>⚡</span>
                          <div>
                            <small>الأولوية</small>
                            <strong>
                              {PRIORITIES[selectedTask.priority] ||
                                "عادية"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <section className="section">
                        <h3>الوصف</h3>
                        <div className="description">
                          {selectedTask.description ||
                            "لا يوجد وصف لهذه المهمة."}
                        </div>
                      </section>

                      <section className="section">
                        <h3>حالة التنفيذ</h3>

                        <div className="timeline">
                          <div
                            className={
                              selectedTask.created_at
                                ? "timelineItem done"
                                : "timelineItem"
                            }
                          >
                            <div className="dot" />
                            <div>
                              <strong>إنشاء المهمة</strong>
                              <span>
                                {formatDate(
                                  selectedTask.created_at
                                )}
                              </span>
                            </div>
                          </div>

                          <div
                            className={
                              selectedTask.started_at
                                ? "timelineItem done"
                                : "timelineItem"
                            }
                          >
                            <div className="dot" />
                            <div>
                              <strong>بدء التنفيذ</strong>
                              <span>
                                {selectedTask.started_at
                                  ? formatDate(
                                      selectedTask.started_at
                                    )
                                  : "لم تبدأ بعد"}
                              </span>
                            </div>
                          </div>

                          <div
                            className={
                              selectedTask.completed_at
                                ? "timelineItem done"
                                : "timelineItem"
                            }
                          >
                            <div className="dot" />
                            <div>
                              <strong>اكتمال المهمة</strong>
                              <span>
                                {selectedTask.completed_at
                                  ? formatDate(
                                      selectedTask.completed_at
                                    )
                                  : "لم تبدأ بعد"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="costGrid">
                        <div>
                          <span>النقاط</span>
                          <strong>
                            {Number(
                              selectedTask.points_cost || 0
                            ).toFixed(0)}
                          </strong>
                        </div>

                        <div>
                          <span>التكلفة المتوقعة</span>
                          <strong>
                            {money(
                              selectedTask.estimated_cost
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>التكلفة الفعلية</span>
                          <strong>
                            {money(selectedTask.actual_cost)}
                          </strong>
                        </div>
                      </section>

                      <section className="section">
                        <h3>النتيجة</h3>

                        <div className="resultBox">
                          {selectedTask.result ||
                            "لم يتم تنفيذ المهمة بعد."}
                        </div>
                      </section>

                      <section className="section">
                        <h3>بيانات المهمة الداخلية</h3>

                        <details className="internalData">
                          <summary>عرض البيانات</summary>

                          <pre>
                            {JSON.stringify(
                              {
                                id: selectedTask.id,
                                task_type:
                                  selectedTask.task_type,
                                input_data:
                                  selectedTask.input_data,
                                output_data:
                                  selectedTask.output_data,
                                created_by:
                                  selectedTask.created_by,
                                ai_employee_id:
                                  selectedTask.ai_employee_id,
                                department_id:
                                  selectedTask.department_id,
                                admin_id:
                                  selectedTask.admin_id,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      </section>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </section>
      </div>

      {showCreate && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreate(false);
            }
          }}
        >
          <aside className="drawer">
            <div className="drawerHeader">
              <div>
                <span>مهام AI</span>
                <h2>إنشاء مهمة موظف AI</h2>
                <p>
                  أنشئ المهمة الآن. التنفيذ الذكي سيتم ربطه لاحقًا.
                </p>
              </div>

              <button
                className="closeButton"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={createTask}>
              <div className="formSection">
                <div className="sectionNumber">01</div>

                <div className="formContent">
                  <h3>البيانات الأساسية</h3>

                  <label>
                    اسم المهمة *
                    <input
                      value={form.title}
                      onChange={(event) =>
                        updateForm("title", event.target.value)
                      }
                      placeholder="مثال: مراجعة بيانات المنتج"
                      required
                    />
                  </label>

                  <label>
                    وصف المهمة
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        updateForm(
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="اكتب المطلوب من موظف AI..."
                      rows={4}
                    />
                  </label>

                  <label>
                    نوع المهمة
                    <input
                      value={form.task_type}
                      onChange={(event) =>
                        updateForm(
                          "task_type",
                          event.target.value
                        )
                      }
                      placeholder="مثال: مراجعة"
                    />
                  </label>
                </div>
              </div>

              <div className="formSection">
                <div className="sectionNumber">02</div>

                <div className="formContent">
                  <h3>التوزيع الإداري</h3>

                  <label>
                    موظف AI
                    <select
                      value={form.ai_employee_id}
                      onChange={(event) =>
                        handleEmployeeChange(event.target.value)
                      }
                    >
                      <option value="">غير محدد</option>

                      {employees
                        .filter(
                          (employee) =>
                            employee.status === "active"
                        )
                        .map((employee) => (
                          <option
                            key={employee.id}
                            value={employee.id}
                          >
                            {employee.name}
                            {employee.specialization
                              ? ` — ${employee.specialization}`
                              : ""}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    القسم
                    <select
                      value={form.department_id}
                      onChange={(event) =>
                        updateForm(
                          "department_id",
                          event.target.value
                        )
                      }
                    >
                      <option value="">غير محدد</option>

                      {departments.map((department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Admin المسؤول
                    <select
                      value={form.admin_id}
                      onChange={(event) =>
                        updateForm(
                          "admin_id",
                          event.target.value
                        )
                      }
                    >
                      <option value="">غير محدد</option>

                      {admins
                        .filter(
                          (admin) => admin.status === "active"
                        )
                        .map((admin) => (
                          <option
                            key={admin.id}
                            value={admin.id}
                          >
                            {admin.full_name}
                            {admin.title
                              ? ` — ${admin.title}`
                              : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="formSection">
                <div className="sectionNumber">03</div>

                <div className="formContent">
                  <h3>الأولوية والتكلفة</h3>

                  <label>
                    الأولوية
                    <select
                      value={form.priority}
                      onChange={(event) =>
                        updateForm(
                          "priority",
                          event.target.value
                        )
                      }
                    >
                      <option value="low">منخفضة</option>
                      <option value="normal">عادية</option>
                      <option value="high">عالية</option>
                      <option value="urgent">عاجلة</option>
                    </select>
                  </label>

                  <div className="twoColumns">
                    <label>
                      النقاط
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.points_cost}
                        onChange={(event) =>
                          updateForm(
                            "points_cost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      التكلفة المتوقعة $
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={form.estimated_cost}
                        onChange={(event) =>
                          updateForm(
                            "estimated_cost",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="drawerFooter">
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="primaryButton"
                  disabled={saving}
                >
                  {saving ? "جاري الحفظ..." : "إنشاء المهمة"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #f5f7f6;
          color: #17231f;
          font-family:
            Arial,
            "Tahoma",
            sans-serif;
        }

        .shell {
          width: min(1500px, calc(100% - 40px));
          margin: 0 auto;
          padding: 34px 0 60px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 24px;
        }

        .eyebrow,
        .detailsEyebrow {
          color: #15805d;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 7px;
        }

        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 42px);
          letter-spacing: -0.8px;
        }

        .header p {
          margin: 9px 0 0;
          color: #718078;
          font-size: 14px;
        }

        .primaryButton,
        .secondaryButton,
        .startButton,
        .completeButton,
        .cancelButton,
        .deleteButton {
          border: 0;
          border-radius: 12px;
          padding: 12px 17px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .primaryButton {
          background: #16805c;
          color: white;
          box-shadow: 0 8px 20px rgba(22, 128, 92, 0.15);
        }

        .primaryButton:hover {
          background: #116b4d;
          transform: translateY(-1px);
        }

        .secondaryButton {
          background: #eef3f0;
          color: #315047;
        }

        .secondaryButton:hover {
          background: #e1e9e5;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none !important;
        }

        .message {
          border-radius: 12px;
          padding: 12px 15px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .message.success {
          background: #e9f8f1;
          color: #08734e;
          border: 1px solid #c9eddd;
        }

        .message.error {
          background: #fff0f0;
          color: #b42318;
          border: 1px solid #ffd4d1;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat {
          background: white;
          border: 1px solid #e5ebe8;
          border-radius: 16px;
          padding: 17px;
          box-shadow: 0 5px 20px rgba(20, 40, 32, 0.035);
        }

        .stat span {
          display: block;
          color: #7a8983;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .stat strong {
          font-size: 24px;
        }

        .toolbar {
          background: white;
          border: 1px solid #e5ebe8;
          border-radius: 16px;
          padding: 12px;
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }

        .search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 9px;
          background: #f6f8f7;
          border-radius: 11px;
          padding: 0 13px;
        }

        .search span {
          color: #7d8a85;
          font-size: 21px;
        }

        .search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 12px 0;
          font-size: 14px;
        }

        select,
        input,
        textarea {
          font: inherit;
        }

        .toolbar select {
          min-width: 160px;
          border: 1px solid #dde5e1;
          border-radius: 11px;
          background: white;
          padding: 0 12px;
          outline: 0;
        }

        .workspace {
          display: grid;
          grid-template-columns: 430px minmax(0, 1fr);
          min-height: 680px;
          background: white;
          border: 1px solid #e5ebe8;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 8px 30px rgba(20, 40, 32, 0.04);
        }

        .taskList {
          border-left: 1px solid #e8eeeb;
          background: #fbfcfb;
        }

        .listHeader {
          height: 62px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 18px;
          border-bottom: 1px solid #e8eeeb;
        }

        .listHeader span {
          min-width: 28px;
          height: 28px;
          border-radius: 9px;
          background: #e8f5ef;
          color: #147b59;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 700;
        }

        .taskItem {
          width: 100%;
          text-align: right;
          background: transparent;
          border: 0;
          border-bottom: 1px solid #edf1ef;
          padding: 16px 18px;
          cursor: pointer;
          color: inherit;
        }

        .taskItem:hover {
          background: #f3f8f5;
        }

        .taskItem.selected {
          background: #eaf7f1;
          box-shadow: inset -3px 0 #16805c;
        }

        .taskTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .taskTop strong {
          font-size: 14px;
          line-height: 1.5;
        }

        .taskItem p {
          margin: 8px 0;
          color: #74817c;
          font-size: 12px;
          line-height: 1.7;
        }

        .taskMeta {
          display: flex;
          gap: 12px;
          color: #81908a;
          font-size: 11px;
        }

        .badge,
        .bigBadge {
          white-space: nowrap;
          border-radius: 999px;
          font-weight: 700;
        }

        .badge {
          padding: 5px 8px;
          font-size: 10px;
        }

        .bigBadge {
          padding: 8px 12px;
          font-size: 12px;
        }

        .pending {
          background: #fff5dc;
          color: #9a6900;
        }

        .processing {
          background: #e9f2ff;
          color: #2563a8;
        }

        .completed {
          background: #e8f8f0;
          color: #08734e;
        }

        .failed {
          background: #fff0f0;
          color: #b42318;
        }

        .cancelled,
        .unknown {
          background: #edf0ef;
          color: #68756f;
        }

        .empty {
          text-align: center;
          padding: 70px 25px;
          color: #73817b;
        }

        .emptyIcon,
        .detailsIcon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          margin: 0 auto 14px;
          background: #eaf7f1;
          color: #16805c;
          font-size: 25px;
        }

        .empty strong {
          display: block;
          color: #26342f;
          margin-bottom: 6px;
        }

        .empty p {
          font-size: 13px;
          margin-bottom: 18px;
        }

        .details {
          padding: 28px;
          overflow: auto;
        }

        .detailsEmpty {
          min-height: 620px;
          display: grid;
          place-content: center;
          text-align: center;
          color: #7a8983;
        }

        .detailsEmpty h2 {
          color: #26342f;
          margin: 0 0 8px;
        }

        .detailsEmpty p {
          margin: 0;
          font-size: 13px;
        }

        .detailsHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e9eeec;
        }

        .detailsHeader h2 {
          margin: 0;
          font-size: 25px;
        }

        .created {
          color: #87938e;
          font-size: 12px;
          margin-top: 8px;
        }

        .actions {
          display: flex;
          gap: 8px;
          margin: 18px 0;
        }

        .startButton {
          background: #16805c;
          color: white;
        }

        .completeButton {
          background: #16805c;
          color: white;
        }

        .cancelButton {
          background: #f1f3f2;
          color: #53615b;
        }

        .deleteButton {
          background: #fff0f0;
          color: #b42318;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 25px;
        }

        .infoCard {
          border: 1px solid #e5ebe8;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          gap: 11px;
          background: #fcfdfc;
        }

        .infoCard > span {
          font-size: 19px;
        }

        .infoCard small,
        .infoCard strong,
        .infoCard em {
          display: block;
        }

        .infoCard small {
          color: #89958f;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .infoCard strong {
          font-size: 13px;
        }

        .infoCard em {
          color: #7a8983;
          font-size: 10px;
          font-style: normal;
          margin-top: 4px;
          line-height: 1.5;
        }

        .section {
          margin-top: 25px;
        }

        .section h3 {
          font-size: 14px;
          margin: 0 0 10px;
        }

        .description,
        .resultBox {
          background: #f7f9f8;
          border: 1px solid #e7ece9;
          border-radius: 12px;
          padding: 15px;
          color: #52615a;
          font-size: 13px;
          line-height: 1.8;
        }

        .timeline {
          display: grid;
          gap: 0;
        }

        .timelineItem {
          display: flex;
          gap: 12px;
          min-height: 58px;
          position: relative;
        }

        .timelineItem:not(:last-child)::after {
          content: "";
          position: absolute;
          right: 6px;
          top: 14px;
          width: 1px;
          height: 48px;
          background: #dfe6e2;
        }

        .dot {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #dbe2df;
          margin-top: 3px;
          z-index: 1;
        }

        .timelineItem.done .dot {
          background: #16805c;
          box-shadow: 0 0 0 4px #e5f5ee;
        }

        .timelineItem strong,
        .timelineItem span {
          display: block;
        }

        .timelineItem strong {
          font-size: 12px;
        }

        .timelineItem span {
          margin-top: 4px;
          color: #8a9691;
          font-size: 11px;
        }

        .costGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 22px;
        }

        .costGrid > div {
          background: #f8faf9;
          border: 1px solid #e6ece9;
          border-radius: 13px;
          padding: 14px;
        }

        .costGrid span,
        .costGrid strong {
          display: block;
        }

        .costGrid span {
          color: #89958f;
          font-size: 10px;
          margin-bottom: 7px;
        }

        .costGrid strong {
          font-size: 17px;
        }

        .internalData {
          background: #17231f;
          color: #d7e5df;
          border-radius: 12px;
          overflow: hidden;
        }

        .internalData summary {
          cursor: pointer;
          padding: 12px 14px;
          font-size: 12px;
        }

        .internalData pre {
          margin: 0;
          padding: 15px;
          overflow: auto;
          direction: ltr;
          text-align: left;
          font-size: 11px;
          line-height: 1.6;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(16, 28, 23, 0.32);
          z-index: 100;
          display: flex;
          justify-content: flex-start;
        }

        .drawer {
          width: min(560px, 100%);
          height: 100%;
          background: white;
          overflow-y: auto;
          box-shadow: 20px 0 60px rgba(0, 0, 0, 0.12);
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(-30px);
            opacity: 0.6;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .drawerHeader {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 25px;
          border-bottom: 1px solid #e8eeeb;
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(10px);
          z-index: 2;
        }

        .drawerHeader > div > span {
          color: #16805c;
          font-size: 11px;
          font-weight: 700;
        }

        .drawerHeader h2 {
          margin: 5px 0;
          font-size: 22px;
        }

        .drawerHeader p {
          margin: 0;
          color: #7d8a85;
          font-size: 12px;
        }

        .closeButton {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 10px;
          background: #f1f4f2;
          color: #52615a;
          font-size: 22px;
          cursor: pointer;
          flex: 0 0 auto;
        }

        .formSection {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          padding: 23px 25px;
          border-bottom: 1px solid #edf1ef;
        }

        .sectionNumber {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #eaf7f1;
          color: #16805c;
          font-size: 11px;
          font-weight: 800;
        }

        .formContent h3 {
          margin: 2px 0 17px;
          font-size: 14px;
        }

        label {
          display: block;
          margin-bottom: 14px;
          color: #4d5c55;
          font-size: 11px;
          font-weight: 700;
        }

        input,
        textarea,
        .formContent select {
          display: block;
          width: 100%;
          margin-top: 7px;
          border: 1px solid #dce5e1;
          border-radius: 11px;
          background: white;
          outline: 0;
          padding: 12px;
          color: #26342f;
          font-size: 13px;
        }

        textarea {
          resize: vertical;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #73b69e;
          box-shadow: 0 0 0 3px #eaf7f1;
        }

        .twoColumns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .drawerFooter {
          position: sticky;
          bottom: 0;
          display: flex;
          justify-content: flex-start;
          gap: 8px;
          padding: 16px 25px;
          background: rgba(255, 255, 255, 0.97);
          border-top: 1px solid #e8eeeb;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .workspace {
            grid-template-columns: 350px minmax(0, 1fr);
          }

          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 800px) {
          .shell {
            width: min(100% - 24px, 700px);
            padding-top: 22px;
          }

          .header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header .primaryButton {
            width: 100%;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .toolbar {
            flex-direction: column;
          }

          .toolbar select {
            min-height: 44px;
          }

          .workspace {
            grid-template-columns: 1fr;
          }

          .taskList {
            border-left: 0;
            border-bottom: 1px solid #e8eeeb;
            max-height: 420px;
            overflow: auto;
          }

          .details {
            padding: 20px;
          }

          .detailsHeader {
            flex-direction: column;
          }

          .infoGrid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 520px) {
          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .stat strong {
            font-size: 20px;
          }

          .infoGrid,
          .costGrid,
          .twoColumns {
            grid-template-columns: 1fr;
          }

          .detailsHeader h2 {
            font-size: 21px;
          }

          .formSection {
            grid-template-columns: 1fr;
          }

          .sectionNumber {
            display: none;
          }

          .drawerHeader,
          .formSection,
          .drawerFooter {
            padding-right: 18px;
            padding-left: 18px;
          }
        }
      `}</style>
    </main>
  );
}
