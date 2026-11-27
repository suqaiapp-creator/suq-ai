"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const STATUS = {
  pending: {
    label: "معلقة",
    color: "#b7791f",
    bg: "#fff8e6",
  },
  processing: {
    label: "قيد التنفيذ",
    color: "#2563eb",
    bg: "#eff6ff",
  },
  completed: {
    label: "مكتملة",
    color: "#16803c",
    bg: "#ecfdf3",
  },
  failed: {
    label: "فشلت",
    color: "#dc2626",
    bg: "#fef2f2",
  },
  cancelled: {
    label: "ملغاة",
    color: "#6b7280",
    bg: "#f3f4f6",
  },
};

const PRIORITY = {
  low: {
    label: "منخفضة",
    color: "#64748b",
  },
  normal: {
    label: "عادية",
    color: "#2563eb",
  },
  high: {
    label: "عالية",
    color: "#d97706",
  },
  urgent: {
    label: "عاجلة",
    color: "#dc2626",
  },
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

function money(value) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function safeJson(value) {
  if (!value) return {};

  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export default function AITasksPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [authorized, setAuthorized] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    task_type: "",
    ai_employee_id: "",
    department_id: "",
    admin_id: "",
    priority: "normal",
    points_cost: 0,
    estimated_cost: 0,
  });

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.is_super_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

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
            "id, name, specialization, status, level, department_id, admin_id"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("departments")
          .select("id, name, status")
          .order("name"),

        supabase
          .from("admins")
          .select("id, full_name, title, status, department_id")
          .order("full_name"),
      ]);

      if (tasksResult.error) throw tasksResult.error;

      setTasks(tasksResult.data || []);
      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
      setAdmins(adminsResult.data || []);
    } catch (error) {
      console.error("AI tasks load error:", error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      title: "",
      description: "",
      task_type: "",
      ai_employee_id: "",
      department_id: "",
      admin_id: "",
      priority: "normal",
      points_cost: 0,
      estimated_cost: 0,
    });
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function getEmployee(id) {
    return employees.find((item) => item.id === id);
  }

  function getDepartment(id) {
    return departments.find((item) => item.id === id);
  }

  function getAdmin(id) {
    return admins.find((item) => item.id === id);
  }

  function handleEmployeeChange(value) {
    const employee = getEmployee(value);

    setForm((current) => ({
      ...current,
      ai_employee_id: value,
      department_id: employee?.department_id || current.department_id,
      admin_id: employee?.admin_id || current.admin_id,
    }));
  }

  async function createTask(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("اكتب اسم المهمة أولاً.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("انتهت الجلسة.");
        return;
      }

      const employee = getEmployee(form.ai_employee_id);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        task_type: form.task_type.trim() || null,

        ai_employee_id: form.ai_employee_id || null,

        department_id:
          form.department_id || employee?.department_id || null,

        admin_id: form.admin_id || employee?.admin_id || null,

        created_by: user.id,

        priority: form.priority,
        status: "pending",

        input_data: {},
        output_data: {},

        points_cost: Number(form.points_cost || 0),
        estimated_cost: Number(form.estimated_cost || 0),
        actual_cost: 0,
      };

      const { data, error } = await supabase
        .from("ai_tasks")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      setTasks((current) => [data, ...current]);
      setShowCreate(false);
      resetForm();
      setSelectedTask(data);
    } catch (error) {
      console.error("Create AI task error:", error);
      alert(error.message || "تعذر إنشاء المهمة.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(task, newStatus) {
    if (!task?.id) return;

    setSaving(true);

    try {
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "processing" && !task.started_at) {
        updates.started_at = new Date().toISOString();
      }

      if (newStatus === "completed" || newStatus === "failed") {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("ai_tasks")
        .update(updates)
        .eq("id", task.id)
        .select("*")
        .single();

      if (error) throw error;

      setTasks((current) =>
        current.map((item) => (item.id === task.id ? data : item))
      );

      setSelectedTask(data);
    } catch (error) {
      console.error("Update task error:", error);
      alert(error.message || "تعذر تحديث المهمة.");
    } finally {
      setSaving(false);
    }
  }

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const employee = getEmployee(task.ai_employee_id);
      const department = getDepartment(task.department_id);
      const admin = getAdmin(task.admin_id);

      const searchable = [
        task.title,
        task.description,
        task.task_type,
        employee?.name,
        department?.name,
        admin?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [
    tasks,
    employees,
    departments,
    admins,
    search,
    statusFilter,
    priorityFilter,
  ]);

  const stats = useMemo(() => {
    const total = tasks.length;

    const pending = tasks.filter(
      (task) => task.status === "pending"
    ).length;

    const processing = tasks.filter(
      (task) => task.status === "processing"
    ).length;

    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;

    const failed = tasks.filter(
      (task) => task.status === "failed"
    ).length;

    const totalCost = tasks.reduce(
      (sum, task) =>
        sum + Number(task.actual_cost || task.estimated_cost || 0),
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

  if (loading) {
    return (
      <main className="page">
        <div className="loading">
          <div className="spinner" />
          <p>جاري تحميل مهام موظفي AI...</p>
        </div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="page">
        <div className="blocked">
          <div className="blockedIcon">🔒</div>
          <h2>غير مصرح</h2>
          <p>هذه الصفحة متاحة للـ Super Admin فقط.</p>
        </div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="page" dir="rtl">
      <header className="header">
        <div>
          <div className="breadcrumb">
            الإدارة الداخلية <span>›</span> مهام موظفي AI
          </div>

          <h1>مهام موظفي AI</h1>

          <p>
            إنشاء المهام وتوزيعها ومتابعة تنفيذها ونتائجها وتكلفتها من مكان
            واحد.
          </p>
        </div>

        <button className="primaryButton" onClick={openCreate}>
          <span>＋</span>
          إنشاء مهمة
        </button>
      </header>

      <section className="stats">
        <Stat
          label="إجمالي المهام"
          value={stats.total}
          icon="📋"
        />

        <Stat
          label="معلقة"
          value={stats.pending}
          icon="🟡"
        />

        <Stat
          label="قيد التنفيذ"
          value={stats.processing}
          icon="🔵"
        />

        <Stat
          label="مكتملة"
          value={stats.completed}
          icon="🟢"
        />

        <Stat
          label="فشلت"
          value={stats.failed}
          icon="🔴"
        />

        <Stat
          label="التكلفة"
          value={`$${money(stats.totalCost)}`}
          icon="💰"
        />
      </section>

      <section className="workspace">
        <div className="listPanel">
          <div className="listHeader">
            <div>
              <strong>قائمة المهام</strong>
              <span>{filteredTasks.length} مهمة</span>
            </div>

            <button className="refreshButton" onClick={loadPage}>
              ↻
            </button>
          </div>

          <div className="filters">
            <div className="searchBox">
              <span>⌕</span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث عن مهمة أو موظف..."
              />
            </div>

            <div className="filterRow">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">كل الحالات</option>
                <option value="pending">معلقة</option>
                <option value="processing">قيد التنفيذ</option>
                <option value="completed">مكتملة</option>
                <option value="failed">فشلت</option>
                <option value="cancelled">ملغاة</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value)
                }
              >
                <option value="all">كل الأولويات</option>
                <option value="urgent">عاجلة</option>
                <option value="high">عالية</option>
                <option value="normal">عادية</option>
                <option value="low">منخفضة</option>
              </select>
            </div>
          </div>

          <div className="taskList">
            {filteredTasks.length === 0 ? (
              <div className="empty">
                <div className="emptyIcon">📋</div>

                <h3>لا توجد مهام</h3>

                <p>
                  أنشئ أول مهمة لموظف AI وابدأ ببناء نظام التشغيل الداخلي.
                </p>

                <button
                  className="secondaryButton"
                  onClick={openCreate}
                >
                  ＋ إنشاء أول مهمة
                </button>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const employee = getEmployee(task.ai_employee_id);
                const status = STATUS[task.status] || STATUS.pending;
                const priority =
                  PRIORITY[task.priority] || PRIORITY.normal;

                const active = selectedTask?.id === task.id;

                return (
                  <button
                    key={task.id}
                    className={`taskItem ${active ? "active" : ""}`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="taskItemTop">
                      <div className="taskTitle">
                        {task.title}
                      </div>

                      <span
                        className="statusPill"
                        style={{
                          color: status.color,
                          background: status.bg,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="taskMeta">
                      <span>
                        🤖 {employee?.name || "بدون موظف"}
                      </span>

                      <span
                        style={{
                          color: priority.color,
                        }}
                      >
                        ⚡ {priority.label}
                      </span>
                    </div>

                    <div className="taskDate">
                      {formatDate(task.created_at)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="detailPanel">
          {!selectedTask ? (
            <div className="detailEmpty">
              <div className="detailEmptyIcon">🤖</div>

              <h2>اختر مهمة</h2>

              <p>
                اختر مهمة من القائمة لعرض تفاصيلها ومتابعة حالتها.
              </p>

              <button
                className="primaryButton"
                onClick={openCreate}
              >
                ＋ إنشاء مهمة جديدة
              </button>
            </div>
          ) : (
            <TaskDetails
              task={selectedTask}
              employee={getEmployee(selectedTask.ai_employee_id)}
              department={getDepartment(selectedTask.department_id)}
              admin={getAdmin(selectedTask.admin_id)}
              saving={saving}
              onStatusChange={updateTaskStatus}
            />
          )}
        </div>
      </section>

      {showCreate && (
        <div
          className="drawerBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreate(false);
            }
          }}
        >
          <aside className="drawer">
            <div className="drawerHeader">
              <div>
                <span className="drawerEyebrow">
                  مهمة جديدة
                </span>

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

            <form onSubmit={createTask} className="form">
              <div className="formSection">
                <div className="sectionTitle">
                  <span>01</span>
                  البيانات الأساسية
                </div>

                <label>
                  اسم المهمة *
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        title: event.target.value,
                      })
                    }
                    placeholder="مثال: مراجعة منتج جديد"
                    required
                  />
                </label>

                <label>
                  وصف المهمة
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description: event.target.value,
                      })
                    }
                    placeholder="اكتب المطلوب من موظف AI بالتفصيل..."
                    rows={4}
                  />
                </label>

                <label>
                  نوع المهمة
                  <input
                    value={form.task_type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        task_type: event.target.value,
                      })
                    }
                    placeholder="مثال: مراجعة، تسويق، تحليل، تصميم"
                  />
                </label>
              </div>

              <div className="formSection">
                <div className="sectionTitle">
                  <span>02</span>
                  التوزيع الإداري
                </div>

                <label>
                  موظف AI
                  <select
                    value={form.ai_employee_id}
                    onChange={(event) =>
                      handleEmployeeChange(event.target.value)
                    }
                  >
                    <option value="">اختر موظف AI</option>

                    {employees.map((employee) => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {employee.name}
                        {employee.status !== "active"
                          ? " — غير نشط"
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
                      setForm({
                        ...form,
                        department_id: event.target.value,
                      })
                    }
                  >
                    <option value="">بدون قسم</option>

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
                      setForm({
                        ...form,
                        admin_id: event.target.value,
                      })
                    }
                  >
                    <option value="">بدون Admin</option>

                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.full_name}
                        {admin.title
                          ? ` — ${admin.title}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="formSection">
                <div className="sectionTitle">
                  <span>03</span>
                  الأولوية والتكلفة
                </div>

                <label>
                  الأولوية
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        priority: event.target.value,
                      })
                    }
                  >
                    <option value="urgent">عاجلة</option>
                    <option value="high">عالية</option>
                    <option value="normal">عادية</option>
                    <option value="low">منخفضة</option>
                  </select>
                </label>

                <div className="twoInputs">
                  <label>
                    النقاط
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.points_cost}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          points_cost: event.target.value,
                        })
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
                        setForm({
                          ...form,
                          estimated_cost: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="drawerFooter">
                <button
                  type="button"
                  className="cancelButton"
                  onClick={() => setShowCreate(false)}
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

      <style jsx>{styles}</style>
    </main>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="stat">
      <div className="statIcon">{icon}</div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function TaskDetails({
  task,
  employee,
  department,
  admin,
  saving,
  onStatusChange,
}) {
  const status = STATUS[task.status] || STATUS.pending;
  const priority = PRIORITY[task.priority] || PRIORITY.normal;

  const inputData = safeJson(task.input_data);
  const outputData = safeJson(task.output_data);

  return (
    <div className="details">
      <div className="detailsHeader">
        <div>
          <span className="detailsEyebrow">
            تفاصيل المهمة
          </span>

          <h2>{task.title}</h2>

          <p>
            أنشئت في {formatDate(task.created_at)}
          </p>
        </div>

        <span
          className="bigStatus"
          style={{
            color: status.color,
            background: status.bg,
          }}
        >
          {status.label}
        </span>
      </div>

      <div className="detailsActions">
        {task.status === "pending" && (
          <button
            className="actionBlue"
            disabled={saving}
            onClick={() =>
              onStatusChange(task, "processing")
            }
          >
            ▶ بدء المهمة
          </button>
        )}

        {task.status === "processing" && (
          <button
            className="actionGreen"
            disabled={saving}
            onClick={() =>
              onStatusChange(task, "completed")
            }
          >
            ✓ إنهاء المهمة
          </button>
        )}

        {task.status === "processing" && (
          <button
            className="actionRed"
            disabled={saving}
            onClick={() =>
              onStatusChange(task, "failed")
            }
          >
            فشل التنفيذ
          </button>
        )}

        {task.status === "pending" && (
          <button
            className="actionGray"
            disabled={saving}
            onClick={() =>
              onStatusChange(task, "cancelled")
            }
          >
            إلغاء
          </button>
        )}
      </div>

      <section className="infoGrid">
        <InfoBox
          title="موظف AI"
          value={employee?.name || "غير محدد"}
          sub={employee?.specialization || ""}
          icon="🤖"
        />

        <InfoBox
          title="القسم"
          value={department?.name || "غير محدد"}
          sub=""
          icon="🏢"
        />

        <InfoBox
          title="Admin المسؤول"
          value={admin?.full_name || "غير محدد"}
          sub={admin?.title || ""}
          icon="👤"
        />

        <InfoBox
          title="الأولوية"
          value={priority.label}
          sub=""
          icon="⚡"
          valueColor={priority.color}
        />
      </section>

      <section className="contentSection">
        <div className="contentTitle">
          <span>الوصف</span>
        </div>

        <div className="description">
          {task.description || "لا يوجد وصف للمهمة."}
        </div>
      </section>

      <section className="timelineSection">
        <div className="contentTitle">
          <span>حالة التنفيذ</span>
        </div>

        <div className="timeline">
          <TimelineItem
            active
            title="إنشاء المهمة"
            date={task.created_at}
          />

          <TimelineItem
            active={
              task.status === "processing" ||
              task.status === "completed" ||
              task.status === "failed"
            }
            title="بدء التنفيذ"
            date={task.started_at}
          />

          <TimelineItem
            active={
              task.status === "completed" ||
              task.status === "failed"
            }
            title={
              task.status === "failed"
                ? "فشل التنفيذ"
                : "اكتمال المهمة"
            }
            date={task.completed_at}
            danger={task.status === "failed"}
          />
        </div>
      </section>

      <section className="numbersGrid">
        <div>
          <span>النقاط</span>
          <strong>{Number(task.points_cost || 0)}</strong>
        </div>

        <div>
          <span>التكلفة المتوقعة</span>
          <strong>${money(task.estimated_cost)}</strong>
        </div>

        <div>
          <span>التكلفة الفعلية</span>
          <strong>${money(task.actual_cost)}</strong>
        </div>
      </section>

      <section className="contentSection">
        <div className="contentTitle">
          <span>النتيجة</span>
        </div>

        <div className="resultBox">
          {task.result || "لم يتم تنفيذ المهمة بعد."}
        </div>
      </section>

      {task.review_notes && (
        <section className="contentSection">
          <div className="contentTitle">
            <span>ملاحظات المراجعة</span>
          </div>

          <div className="reviewBox">
            {task.review_notes}
          </div>
        </section>
      )}

      <section className="technicalSection">
        <details>
          <summary>بيانات المهمة الداخلية</summary>

          <div className="jsonBlock">
            <strong>Input</strong>
            <pre>{JSON.stringify(inputData, null, 2)}</pre>

            <strong>Output</strong>
            <pre>{JSON.stringify(outputData, null, 2)}</pre>
          </div>
        </details>
      </section>

      <div className="taskId">
        Task ID: {task.id}
      </div>
    </div>
  );
}

function InfoBox({
  title,
  value,
  sub,
  icon,
  valueColor,
}) {
  return (
    <div className="infoBox">
      <div className="infoIcon">{icon}</div>

      <div>
        <span>{title}</span>

        <strong style={valueColor ? { color: valueColor } : {}}>
          {value}
        </strong>

        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

function TimelineItem({
  active,
  title,
  date,
  danger,
}) {
  return (
    <div className={`timelineItem ${active ? "active" : ""}`}>
      <div
        className="timelineDot"
        style={
          danger
            ? {
                background: "#dc2626",
              }
            : undefined
        }
      />

      <div>
        <strong>{title}</strong>
        <span>{date ? formatDate(date) : "لم تبدأ بعد"}</span>
      </div>
    </div>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .page {
    min-height: 100vh;
    background: #f6f8f7;
    color: #17231d;
    padding: 28px;
    font-family: Arial, Tahoma, sans-serif;
  }

  .header {
    max-width: 1500px;
    margin: 0 auto 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
  }

  .breadcrumb {
    color: #7b8780;
    font-size: 13px;
    margin-bottom: 10px;
  }

  .breadcrumb span {
    margin: 0 7px;
  }

  h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: -0.5px;
  }

  .header p {
    margin: 8px 0 0;
    color: #758078;
    font-size: 14px;
  }

  .primaryButton {
    border: 0;
    background: #16803c;
    color: white;
    min-height: 46px;
    padding: 0 20px;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.2s;
    white-space: nowrap;
  }

  .primaryButton:hover {
    background: #116b31;
    transform: translateY(-1px);
  }

  .primaryButton:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .primaryButton span {
    font-size: 19px;
    margin-left: 5px;
  }

  .stats {
    max-width: 1500px;
    margin: 0 auto 20px;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }

  .stat {
    background: white;
    border: 1px solid #e5ebe7;
    border-radius: 15px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 10px rgba(20, 45, 30, 0.025);
  }

  .statIcon {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: #f1f5f2;
    border-radius: 11px;
    font-size: 18px;
  }

  .stat span {
    display: block;
    color: #7b8780;
    font-size: 11px;
    margin-bottom: 5px;
  }

  .stat strong {
    font-size: 19px;
  }

  .workspace {
    max-width: 1500px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(350px, 0.85fr) minmax(500px, 1.35fr);
    gap: 16px;
    min-height: 650px;
  }

  .listPanel,
  .detailPanel {
    background: white;
    border: 1px solid #e3e9e5;
    border-radius: 18px;
    overflow: hidden;
  }

  .listPanel {
    display: flex;
    flex-direction: column;
  }

  .listHeader {
    min-height: 72px;
    padding: 16px 18px;
    border-bottom: 1px solid #edf1ee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .listHeader strong {
    display: block;
    font-size: 16px;
  }

  .listHeader span {
    color: #89938d;
    font-size: 12px;
    display: block;
    margin-top: 4px;
  }

  .refreshButton {
    width: 38px;
    height: 38px;
    border: 1px solid #e1e7e3;
    background: white;
    border-radius: 10px;
    cursor: pointer;
    font-size: 19px;
  }

  .filters {
    padding: 14px;
    border-bottom: 1px solid #edf1ee;
  }

  .searchBox {
    height: 42px;
    border: 1px solid #dfe6e1;
    border-radius: 10px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
  }

  .searchBox span {
    color: #7d8982;
    font-size: 21px;
  }

  .searchBox input {
    border: 0;
    outline: 0;
    width: 100%;
    font-size: 13px;
    background: transparent;
  }

  .filterRow {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }

  select,
  input,
  textarea {
    font-family: inherit;
  }

  .filterRow select {
    height: 40px;
    border: 1px solid #dfe6e1;
    border-radius: 9px;
    padding: 0 10px;
    background: white;
    color: #26342c;
    outline: none;
  }

  .taskList {
    flex: 1;
    overflow-y: auto;
    max-height: 650px;
  }

  .taskItem {
    width: 100%;
    text-align: right;
    border: 0;
    border-bottom: 1px solid #eef2ef;
    background: white;
    padding: 15px 17px;
    cursor: pointer;
    transition: 0.15s;
  }

  .taskItem:hover {
    background: #fafcfb;
  }

  .taskItem.active {
    background: #f0f9f3;
    border-right: 3px solid #16803c;
  }

  .taskItemTop {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .taskTitle {
    font-weight: 700;
    font-size: 14px;
    line-height: 1.5;
  }

  .statusPill {
    flex-shrink: 0;
    border-radius: 20px;
    padding: 5px 9px;
    font-size: 10px;
    font-weight: 700;
  }

  .taskMeta {
    margin-top: 11px;
    display: flex;
    gap: 14px;
    color: #78847c;
    font-size: 11px;
  }

  .taskDate {
    color: #a0aaa4;
    font-size: 10px;
    margin-top: 8px;
  }

  .empty {
    padding: 55px 24px;
    text-align: center;
  }

  .emptyIcon {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    margin: 0 auto 15px;
    border-radius: 17px;
    background: #f1f5f2;
    font-size: 25px;
  }

  .empty h3 {
    margin: 0;
    font-size: 17px;
  }

  .empty p {
    color: #7e8982;
    font-size: 12px;
    line-height: 1.8;
    max-width: 300px;
    margin: 8px auto 18px;
  }

  .secondaryButton {
    border: 1px solid #cfe0d4;
    background: white;
    color: #16803c;
    border-radius: 10px;
    padding: 10px 15px;
    cursor: pointer;
    font-weight: 700;
  }

  .detailPanel {
    min-width: 0;
  }

  .detailEmpty {
    height: 100%;
    min-height: 650px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 30px;
  }

  .detailEmptyIcon {
    width: 76px;
    height: 76px;
    border-radius: 22px;
    background: #eef7f1;
    display: grid;
    place-items: center;
    font-size: 33px;
    margin-bottom: 18px;
  }

  .detailEmpty h2 {
    margin: 0;
  }

  .detailEmpty p {
    color: #7c8780;
    font-size: 13px;
    margin: 8px 0 20px;
  }

  .details {
    padding: 26px;
  }

  .detailsHeader {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
    border-bottom: 1px solid #edf1ee;
    padding-bottom: 20px;
  }

  .detailsEyebrow {
    color: #16803c;
    font-size: 11px;
    font-weight: 700;
  }

  .details h2 {
    margin: 7px 0 5px;
    font-size: 25px;
  }

  .detailsHeader p {
    margin: 0;
    color: #8a958e;
    font-size: 11px;
  }

  .bigStatus {
    border-radius: 30px;
    padding: 8px 13px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  .detailsActions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 16px 0;
    border-bottom: 1px solid #edf1ee;
  }

  .detailsActions button {
    border: 0;
    border-radius: 9px;
    padding: 9px 13px;
    font-weight: 700;
    cursor: pointer;
    font-size: 12px;
  }

  .detailsActions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .actionBlue {
    background: #eff6ff;
    color: #2563eb;
  }

  .actionGreen {
    background: #ecfdf3;
    color: #16803c;
  }

  .actionRed {
    background: #fef2f2;
    color: #dc2626;
  }

  .actionGray {
    background: #f3f4f6;
    color: #59635d;
  }

  .infoGrid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 18px 0;
  }

  .infoBox {
    background: #f8faf9;
    border: 1px solid #e8ede9;
    border-radius: 12px;
    padding: 13px;
    display: flex;
    gap: 10px;
    min-width: 0;
  }

  .infoIcon {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: white;
  }

  .infoBox span {
    display: block;
    color: #89938d;
    font-size: 10px;
    margin-bottom: 5px;
  }

  .infoBox strong {
    display: block;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .infoBox small {
    display: block;
    color: #98a19b;
    font-size: 9px;
    margin-top: 4px;
  }

  .contentSection {
    margin-top: 20px;
  }

  .contentTitle {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .description,
  .resultBox,
  .reviewBox {
    background: #f8faf9;
    border: 1px solid #e8ede9;
    border-radius: 12px;
    padding: 14px;
    color: #59655d;
    font-size: 12px;
    line-height: 1.9;
    min-height: 60px;
  }

  .timelineSection {
    margin-top: 22px;
  }

  .timeline {
    display: flex;
    align-items: flex-start;
    gap: 0;
    background: #f8faf9;
    border: 1px solid #e8ede9;
    border-radius: 12px;
    padding: 18px;
  }

  .timelineItem {
    flex: 1;
    position: relative;
    padding-right: 26px;
    min-height: 50px;
  }

  .timelineItem:not(:last-child)::after {
    content: "";
    position: absolute;
    right: 9px;
    top: 8px;
    height: 1px;
    width: calc(100% - 18px);
    background: #dfe6e1;
  }

  .timelineDot {
    position: absolute;
    right: 0;
    top: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #dce4de;
    z-index: 2;
  }

  .timelineItem.active .timelineDot {
    background: #16803c;
    box-shadow: 0 0 0 4px #e8f5ec;
  }

  .timelineItem strong {
    display: block;
    font-size: 11px;
  }

  .timelineItem span {
    display: block;
    color: #8b958f;
    font-size: 9px;
    margin-top: 5px;
  }

  .numbersGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 18px;
  }

  .numbersGrid div {
    border: 1px solid #e8ede9;
    border-radius: 12px;
    padding: 14px;
  }

  .numbersGrid span {
    display: block;
    color: #89938d;
    font-size: 10px;
    margin-bottom: 6px;
  }

  .numbersGrid strong {
    font-size: 16px;
  }

  .technicalSection {
    margin-top: 20px;
  }

  .technicalSection details {
    border: 1px solid #e8ede9;
    border-radius: 12px;
    padding: 13px;
  }

  .technicalSection summary {
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
  }

  .jsonBlock {
    margin-top: 14px;
  }

  .jsonBlock strong {
    display: block;
    font-size: 10px;
    margin: 10px 0 6px;
  }

  pre {
    background: #17231d;
    color: #d7e6dc;
    border-radius: 10px;
    padding: 12px;
    overflow: auto;
    direction: ltr;
    text-align: left;
    font-size: 10px;
  }

  .taskId {
    margin-top: 20px;
    color: #a0aaa4;
    font-size: 9px;
    direction: ltr;
    text-align: left;
  }

  .drawerBackdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(20, 30, 24, 0.25);
    display: flex;
    justify-content: flex-start;
  }

  .drawer {
    width: min(520px, 100%);
    height: 100%;
    background: white;
    box-shadow: 10px 0 35px rgba(0, 0, 0, 0.12);
    overflow-y: auto;
  }

  .drawerHeader {
    padding: 24px;
    border-bottom: 1px solid #edf1ee;
    display: flex;
    justify-content: space-between;
    gap: 15px;
  }

  .drawerEyebrow {
    color: #16803c;
    font-size: 11px;
    font-weight: 700;
  }

  .drawerHeader h2 {
    margin: 7px 0 5px;
    font-size: 21px;
  }

  .drawerHeader p {
    color: #7d8982;
    font-size: 11px;
    margin: 0;
  }

  .closeButton {
    width: 36px;
    height: 36px;
    border: 1px solid #e2e8e4;
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 22px;
    flex-shrink: 0;
  }

  .form {
    padding: 22px;
  }

  .formSection {
    padding-bottom: 22px;
    margin-bottom: 22px;
    border-bottom: 1px solid #edf1ee;
  }

  .sectionTitle {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .sectionTitle span {
    width: 25px;
    height: 25px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    background: #eaf6ed;
    color: #16803c;
    font-size: 9px;
  }

  label {
    display: block;
    color: #46534b;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 13px;
  }

  label input,
  label textarea,
  label select {
    display: block;
    width: 100%;
    margin-top: 7px;
    border: 1px solid #dfe6e1;
    border-radius: 10px;
    outline: none;
    background: white;
    color: #26342c;
    padding: 11px 12px;
    font-size: 12px;
  }

  label input:focus,
  label textarea:focus,
  label select:focus {
    border-color: #16803c;
    box-shadow: 0 0 0 3px #eaf6ed;
  }

  label textarea {
    resize: vertical;
  }

  .twoInputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .drawerFooter {
    position: sticky;
    bottom: 0;
    background: white;
    border-top: 1px solid #edf1ee;
    padding: 14px 22px;
    display: flex;
    gap: 10px;
  }

  .drawerFooter .primaryButton {
    flex: 1;
  }

  .cancelButton {
    min-height: 46px;
    padding: 0 18px;
    border: 1px solid #dfe6e1;
    border-radius: 12px;
    background: white;
    color: #5c6861;
    font-weight: 700;
    cursor: pointer;
  }

  .loading {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 14px;
    color: #6f7b73;
  }

  .spinner {
    width: 34px;
    height: 34px;
    border: 3px solid #dce8df;
    border-top-color: #16803c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .blocked {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .blockedIcon {
    font-size: 45px;
    margin-bottom: 10px;
  }

  .blocked h2 {
    margin: 0;
  }

  .blocked p {
    color: #7c8780;
    font-size: 13px;
  }

  @media (max-width: 1100px) {
    .stats {
      grid-template-columns: repeat(3, 1fr);
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .taskList {
      max-height: 500px;
    }

    .infoGrid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 700px) {
    .page {
      padding: 15px;
    }

    .header {
      align-items: stretch;
      flex-direction: column;
    }

    .header .primaryButton {
      width: 100%;
    }

    h1 {
      font-size: 25px;
    }

    .stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .workspace {
      display: block;
    }

    .detailPanel {
      margin-top: 14px;
    }

    .details {
      padding: 18px;
    }

    .detailsHeader {
      flex-direction: column;
    }

    .infoGrid {
      grid-template-columns: 1fr 1fr;
    }

    .timeline {
      display: block;
    }

    .timelineItem {
      padding-right: 30px;
      padding-bottom: 18px;
    }

    .timelineItem:not(:last-child)::after {
      right: 8px;
      top: 20px;
      width: 1px;
      height: calc(100% - 5px);
    }

    .numbersGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .stats {
      grid-template-columns: 1fr 1fr;
    }

    .stat {
      padding: 12px;
    }

    .statIcon {
      width: 34px;
      height: 34px;
    }

    .infoGrid {
      grid-template-columns: 1fr;
    }

    .twoInputs {
      grid-template-columns: 1fr;
    }

    .filterRow {
      grid-template-columns: 1fr;
    }
  }
`;
