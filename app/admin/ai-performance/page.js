"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const STATUS_LABELS = {
  active: "نشط",
  inactive: "غير نشط",
  suspended: "موقوف",
};

function formatNumber(value, digits = 0) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("ar-AE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

function formatCost(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);

  if (!value) return "—";

  if (value < 60) {
    return `${Math.round(value)} ثانية`;
  }

  const minutes = Math.floor(value / 60);
  const remaining = Math.round(value % 60);

  if (remaining === 0) {
    return `${minutes} دقيقة`;
  }

  return `${minutes} د و ${remaining} ث`;
}

function getScoreClass(score) {
  const value = Number(score || 0);

  if (value >= 90) return "excellent";
  if (value >= 75) return "good";
  if (value >= 50) return "average";

  return "low";
}

function calculatePerformance(employee, tasks, storedPerformance) {
  const employeeTasks = tasks.filter(
    (task) => task.ai_employee_id === employee.id
  );

  const completed = employeeTasks.filter(
    (task) => task.status === "completed"
  );

  const failed = employeeTasks.filter(
    (task) => task.status === "failed"
  );

  const cancelled = employeeTasks.filter(
    (task) => task.status === "cancelled"
  );

  const total = employeeTasks.length;

  const completedWithTimes = completed.filter(
    (task) => task.started_at && task.completed_at
  );

  const durations = completedWithTimes
    .map((task) => {
      const start = new Date(task.started_at).getTime();
      const end = new Date(task.completed_at).getTime();

      if (!start || !end || end < start) return null;

      return (end - start) / 1000;
    })
    .filter(Boolean);

  const averageSpeed =
    durations.length > 0
      ? durations.reduce((sum, value) => sum + value, 0) /
        durations.length
      : Number(storedPerformance?.average_speed_seconds || 0);

  const fastest =
    durations.length > 0
      ? Math.min(...durations)
      : Number(storedPerformance?.fastest_task_seconds || 0);

  const slowest =
    durations.length > 0
      ? Math.max(...durations)
      : Number(storedPerformance?.slowest_task_seconds || 0);

  const totalCost = employeeTasks.reduce(
    (sum, task) => sum + Number(task.actual_cost || 0),
    0
  );

  const totalPoints = employeeTasks.reduce(
    (sum, task) => sum + Number(task.points_cost || 0),
    0
  );

  const successRate =
    total > 0 ? (completed.length / total) * 100 : 0;

  const failureRate =
    total > 0 ? (failed.length / total) * 100 : 0;

  const qualityScore =
    total > 0
      ? Math.min(
          100,
          successRate * 0.7 +
            (completed.length > 0 ? 30 : 0)
        )
      : 0;

  const efficiencyScore =
    total > 0
      ? Math.min(
          100,
          successRate * 0.8 +
            (averageSpeed > 0 && averageSpeed <= 60 ? 20 : 10)
        )
      : 0;

  const overallScore =
    total > 0
      ? Math.round(
          qualityScore * 0.45 +
            efficiencyScore * 0.35 +
            Number(employee.average_rating || 0) * 20 * 0.2
        )
      : 0;

  const lastTask =
    employeeTasks.length > 0
      ? employeeTasks
          .slice()
          .sort(
            (a, b) =>
              new Date(b.created_at || 0) -
              new Date(a.created_at || 0)
          )[0]
      : null;

  return {
    employee,
    total,
    completed: completed.length,
    failed: failed.length,
    cancelled: cancelled.length,
    successRate,
    failureRate,
    averageSpeed,
    fastest,
    slowest,
    totalCost,
    totalPoints,
    qualityScore,
    efficiencyScore,
    overallScore,
    lastTask,
    storedPerformance,
  };
}

export default function AIEmployeePerformancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [performanceRows, setPerformanceRows] = useState([]);

  const [selectedId, setSelectedId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("is_super_admin")
          .eq("id", user.id)
          .single();

      if (profileError || !profile?.is_super_admin) {
        window.location.href = "/dashboard";
        return;
      }

      const [
        employeesResult,
        tasksResult,
        performanceResult,
      ] = await Promise.all([
        supabase
          .from("ai_employees")
          .select("*")
          .order("created_at", { ascending: true }),

        supabase
          .from("ai_tasks")
          .select(
            `
              id,
              title,
              description,
              ai_employee_id,
              priority,
              status,
              task_type,
              points_cost,
              estimated_cost,
              actual_cost,
              started_at,
              completed_at,
              created_at,
              updated_at
            `
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("ai_employee_performance")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);

      if (employeesResult.error) {
        throw employeesResult.error;
      }

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (performanceResult.error) {
        throw performanceResult.error;
      }

      setEmployees(employeesResult.data || []);
      setTasks(tasksResult.data || []);
      setPerformanceRows(performanceResult.data || []);

      if (!selectedId && employeesResult.data?.length) {
        setSelectedId(employeesResult.data[0].id);
      }

      if (
        selectedId &&
        !employeesResult.data?.some(
          (employee) => employee.id === selectedId
        )
      ) {
        setSelectedId(
          employeesResult.data?.[0]?.id || null
        );
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر تحميل بيانات أداء موظفي AI."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(() => {
    return employees.map((employee) => {
      const stored = performanceRows.find(
        (item) =>
          item.ai_employee_id === employee.id &&
          item.period_type === "all_time"
      );

      return calculatePerformance(
        employee,
        tasks,
        stored
      );
    });
  }, [employees, tasks, performanceRows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        String(row.employee.name || "")
          .toLowerCase()
          .includes(keyword) ||
        String(row.employee.specialization || "")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        row.employee.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const selected = useMemo(() => {
    return rows.find(
      (row) => row.employee.id === selectedId
    );
  }, [rows, selectedId]);

  const stats = useMemo(() => {
    const totalEmployees = rows.length;

    const activeEmployees = rows.filter(
      (row) => row.employee.status === "active"
    ).length;

    const totalTasks = rows.reduce(
      (sum, row) => sum + row.total,
      0
    );

    const completedTasks = rows.reduce(
      (sum, row) => sum + row.completed,
      0
    );

    const failedTasks = rows.reduce(
      (sum, row) => sum + row.failed,
      0
    );

    const totalCost = rows.reduce(
      (sum, row) => sum + row.totalCost,
      0
    );

    const overall =
      rows.length > 0
        ? rows.reduce(
            (sum, row) => sum + row.overallScore,
            0
          ) / rows.length
        : 0;

    return {
      totalEmployees,
      activeEmployees,
      totalTasks,
      completedTasks,
      failedTasks,
      totalCost,
      overall,
    };
  }, [rows]);

  const savePerformance = async () => {
    if (!selected) return;

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const row = selected;

      const payload = {
        ai_employee_id: row.employee.id,
        period_type: "all_time",

        tasks_total: row.total,
        tasks_completed: row.completed,
        tasks_failed: row.failed,
        tasks_cancelled: row.cancelled,

        success_rate: Number(
          row.successRate.toFixed(2)
        ),

        failure_rate: Number(
          row.failureRate.toFixed(2)
        ),

        average_speed_seconds: Number(
          row.averageSpeed.toFixed(2)
        ),

        fastest_task_seconds: Number(
          row.fastest.toFixed(2)
        ),

        slowest_task_seconds: Number(
          row.slowest.toFixed(2)
        ),

        average_rating: Number(
          row.employee.average_rating || 0
        ),

        total_ratings: 0,

        total_points: Number(row.totalPoints || 0),

        total_cost: Number(
          row.totalCost.toFixed(6)
        ),

        quality_score: Number(
          row.qualityScore.toFixed(2)
        ),

        efficiency_score: Number(
          row.efficiencyScore.toFixed(2)
        ),

        overall_score: Number(
          row.overallScore.toFixed(2)
        ),

        last_task_at:
          row.lastTask?.created_at || null,

        updated_at: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from("ai_employee_performance")
        .upsert(payload, {
          onConflict:
            "ai_employee_id,period_type",
        });

      if (saveError) {
        throw saveError;
      }

      await supabase
        .from("ai_employees")
        .update({
          tasks_completed: row.completed,
          tasks_failed: row.failed,
          success_rate: Number(
            row.successRate.toFixed(2)
          ),
          average_speed_seconds: Number(
            row.averageSpeed.toFixed(2)
          ),
          total_cost: Number(
            row.totalCost.toFixed(6)
          ),
          last_active_at:
            row.lastTask?.created_at || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.employee.id);

      setMessage(
        "تم حفظ أداء الموظف وتحديث بياناته."
      );

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر حفظ بيانات الأداء."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="performance-page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f7f8;
          color: #17211b;
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
        select {
          font: inherit;
        }

        .performance-page {
          min-height: 100vh;
          padding: 28px;
        }

        .container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #138a55;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.6px;
        }

        .subtitle {
          margin: 8px 0 0;
          color: #68756d;
          font-size: 15px;
          line-height: 1.7;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .btn {
          border: 0;
          border-radius: 12px;
          padding: 11px 16px;
          cursor: pointer;
          font-weight: 800;
        }

        .btn-primary {
          background: #138a55;
          color: white;
        }

        .btn-secondary {
          background: white;
          border: 1px solid #dce5df;
          color: #344239;
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat {
          background: white;
          border: 1px solid #e1e8e3;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 4px 16px rgba(20, 45, 30, 0.04);
        }

        .stat-label {
          color: #718078;
          font-size: 13px;
          font-weight: 700;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 25px;
          font-weight: 900;
        }

        .workspace {
          display: grid;
          grid-template-columns: 390px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .panel {
          background: white;
          border: 1px solid #e1e8e3;
          border-radius: 18px;
          box-shadow: 0 4px 18px rgba(20, 45, 30, 0.04);
          overflow: hidden;
        }

        .panel-head {
          padding: 18px;
          border-bottom: 1px solid #edf1ee;
        }

        .panel-title {
          font-size: 17px;
          font-weight: 900;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 130px;
          gap: 8px;
          margin-top: 14px;
        }

        .input,
        .select {
          width: 100%;
          border: 1px solid #dce5df;
          background: #fafcfb;
          border-radius: 11px;
          padding: 11px 12px;
          outline: none;
        }

        .input:focus,
        .select:focus {
          border-color: #138a55;
          background: white;
        }

        .employee-list {
          max-height: 690px;
          overflow: auto;
        }

        .employee-item {
          padding: 16px 18px;
          border-bottom: 1px solid #edf1ee;
          cursor: pointer;
          transition: 0.15s;
        }

        .employee-item:hover {
          background: #f8fbf9;
        }

        .employee-item.selected {
          background: #eef8f2;
          border-right: 4px solid #138a55;
        }

        .employee-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .employee-name {
          font-weight: 900;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
        }

        .badge-active {
          background: #e7f7ee;
          color: #137346;
        }

        .badge-inactive {
          background: #f0f2f1;
          color: #68736d;
        }

        .badge-suspended {
          background: #fff1e8;
          color: #a65b25;
        }

        .employee-specialization {
          color: #68756d;
          font-size: 13px;
          margin-top: 5px;
        }

        .mini-score {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 13px;
          color: #68756d;
          font-size: 12px;
        }

        .score {
          font-weight: 900;
        }

        .excellent {
          color: #087b48;
        }

        .good {
          color: #3c8a3c;
        }

        .average {
          color: #b17819;
        }

        .low {
          color: #b54242;
        }

        .detail {
          padding: 22px;
        }

        .profile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 22px;
          border-bottom: 1px solid #edf1ee;
        }

        .profile-main {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .avatar {
          width: 62px;
          height: 62px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #e7f7ee;
          color: #138a55;
          font-size: 24px;
          font-weight: 900;
          overflow: hidden;
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-name {
          font-size: 23px;
          font-weight: 950;
        }

        .profile-meta {
          margin-top: 5px;
          color: #718078;
          font-size: 13px;
        }

        .overall {
          min-width: 120px;
          text-align: center;
        }

        .overall-value {
          font-size: 36px;
          font-weight: 950;
          line-height: 1;
        }

        .overall-label {
          margin-top: 6px;
          color: #718078;
          font-size: 12px;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .metric {
          border: 1px solid #e5ebe7;
          border-radius: 14px;
          padding: 16px;
          background: #fbfcfb;
        }

        .metric-label {
          color: #718078;
          font-size: 12px;
          font-weight: 700;
        }

        .metric-value {
          margin-top: 8px;
          font-size: 22px;
          font-weight: 950;
        }

        .sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 18px;
        }

        .section {
          border: 1px solid #e5ebe7;
          border-radius: 15px;
          padding: 18px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 15px;
        }

        .rows {
          display: grid;
          gap: 11px;
        }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          font-size: 13px;
        }

        .row-label {
          color: #718078;
        }

        .row-value {
          font-weight: 900;
        }

        .progress-wrap {
          margin-top: 15px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          color: #718078;
          font-size: 12px;
          margin-bottom: 7px;
        }

        .progress {
          height: 8px;
          border-radius: 999px;
          background: #e9eeeb;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #138a55;
          border-radius: inherit;
        }

        .empty {
          padding: 50px 20px;
          text-align: center;
          color: #718078;
        }

        .alert {
          margin-bottom: 16px;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 700;
        }

        .alert-error {
          background: #fff0f0;
          color: #a33434;
          border: 1px solid #f0cccc;
        }

        .alert-success {
          background: #eaf8f0;
          color: #137346;
          border: 1px solid #cbead8;
        }

        .description {
          margin-top: 15px;
          padding: 14px;
          background: #f7faf8;
          border-radius: 12px;
          color: #617068;
          line-height: 1.8;
          font-size: 13px;
        }

        .loading {
          padding: 80px 20px;
          text-align: center;
          color: #718078;
        }

        @media (max-width: 1200px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .workspace {
            grid-template-columns: 320px minmax(0, 1fr);
          }

          .metrics {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 850px) {
          .performance-page {
            padding: 16px;
          }

          .header {
            flex-direction: column;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .workspace {
            grid-template-columns: 1fr;
          }

          .employee-list {
            max-height: 420px;
          }

          .sections {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .stats {
            grid-template-columns: 1fr;
          }

          .metrics {
            grid-template-columns: 1fr 1fr;
          }

          .profile-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="container">
        <header className="header">
          <div>
            <div className="eyebrow">
              الإدارة الداخلية · موظفو AI
            </div>

            <h1>أداء موظفي AI</h1>

            <p className="subtitle">
              متابعة جودة وسرعة وكفاءة موظفي الذكاء الاصطناعي
              وربط الأداء بالمهام الفعلية.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={loadData}
              disabled={loading}
            >
              ↻ تحديث
            </button>

            {selected && (
              <button
                className="btn btn-primary"
                onClick={savePerformance}
                disabled={saving}
              >
                {saving
                  ? "جاري الحفظ..."
                  : "حفظ الأداء"}
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {message && (
          <div className="alert alert-success">
            {message}
          </div>
        )}

        {loading ? (
          <div className="panel loading">
            جاري تحميل بيانات الأداء...
          </div>
        ) : (
          <>
            <section className="stats">
              <div className="stat">
                <div className="stat-label">
                  موظفو AI
                </div>
                <div className="stat-value">
                  {formatNumber(
                    stats.totalEmployees
                  )}
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">
                  النشطون
                </div>
                <div className="stat-value">
                  {formatNumber(
                    stats.activeEmployees
                  )}
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">
                  إجمالي المهام
                </div>
                <div className="stat-value">
                  {formatNumber(
                    stats.totalTasks
                  )}
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">
                  المهام المكتملة
                </div>
                <div className="stat-value">
                  {formatNumber(
                    stats.completedTasks
                  )}
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">
                  المهام الفاشلة
                </div>
                <div className="stat-value">
                  {formatNumber(
                    stats.failedTasks
                  )}
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">
                  التكلفة
                </div>
                <div className="stat-value">
                  {formatCost(stats.totalCost)}
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title">
                    موظفو AI
                  </div>

                  <div className="filters">
                    <input
                      className="input"
                      value={search}
                      onChange={(e) =>
                        setSearch(e.target.value)
                      }
                      placeholder="ابحث عن موظف..."
                    />

                    <select
                      className="select"
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value)
                      }
                    >
                      <option value="all">
                        الكل
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

                <div className="employee-list">
                  {filteredRows.length === 0 ? (
                    <div className="empty">
                      لا يوجد موظفون مطابقون للبحث.
                    </div>
                  ) : (
                    filteredRows.map((row) => (
                      <div
                        key={row.employee.id}
                        className={`employee-item ${
                          selectedId === row.employee.id
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedId(
                            row.employee.id
                          )
                        }
                      >
                        <div className="employee-top">
                          <div className="employee-name">
                            {row.employee.name}
                          </div>

                          <span
                            className={`badge badge-${row.employee.status}`}
                          >
                            {STATUS_LABELS[
                              row.employee.status
                            ] ||
                              row.employee.status}
                          </span>
                        </div>

                        <div className="employee-specialization">
                          {row.employee.specialization ||
                            "بدون تخصص محدد"}
                        </div>

                        <div className="mini-score">
                          <span>
                            {row.total} مهمة
                          </span>

                          <span
                            className={`score ${getScoreClass(
                              row.overallScore
                            )}`}
                          >
                            {formatNumber(
                              row.overallScore
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel">
                {!selected ? (
                  <div className="empty">
                    اختر موظف AI لعرض تفاصيل الأداء.
                  </div>
                ) : (
                  <div className="detail">
                    <div className="profile-head">
                      <div className="profile-main">
                        <div className="avatar">
                          {selected.employee.avatar_url ? (
                            <img
                              src={
                                selected.employee
                                  .avatar_url
                              }
                              alt=""
                            />
                          ) : (
                            "🤖"
                          )}
                        </div>

                        <div>
                          <div className="profile-name">
                            {selected.employee.name}
                          </div>

                          <div className="profile-meta">
                            {selected.employee
                              .specialization ||
                              "مساعد AI"}
                          </div>
                        </div>
                      </div>

                      <div className="overall">
                        <div
                          className={`overall-value ${getScoreClass(
                            selected.overallScore
                          )}`}
                        >
                          {formatNumber(
                            selected.overallScore
                          )}
                          %
                        </div>

                        <div className="overall-label">
                          التقييم العام
                        </div>
                      </div>
                    </div>

                    <div className="metrics">
                      <div className="metric">
                        <div className="metric-label">
                          إجمالي المهام
                        </div>

                        <div className="metric-value">
                          {formatNumber(
                            selected.total
                          )}
                        </div>
                      </div>

                      <div className="metric">
                        <div className="metric-label">
                          نسبة النجاح
                        </div>

                        <div className="metric-value excellent">
                          {formatNumber(
                            selected.successRate,
                            1
                          )}
                          %
                        </div>
                      </div>

                      <div className="metric">
                        <div className="metric-label">
                          متوسط السرعة
                        </div>

                        <div className="metric-value">
                          {formatDuration(
                            selected.averageSpeed
                          )}
                        </div>
                      </div>

                      <div className="metric">
                        <div className="metric-label">
                          التكلفة
                        </div>

                        <div className="metric-value">
                          {formatCost(
                            selected.totalCost
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="sections">
                      <div className="section">
                        <div className="section-title">
                          نتائج المهام
                        </div>

                        <div className="rows">
                          <div className="row">
                            <span className="row-label">
                              مكتملة
                            </span>
                            <span className="row-value">
                              {formatNumber(
                                selected.completed
                              )}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              فاشلة
                            </span>
                            <span className="row-value">
                              {formatNumber(
                                selected.failed
                              )}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              ملغاة
                            </span>
                            <span className="row-value">
                              {formatNumber(
                                selected.cancelled
                              )}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              النقاط المستخدمة
                            </span>
                            <span className="row-value">
                              {formatNumber(
                                selected.totalPoints
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="progress-wrap">
                          <div className="progress-label">
                            <span>
                              نسبة النجاح
                            </span>
                            <span>
                              {formatNumber(
                                selected.successRate,
                                1
                              )}
                              %
                            </span>
                          </div>

                          <div className="progress">
                            <div
                              className="progress-bar"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    selected.successRate
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="section">
                        <div className="section-title">
                          السرعة والكفاءة
                        </div>

                        <div className="rows">
                          <div className="row">
                            <span className="row-label">
                              متوسط السرعة
                            </span>
                            <span className="row-value">
                              {formatDuration(
                                selected.averageSpeed
                              )}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              أسرع مهمة
                            </span>
                            <span className="row-value">
                              {formatDuration(
                                selected.fastest
                              )}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              أبطأ مهمة
                            </span>
                            <span className="row-value">
                              {formatDuration(
                                selected.slowest
                              )}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              الكفاءة
                            </span>
                            <span
                              className={`row-value ${getScoreClass(
                                selected.efficiencyScore
                              )}`}
                            >
                              {formatNumber(
                                selected.efficiencyScore,
                                1
                              )}
                              %
                            </span>
                          </div>
                        </div>

                        <div className="progress-wrap">
                          <div className="progress-label">
                            <span>
                              جودة الأداء
                            </span>
                            <span>
                              {formatNumber(
                                selected.qualityScore,
                                1
                              )}
                              %
                            </span>
                          </div>

                          <div className="progress">
                            <div
                              className="progress-bar"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    selected.qualityScore
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="section">
                        <div className="section-title">
                          التقييم
                        </div>

                        <div className="rows">
                          <div className="row">
                            <span className="row-label">
                              تقييم الموظف
                            </span>
                            <span className="row-value">
                              {formatNumber(
                                selected.employee
                                  .average_rating,
                                1
                              )}{" "}
                              / 5
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              المستوى
                            </span>
                            <span className="row-value">
                              {selected.employee.level ||
                                "—"}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              الحالة
                            </span>
                            <span className="row-value">
                              {STATUS_LABELS[
                                selected.employee
                                  .status
                              ] ||
                                selected.employee
                                  .status}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              آخر نشاط
                            </span>
                            <span className="row-value">
                              {selected.employee
                                .last_active_at
                                ? new Date(
                                    selected.employee
                                      .last_active_at
                                  ).toLocaleString(
                                    "ar-AE"
                                  )
                                : "لا يوجد"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="section">
                        <div className="section-title">
                          التكلفة
                        </div>

                        <div className="rows">
                          <div className="row">
                            <span className="row-label">
                              التكلفة الفعلية
                            </span>
                            <span className="row-value">
                              {formatCost(
                                selected.totalCost
                              )}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              تكلفة المهمة
                            </span>
                            <span className="row-value">
                              {selected.total > 0
                                ? formatCost(
                                    selected.totalCost /
                                      selected.total
                                  )
                                : "$0.0000"}
                            </span>
                          </div>

                          <div className="row">
                            <span className="row-label">
                              النقاط المستخدمة
                            </span>
                            <span className="row-value">
                              {formatNumber(
                                selected.totalPoints
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="description">
                          يتم تسجيل التكلفة من المهام
                          الفعلية. هذه الصفحة لا تقوم
                          بتشغيل أي نموذج AI ولا تستهلك
                          رصيد OpenAI أو Runway.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
