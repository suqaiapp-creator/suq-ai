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
    label: "فشل التنفيذ",
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

const REVIEW_STATUS = {
  not_reviewed: "لم تتم المراجعة",
  pending: "بانتظار المراجعة",
  approved: "مقبولة",
  rejected: "مرفوضة",
};

const APPROVAL_STATUS = {
  not_approved: "غير معتمدة",
  pending: "بانتظار الاعتماد",
  approved: "معتمدة",
  rejected: "مرفوضة",
};

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("ar-AE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function money(value) {
  const number = Number(value || 0);

  return `$${number.toFixed(4)}`;
}

function statusInfo(status) {
  return STATUS[status] || {
    label: status || "غير معروف",
    className: "pending",
  };
}

function getReviewLabel(status) {
  return REVIEW_STATUS[status] || "غير معروف";
}

function getApprovalLabel(status) {
  return APPROVAL_STATUS[status] || "غير معروف";
}

function makeLog(type, description, userId = null) {
  return {
    type,
    description,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
}

export default function AITasksPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const [resultText, setResultText] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    task_type: "مراجعة",
    ai_employee_id: "",
    department_id: "",
    admin_id: "",
    priority: "normal",
    points_cost: "0",
    estimated_cost: "0",
  });

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        throw new Error("يجب تسجيل الدخول.");
      }

      setUser(currentUser);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,is_super_admin")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        throw new Error("غير مصرح لك بالدخول إلى هذه الصفحة.");
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
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (employeesResult.error) throw employeesResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (adminsResult.error) throw adminsResult.error;

      setTasks(tasksResult.data || []);
      setEmployees(employeesResult.data || []);
      setDepartments(departmentsResult.data || []);
      setAdmins(adminsResult.data || []);

      if (!selectedTaskId && tasksResult.data?.length) {
        setSelectedTaskId(tasksResult.data[0].id);
      }
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedTask = useMemo(() => {
    return tasks.find((task) => task.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  useEffect(() => {
    if (selectedTask) {
      setResultText(selectedTask.result || "");
      setReviewNotes(selectedTask.review_notes || "");
    }
  }, [selectedTask]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const employee = employees.find(
        (item) => item.id === task.ai_employee_id
      );

      const department = departments.find(
        (item) => item.id === task.department_id
      );

      const matchesSearch =
        !query ||
        String(task.title || "").toLowerCase().includes(query) ||
        String(task.description || "").toLowerCase().includes(query) ||
        String(task.task_type || "").toLowerCase().includes(query) ||
        String(employee?.name || "").toLowerCase().includes(query) ||
        String(department?.name || "").toLowerCase().includes(query);

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
    search,
    statusFilter,
    priorityFilter,
  ]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((x) => x.status === "pending").length,
      processing: tasks.filter((x) => x.status === "processing").length,
      completed: tasks.filter((x) => x.status === "completed").length,
      failed: tasks.filter((x) => x.status === "failed").length,
      review: tasks.filter(
        (x) =>
          x.review_status === "pending" ||
          (x.status === "completed" &&
            x.review_status !== "approved")
      ).length,
      approved: tasks.filter((x) => x.approval_status === "approved").length,
      cost: tasks.reduce(
        (sum, x) => sum + Number(x.actual_cost || x.estimated_cost || 0),
        0
      ),
    };
  }, [tasks]);

  function employeeName(id) {
    return (
      employees.find((item) => item.id === id)?.name ||
      "غير محدد"
    );
  }

  function departmentName(id) {
    return (
      departments.find((item) => item.id === id)?.name ||
      "غير محدد"
    );
  }

  function adminName(id) {
    return (
      admins.find((item) => item.id === id)?.full_name ||
      "غير محدد"
    );
  }

  async function createTask(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("اكتب عنوان المهمة.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const employee = employees.find(
        (item) => item.id === form.ai_employee_id
      );

      const departmentId =
        form.department_id || employee?.department_id || null;

      const executionLog = [
        makeLog(
          "created",
          "تم إنشاء المهمة.",
          user?.id || null
        ),
      ];

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        task_type: form.task_type || null,
        ai_employee_id: form.ai_employee_id || null,
        department_id: departmentId,
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
        review_status: "not_reviewed",
        approval_status: "not_approved",
        execution_log: executionLog,
      };

      const { data, error: insertError } = await supabase
        .from("ai_tasks")
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      setTasks((current) => [data, ...current]);
      setSelectedTaskId(data.id);

      setForm({
        title: "",
        description: "",
        task_type: "مراجعة",
        ai_employee_id: "",
        department_id: "",
        admin_id: "",
        priority: "normal",
        points_cost: "0",
        estimated_cost: "0",
      });

      setShowCreate(false);
    } catch (err) {
      setError(err.message || "تعذر إنشاء المهمة.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId, updates, logEntry = null) {
    setSaving(true);
    setError("");

    try {
      const current = tasks.find((item) => item.id === taskId);

      const currentLog = Array.isArray(current?.execution_log)
        ? current.execution_log
        : [];

      const nextLog = logEntry
        ? [...currentLog, logEntry]
        : currentLog;

      const payload = {
        ...updates,
        updated_at: new Date().toISOString(),
        execution_log: nextLog,
      };

      const { data, error: updateError } = await supabase
        .from("ai_tasks")
        .update(payload)
        .eq("id", taskId)
        .select()
        .single();

      if (updateError) throw updateError;

      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === taskId ? data : item
        )
      );
    } catch (err) {
      setError(err.message || "تعذر تحديث المهمة.");
    } finally {
      setSaving(false);
    }
  }

  async function startTask() {
    if (!selectedTask) return;

    if (
      selectedTask.status !== "pending" &&
      selectedTask.status !== "failed"
    ) {
      return;
    }

    await updateTask(
      selectedTask.id,
      {
        status: "processing",
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
      },
      makeLog(
        "started",
        "تم بدء تنفيذ المهمة.",
        user?.id || null
      )
    );
  }

  async function completeTask() {
    if (!selectedTask) return;

    if (selectedTask.status !== "processing") return;

    const defaultResult =
      selectedTask.result ||
      "تم إنهاء المهمة بنجاح. التنفيذ الذكي سيتم ربطه لاحقًا.";

    await updateTask(
      selectedTask.id,
      {
        status: "completed",
        completed_at: new Date().toISOString(),
        result: defaultResult,
        result_data: {
          message: defaultResult,
        },
        review_status: "pending",
        approval_status: "pending",
        error_message: null,
      },
      makeLog(
        "completed",
        "تم إنهاء تنفيذ المهمة وأصبحت بانتظار المراجعة.",
        user?.id || null
      )
    );
  }

  async function failTask() {
    if (!selectedTask) return;

    await updateTask(
      selectedTask.id,
      {
        status: "failed",
        error_message: "تم وضع المهمة كفاشلة بواسطة Super Admin.",
      },
      makeLog(
        "failed",
        "تم وضع المهمة كفاشلة.",
        user?.id || null
      )
    );
  }

  async function cancelTask() {
    if (!selectedTask) return;

    if (
      selectedTask.status !== "pending" &&
      selectedTask.status !== "processing"
    ) {
      return;
    }

    await updateTask(
      selectedTask.id,
      {
        status: "cancelled",
        completed_at: new Date().toISOString(),
      },
      makeLog(
        "cancelled",
        "تم إلغاء المهمة.",
        user?.id || null
      )
    );
  }

  async function saveReview() {
    if (!selectedTask) return;

    const trimmedResult = resultText.trim();
    const trimmedNotes = reviewNotes.trim();

    await updateTask(
      selectedTask.id,
      {
        result: trimmedResult || null,
        result_data: trimmedResult
          ? { message: trimmedResult }
          : {},
        review_notes: trimmedNotes || null,
        review_status: "pending",
      },
      makeLog(
        "review_updated",
        "تم تحديث نتيجة وملاحظات المهمة.",
        user?.id || null
      )
    );

    setShowReview(false);
  }

  async function approveReview() {
    if (!selectedTask) return;

    await updateTask(
      selectedTask.id,
      {
        review_status: "approved",
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
        approval_status: "approved",
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
      },
      makeLog(
        "approved",
        "تمت مراجعة المهمة واعتماد نتيجتها.",
        user?.id || null
      )
    );
  }

  async function rejectReview() {
    if (!selectedTask) return;

    await updateTask(
      selectedTask.id,
      {
        review_status: "rejected",
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
        approval_status: "rejected",
      },
      makeLog(
        "rejected",
        "تم رفض نتيجة المهمة أثناء المراجعة.",
        user?.id || null
      )
    );
  }

  async function approveOnly() {
    if (!selectedTask) return;

    await updateTask(
      selectedTask.id,
      {
        approval_status: "approved",
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
      },
      makeLog(
        "final_approved",
        "تم اعتماد المهمة بشكل نهائي.",
        user?.id || null
      )
    );
  }

  async function deleteTask() {
    if (!selectedTask) return;

    const allowed = [
      "completed",
      "failed",
      "cancelled",
    ].includes(selectedTask.status);

    if (!allowed) {
      setError("لا يمكن حذف مهمة قيد التنفيذ.");
      return;
    }

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

      const remaining = tasks.filter(
        (item) => item.id !== selectedTask.id
      );

      setTasks(remaining);
      setSelectedTaskId(remaining[0]?.id || null);
    } catch (err) {
      setError(err.message || "تعذر حذف المهمة.");
    } finally {
      setSaving(false);
    }
  }

  function openReview() {
    if (!selectedTask) return;

    setResultText(selectedTask.result || "");
    setReviewNotes(selectedTask.review_notes || "");
    setShowReview(true);
  }

  if (loading) {
    return (
      <main className="page">
        <div className="loading">جاري تحميل نظام المهام...</div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6f8f7;
            display: flex;
            align-items: center;
            justify-content: center;
            direction: rtl;
            font-family: Arial, sans-serif;
          }

          .loading {
            background: white;
            border: 1px solid #e5ebe7;
            border-radius: 18px;
            padding: 28px 34px;
            color: #37443d;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="eyebrow">الإدارة الداخلية</div>
            <h1>مهام موظفي AI</h1>
            <p>
              إدارة المهام والتنفيذ والمراجعة والاعتماد والتكلفة.
            </p>
          </div>

          <button
            className="primaryButton"
            onClick={() => setShowCreate(true)}
          >
            + مهمة جديدة
          </button>
        </header>

        {error && (
          <div className="errorBox">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError("")}>إغلاق</button>
          </div>
        )}

        <section className="stats">
          <Stat
            title="إجمالي المهام"
            value={stats.total}
            icon="📋"
          />
          <Stat
            title="معلقة"
            value={stats.pending}
            icon="⏳"
          />
          <Stat
            title="قيد التنفيذ"
            value={stats.processing}
            icon="⚙️"
          />
          <Stat
            title="مكتملة"
            value={stats.completed}
            icon="✓"
          />
          <Stat
            title="بانتظار المراجعة"
            value={stats.review}
            icon="👁️"
          />
          <Stat
            title="معتمدة"
            value={stats.approved}
            icon="✅"
          />
          <Stat
            title="التكلفة"
            value={money(stats.cost)}
            icon="💰"
          />
        </section>

        <section className="filters">
          <div className="searchBox">
            🔎
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن مهمة، موظف AI، قسم..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="pending">معلقة</option>
            <option value="processing">قيد التنفيذ</option>
            <option value="completed">مكتملة</option>
            <option value="failed">فشل التنفيذ</option>
            <option value="cancelled">ملغاة</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">كل الأولويات</option>
            <option value="low">منخفضة</option>
            <option value="normal">عادية</option>
            <option value="high">عالية</option>
            <option value="urgent">عاجلة</option>
          </select>
        </section>

        <section className="workspace">
          <div className="taskList">
            <div className="listHeader">
              <strong>المهام</strong>
              <span>{filteredTasks.length}</span>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="empty">
                <div className="emptyIcon">📋</div>
                <strong>لا توجد مهام</strong>
                <p>أنشئ أول مهمة لموظف AI.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const status = statusInfo(task.status);
                const selected = task.id === selectedTaskId;

                return (
                  <button
                    key={task.id}
                    className={`taskItem ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="taskItemTop">
                      <strong>{task.title}</strong>

                      <span
                        className={`status ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="taskItemMeta">
                      <span>
                        🤖 {employeeName(task.ai_employee_id)}
                      </span>

                      <span>
                        {PRIORITIES[task.priority] ||
                          task.priority}
                      </span>
                    </div>

                    <div className="taskItemDate">
                      {formatDate(task.created_at)}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="details">
            {!selectedTask ? (
              <div className="detailsEmpty">
                <div>📋</div>
                <h2>اختر مهمة</h2>
                <p>
                  اختر مهمة من القائمة لعرض تفاصيلها.
                </p>
              </div>
            ) : (
              <>
                <div className="detailsHeader">
                  <div>
                    <div className="detailsTitleRow">
                      <h2>{selectedTask.title}</h2>

                      <span
                        className={`status ${statusInfo(
                          selectedTask.status
                        ).className}`}
                      >
                        {
                          statusInfo(
                            selectedTask.status
                          ).label
                        }
                      </span>
                    </div>

                    <p>
                      {selectedTask.description ||
                        "لا يوجد وصف للمهمة."}
                    </p>
                  </div>
                </div>

                <div className="infoGrid">
                  <Info
                    label="موظف AI"
                    value={employeeName(
                      selectedTask.ai_employee_id
                    )}
                  />

                  <Info
                    label="القسم"
                    value={departmentName(
                      selectedTask.department_id
                    )}
                  />

                  <Info
                    label="Admin"
                    value={adminName(
                      selectedTask.admin_id
                    )}
                  />

                  <Info
                    label="نوع المهمة"
                    value={selectedTask.task_type || "—"}
                  />

                  <Info
                    label="الأولوية"
                    value={
                      PRIORITIES[selectedTask.priority] ||
                      selectedTask.priority
                    }
                  />

                  <Info
                    label="النقاط"
                    value={selectedTask.points_cost ?? 0}
                  />

                  <Info
                    label="التكلفة التقديرية"
                    value={money(
                      selectedTask.estimated_cost
                    )}
                  />

                  <Info
                    label="التكلفة الفعلية"
                    value={money(
                      selectedTask.actual_cost
                    )}
                  />
                </div>

                <div className="workflow">
                  <div className="workflowTitle">
                    حالة العمل
                  </div>

                  <div className="workflowSteps">
                    <WorkflowStep
                      active
                      title="إنشاء"
                      date={selectedTask.created_at}
                    />

                    <WorkflowStep
                      active={
                        !!selectedTask.started_at
                      }
                      title="بدء التنفيذ"
                      date={selectedTask.started_at}
                    />

                    <WorkflowStep
                      active={
                        !!selectedTask.completed_at
                      }
                      title="الانتهاء"
                      date={selectedTask.completed_at}
                    />

                    <WorkflowStep
                      active={
                        selectedTask.review_status ===
                        "approved"
                      }
                      title="المراجعة"
                      date={selectedTask.reviewed_at}
                    />

                    <WorkflowStep
                      active={
                        selectedTask.approval_status ===
                        "approved"
                      }
                      title="الاعتماد"
                      date={selectedTask.approved_at}
                    />
                  </div>
                </div>

                <div className="reviewCards">
                  <div className="reviewCard">
                    <span>👁️ المراجعة</span>
                    <strong>
                      {getReviewLabel(
                        selectedTask.review_status
                      )}
                    </strong>
                  </div>

                  <div className="reviewCard">
                    <span>✅ الاعتماد</span>
                    <strong>
                      {getApprovalLabel(
                        selectedTask.approval_status
                      )}
                    </strong>
                  </div>
                </div>

                {selectedTask.result && (
                  <div className="resultBox">
                    <div className="sectionTitle">
                      📤 نتيجة المهمة
                    </div>

                    <div className="resultText">
                      {selectedTask.result}
                    </div>
                  </div>
                )}

                {selectedTask.review_notes && (
                  <div className="notesBox">
                    <div className="sectionTitle">
                      📝 ملاحظات المراجعة
                    </div>

                    <div className="resultText">
                      {selectedTask.review_notes}
                    </div>
                  </div>
                )}

                {selectedTask.error_message && (
                  <div className="failureBox">
                    <div className="sectionTitle">
                      ⚠️ سبب الفشل
                    </div>

                    <div>
                      {selectedTask.error_message}
                    </div>
                  </div>
                )}

                <div className="actions">
                  {selectedTask.status === "pending" && (
                    <button
                      className="primaryButton"
                      disabled={saving}
                      onClick={startTask}
                    >
                      ▶ بدء المهمة
                    </button>
                  )}

                  {selectedTask.status ===
                    "processing" && (
                    <>
                      <button
                        className="successButton"
                        disabled={saving}
                        onClick={completeTask}
                      >
                        ✓ إنهاء المهمة
                      </button>

                      <button
                        className="dangerOutlineButton"
                        disabled={saving}
                        onClick={failTask}
                      >
                        فشل التنفيذ
                      </button>
                    </>
                  )}

                  {selectedTask.status === "completed" && (
                    <button
                      className="secondaryButton"
                      disabled={saving}
                      onClick={openReview}
                    >
                      👁️ مراجعة النتيجة
                    </button>
                  )}

                  {(selectedTask.status === "pending" ||
                    selectedTask.status ===
                      "processing") && (
                    <button
                      className="dangerOutlineButton"
                      disabled={saving}
                      onClick={cancelTask}
                    >
                      إلغاء المهمة
                    </button>
                  )}

                  {selectedTask.review_status === "pending" &&
                    selectedTask.status === "completed" && (
                      <>
                        <button
                          className="successButton"
                          disabled={saving}
                          onClick={approveReview}
                        >
                          ✓ اعتماد النتيجة
                        </button>

                        <button
                          className="dangerOutlineButton"
                          disabled={saving}
                          onClick={rejectReview}
                        >
                          ✕ رفض النتيجة
                        </button>
                      </>
                    )}

                  {selectedTask.review_status ===
                    "approved" &&
                    selectedTask.approval_status !==
                      "approved" && (
                      <button
                        className="successButton"
                        disabled={saving}
                        onClick={approveOnly}
                      >
                        ✓ اعتماد نهائي
                      </button>
                    )}

                  {[
                    "completed",
                    "failed",
                    "cancelled",
                  ].includes(selectedTask.status) && (
                    <button
                      className="deleteButton"
                      disabled={saving}
                      onClick={deleteTask}
                    >
                      🗑 حذف
                    </button>
                  )}
                </div>

                <div className="timeline">
                  <div className="sectionTitle">
                    📜 سجل المهمة
                  </div>

                  {Array.isArray(
                    selectedTask.execution_log
                  ) &&
                  selectedTask.execution_log.length > 0 ? (
                    <div className="timelineList">
                      {[
                        ...selectedTask.execution_log,
                      ]
                        .reverse()
                        .map((entry, index) => (
                          <div
                            className="timelineItem"
                            key={`${entry.created_at}-${index}`}
                          >
                            <div className="timelineDot" />

                            <div>
                              <strong>
                                {entry.description ||
                                  "تحديث على المهمة"}
                              </strong>

                              <small>
                                {formatDate(
                                  entry.created_at
                                )}
                              </small>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="muted">
                      لا يوجد سجل حتى الآن.
                    </div>
                  )}
                </div>

                <div className="dates">
                  <Info
                    label="أنشئت"
                    value={formatDate(
                      selectedTask.created_at
                    )}
                  />

                  <Info
                    label="بدأت"
                    value={formatDate(
                      selectedTask.started_at
                    )}
                  />

                  <Info
                    label="اكتملت"
                    value={formatDate(
                      selectedTask.completed_at
                    )}
                  />

                  <Info
                    label="تمت المراجعة"
                    value={formatDate(
                      selectedTask.reviewed_at
                    )}
                  />

                  <Info
                    label="تم الاعتماد"
                    value={formatDate(
                      selectedTask.approved_at
                    )}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {showCreate && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreate(false);
            }
          }}
        >
          <div className="drawer">
            <div className="drawerHeader">
              <div>
                <div className="eyebrow">
                  إدارة المهام
                </div>
                <h2>إنشاء مهمة جديدة</h2>
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
                <h3>بيانات المهمة</h3>

                <label>
                  عنوان المهمة
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        title: e.target.value,
                      })
                    }
                    placeholder="مثال: مراجعة بيانات المنتج"
                  />
                </label>

                <label>
                  الوصف
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        description: e.target.value,
                      })
                    }
                    placeholder="اكتب المطلوب من المهمة..."
                    rows={4}
                  />
                </label>

                <div className="twoColumns">
                  <label>
                    نوع المهمة
                    <input
                      value={form.task_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          task_type: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    الأولوية
                    <select
                      value={form.priority}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          priority: e.target.value,
                        })
                      }
                    >
                      <option value="low">
                        منخفضة
                      </option>
                      <option value="normal">
                        عادية
                      </option>
                      <option value="high">
                        عالية
                      </option>
                      <option value="urgent">
                        عاجلة
                      </option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="formSection">
                <h3>التعيين</h3>

                <label>
                  موظف AI
                  <select
                    value={form.ai_employee_id}
                    onChange={(e) => {
                      const employee =
                        employees.find(
                          (item) =>
                            item.id === e.target.value
                        );

                      setForm({
                        ...form,
                        ai_employee_id:
                          e.target.value,
                        department_id:
                          employee?.department_id ||
                          form.department_id,
                      });
                    }}
                  >
                    <option value="">
                      اختر موظف AI
                    </option>

                    {employees.map((employee) => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  القسم
                  <select
                    value={form.department_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        department_id: e.target.value,
                      })
                    }
                  >
                    <option value="">
                      اختر القسم
                    </option>

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
                    onChange={(e) =>
                      setForm({
                        ...form,
                        admin_id: e.target.value,
                      })
                    }
                  >
                    <option value="">
                      غير محدد
                    </option>

                    {admins.map((admin) => (
                      <option
                        key={admin.id}
                        value={admin.id}
                      >
                        {admin.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="formSection">
                <h3>التكلفة</h3>

                <div className="twoColumns">
                  <label>
                    النقاط
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.points_cost}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          points_cost: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    التكلفة التقديرية
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.estimated_cost}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          estimated_cost:
                            e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="formNotice">
                ℹ️ إنشاء المهمة هنا لا يشغّل OpenAI أو Runway.
                التنفيذ الذكي سيتم ربطه لاحقًا.
              </div>

              <button
                className="primaryButton full"
                disabled={saving}
                type="submit"
              >
                {saving
                  ? "جاري الحفظ..."
                  : "إنشاء المهمة"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showReview && selectedTask && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowReview(false);
            }
          }}
        >
          <div className="reviewDrawer">
            <div className="drawerHeader">
              <div>
                <div className="eyebrow">
                  مراجعة المهمة
                </div>
                <h2>{selectedTask.title}</h2>
              </div>

              <button
                className="closeButton"
                onClick={() => setShowReview(false)}
              >
                ×
              </button>
            </div>

            <label>
              نتيجة المهمة
              <textarea
                value={resultText}
                onChange={(e) =>
                  setResultText(e.target.value)
                }
                rows={7}
                placeholder="اكتب نتيجة المهمة..."
              />
            </label>

            <label>
              ملاحظات المراجعة
              <textarea
                value={reviewNotes}
                onChange={(e) =>
                  setReviewNotes(e.target.value)
                }
                rows={5}
                placeholder="اكتب ملاحظات المراجعة..."
              />
            </label>

            <div className="formNotice">
              بعد الحفظ تصبح المهمة بانتظار المراجعة
              والاعتماد.
            </div>

            <button
              className="primaryButton full"
              disabled={saving}
              onClick={saveReview}
            >
              {saving
                ? "جاري الحفظ..."
                : "حفظ المراجعة"}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #f6f8f7;
          direction: rtl;
          color: #17211c;
          font-family:
            Arial,
            "Noto Sans Arabic",
            sans-serif;
        }

        .shell {
          max-width: 1500px;
          margin: 0 auto;
          padding: 34px;
        }

        .header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #218c68;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        h1,
        h2,
        h3,
        p {
          margin: 0;
        }

        .header h1 {
          font-size: 32px;
          letter-spacing: -0.7px;
        }

        .header p {
          margin-top: 8px;
          color: #748078;
          font-size: 14px;
        }

        .primaryButton,
        .successButton,
        .secondaryButton,
        .dangerOutlineButton,
        .deleteButton {
          border: 0;
          border-radius: 12px;
          padding: 11px 16px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.18s ease;
          font-size: 13px;
        }

        .primaryButton {
          background: #218c68;
          color: white;
        }

        .primaryButton:hover {
          background: #197455;
        }

        .successButton {
          background: #16845d;
          color: white;
        }

        .secondaryButton {
          background: #eaf4ef;
          color: #17694e;
        }

        .dangerOutlineButton {
          background: white;
          border: 1px solid #efb9b9;
          color: #b33b3b;
        }

        .deleteButton {
          background: #fff1f1;
          color: #b33b3b;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .full {
          width: 100%;
          margin-top: 8px;
        }

        .errorBox {
          background: #fff3f3;
          border: 1px solid #f0c4c4;
          color: #a93636;
          padding: 13px 15px;
          border-radius: 13px;
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 18px;
        }

        .errorBox button {
          margin-right: auto;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .stat {
          background: white;
          border: 1px solid #e3eae6;
          border-radius: 15px;
          padding: 15px;
          min-width: 0;
        }

        .statIcon {
          font-size: 18px;
        }

        .statValue {
          font-size: 24px;
          font-weight: 900;
          margin-top: 8px;
        }

        .statTitle {
          color: #7a857f;
          font-size: 12px;
          margin-top: 4px;
        }

        .filters {
          background: white;
          border: 1px solid #e3eae6;
          border-radius: 16px;
          padding: 12px;
          display: grid;
          grid-template-columns: 1fr 190px 190px;
          gap: 10px;
          margin-bottom: 18px;
        }

        .searchBox {
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #e0e7e3;
          border-radius: 11px;
          padding: 0 12px;
          background: #fbfcfb;
        }

        .searchBox input {
          border: 0;
          outline: 0;
          background: transparent;
          width: 100%;
          padding: 12px 0;
          direction: rtl;
        }

        select,
        input,
        textarea {
          width: 100%;
          border: 1px solid #dfe7e2;
          background: white;
          border-radius: 11px;
          padding: 11px 12px;
          outline: none;
          font: inherit;
          color: #17211c;
        }

        textarea {
          resize: vertical;
          line-height: 1.7;
        }

        select:focus,
        input:focus,
        textarea:focus {
          border-color: #65ad91;
          box-shadow: 0 0 0 3px rgba(33, 140, 104, 0.08);
        }

        .workspace {
          display: grid;
          grid-template-columns: 390px minmax(0, 1fr);
          direction: ltr;
          gap: 18px;
        }

        .taskList,
        .details {
          direction: rtl;
          background: white;
          border: 1px solid #e3eae6;
          border-radius: 18px;
          overflow: hidden;
          min-height: 650px;
        }

        .listHeader {
          padding: 16px 18px;
          border-bottom: 1px solid #edf1ef;
          display: flex;
          justify-content: space-between;
        }

        .listHeader span {
          background: #edf7f2;
          color: #218c68;
          padding: 3px 9px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
        }

        .taskItem {
          display: block;
          width: 100%;
          text-align: right;
          border: 0;
          border-bottom: 1px solid #edf1ef;
          background: white;
          padding: 16px;
          cursor: pointer;
        }

        .taskItem:hover {
          background: #fafcfb;
        }

        .taskItem.selected {
          background: #f0f8f4;
          box-shadow: inset -3px 0 0 #218c68;
        }

        .taskItemTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .taskItemTop strong {
          line-height: 1.5;
          font-size: 14px;
        }

        .taskItemMeta {
          display: flex;
          gap: 12px;
          margin-top: 10px;
          color: #65716a;
          font-size: 11px;
        }

        .taskItemDate {
          color: #9aa39e;
          font-size: 10px;
          margin-top: 9px;
        }

        .status {
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          border-radius: 30px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 800;
        }

        .status.pending {
          background: #fff7df;
          color: #9b7215;
        }

        .status.processing {
          background: #e9f2ff;
          color: #28639a;
        }

        .status.completed {
          background: #e9f8ef;
          color: #16804f;
        }

        .status.failed {
          background: #fff0f0;
          color: #b83b3b;
        }

        .status.cancelled {
          background: #f0f1f1;
          color: #68716d;
        }

        .empty,
        .detailsEmpty {
          min-height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          color: #7c8781;
          text-align: center;
          padding: 30px;
        }

        .emptyIcon {
          font-size: 42px;
          margin-bottom: 12px;
        }

        .empty p,
        .detailsEmpty p {
          margin-top: 7px;
          font-size: 13px;
        }

        .details {
          padding: 25px;
          overflow: auto;
        }

        .detailsHeader {
          padding-bottom: 20px;
          border-bottom: 1px solid #edf1ef;
        }

        .detailsTitleRow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .detailsTitleRow h2 {
          font-size: 22px;
        }

        .detailsHeader p {
          color: #6f7b74;
          font-size: 13px;
          line-height: 1.8;
          margin-top: 9px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 20px 0;
        }

        .info {
          background: #f8faf9;
          border: 1px solid #e8eeeb;
          border-radius: 12px;
          padding: 12px;
        }

        .infoLabel {
          color: #89938e;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .infoValue {
          font-weight: 800;
          font-size: 12px;
          word-break: break-word;
        }

        .workflow {
          border-top: 1px solid #edf1ef;
          padding-top: 20px;
        }

        .workflowTitle,
        .sectionTitle {
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 13px;
        }

        .workflowSteps {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .workflowStep {
          border: 1px solid #e7ece9;
          background: #fafbfa;
          border-radius: 12px;
          padding: 11px;
          position: relative;
        }

        .workflowStep.active {
          background: #eff8f4;
          border-color: #cce8db;
        }

        .workflowStepTitle {
          font-size: 11px;
          font-weight: 800;
        }

        .workflowStepDate {
          display: block;
          color: #89938e;
          font-size: 9px;
          margin-top: 6px;
          line-height: 1.5;
        }

        .reviewCards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 18px 0;
        }

        .reviewCard {
          border: 1px solid #e4ebe7;
          border-radius: 12px;
          padding: 13px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          background: white;
        }

        .reviewCard span {
          color: #7c8781;
          font-size: 12px;
        }

        .reviewCard strong {
          font-size: 12px;
        }

        .resultBox,
        .notesBox,
        .failureBox {
          border-radius: 13px;
          padding: 15px;
          margin-top: 12px;
        }

        .resultBox {
          background: #f3faf6;
          border: 1px solid #d9eee3;
        }

        .notesBox {
          background: #f7f8ff;
          border: 1px solid #e4e5f4;
        }

        .failureBox {
          background: #fff4f4;
          border: 1px solid #efcccc;
          color: #9d3939;
        }

        .resultText {
          white-space: pre-wrap;
          line-height: 1.8;
          font-size: 13px;
        }

        .actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          padding: 20px 0;
          border-bottom: 1px solid #edf1ef;
        }

        .timeline {
          padding-top: 20px;
        }

        .timelineList {
          border-right: 2px solid #dce9e3;
          padding-right: 15px;
        }

        .timelineItem {
          position: relative;
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }

        .timelineDot {
          width: 9px;
          height: 9px;
          background: #218c68;
          border-radius: 50%;
          position: absolute;
          right: -20px;
          top: 5px;
        }

        .timelineItem strong {
          display: block;
          font-size: 12px;
        }

        .timelineItem small {
          display: block;
          color: #919a95;
          font-size: 10px;
          margin-top: 4px;
        }

        .muted {
          color: #8a938e;
          font-size: 12px;
        }

        .dates {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          margin-top: 20px;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(20, 28, 24, 0.32);
          z-index: 100;
          display: flex;
          justify-content: flex-start;
          align-items: stretch;
        }

        .drawer,
        .reviewDrawer {
          width: min(500px, 100%);
          background: white;
          height: 100%;
          overflow-y: auto;
          padding: 28px;
          box-shadow: -10px 0 35px rgba(0, 0, 0, 0.08);
        }

        .reviewDrawer {
          width: min(560px, 100%);
        }

        .drawerHeader {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 25px;
        }

        .drawerHeader h2 {
          font-size: 22px;
        }

        .closeButton {
          width: 36px;
          height: 36px;
          border: 1px solid #e2e8e4;
          background: white;
          border-radius: 10px;
          font-size: 24px;
          cursor: pointer;
          color: #66716b;
        }

        .formSection {
          padding: 18px 0;
          border-bottom: 1px solid #edf1ef;
        }

        .formSection h3 {
          font-size: 14px;
          margin-bottom: 15px;
        }

        label {
          display: block;
          color: #4c5851;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 14px;
        }

        label input,
        label textarea,
        label select {
          margin-top: 7px;
          font-weight: 400;
        }

        .twoColumns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .formNotice {
          background: #f0f7f4;
          border: 1px solid #dcece5;
          color: #4d665b;
          padding: 12px;
          border-radius: 11px;
          font-size: 11px;
          line-height: 1.7;
          margin: 15px 0;
        }

        @media (max-width: 1200px) {
          .stats {
            grid-template-columns: repeat(4, 1fr);
          }

          .workspace {
            grid-template-columns: 330px minmax(0, 1fr);
          }

          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .dates {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 900px) {
          .shell {
            padding: 20px;
          }

          .header {
            align-items: stretch;
            flex-direction: column;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .workspace {
            grid-template-columns: 1fr;
          }

          .taskList {
            min-height: auto;
          }

          .details {
            min-height: auto;
          }

          .workflowSteps {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .shell {
            padding: 13px;
          }

          .header h1 {
            font-size: 25px;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .infoGrid,
          .dates,
          .reviewCards,
          .twoColumns {
            grid-template-columns: 1fr;
          }

          .details {
            padding: 17px;
          }

          .workflowSteps {
            grid-template-columns: 1fr;
          }

          .drawer,
          .reviewDrawer {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ title, value, icon }) {
  return (
    <div className="stat">
      <div className="statIcon">{icon}</div>
      <div className="statValue">{value}</div>
      <div className="statTitle">{title}</div>

      <style jsx>{`
        .stat {
          background: white;
          border: 1px solid #e3eae6;
          border-radius: 15px;
          padding: 15px;
          min-width: 0;
        }

        .statIcon {
          font-size: 18px;
        }

        .statValue {
          font-size: 24px;
          font-weight: 900;
          margin-top: 8px;
        }

        .statTitle {
          color: #7a857f;
          font-size: 12px;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="info">
      <div className="infoLabel">{label}</div>
      <div className="infoValue">{value}</div>

      <style jsx>{`
        .info {
          background: #f8faf9;
          border: 1px solid #e8eeeb;
          border-radius: 12px;
          padding: 12px;
        }

        .infoLabel {
          color: #89938e;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .infoValue {
          font-weight: 800;
          font-size: 12px;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}

function WorkflowStep({ active, title, date }) {
  return (
    <div className={`workflowStep ${active ? "active" : ""}`}>
      <div className="workflowStepTitle">
        {active ? "✓ " : "○ "}
        {title}
      </div>

      <small className="workflowStepDate">
        {date ? formatDate(date) : "لم تبدأ بعد"}
      </small>

      <style jsx>{`
        .workflowStep {
          border: 1px solid #e7ece9;
          background: #fafbfa;
          border-radius: 12px;
          padding: 11px;
        }

        .workflowStep.active {
          background: #eff8f4;
          border-color: #cce8db;
        }

        .workflowStepTitle {
          font-size: 11px;
          font-weight: 800;
        }

        .workflowStepDate {
          display: block;
          color: #89938e;
          font-size: 9px;
          margin-top: 6px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
