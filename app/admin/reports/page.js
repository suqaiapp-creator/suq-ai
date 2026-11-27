"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

function formatNumber(value = 0) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatMoney(value = 0) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function formatPercent(value = 0) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));

  if (total < 60) return `${total} ث`;

  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  if (minutes < 60) {
    return `${minutes} د ${secs} ث`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours} س ${mins} د`;
}

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

function StatCard({ icon, label, value, helper }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>

        {helper ? (
          <div className="stat-helper">{helper}</div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2>{title}</h2>

          {description ? (
            <p>{description}</p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [user, setUser] = useState(null);

  const [profiles, setProfiles] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [marketing, setMarketing] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [videos, setVideos] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [usage, setUsage] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [performance, setPerformance] = useState([]);

  const [period, setPeriod] = useState("all_time");

  async function loadData() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!currentUser) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      setUser(currentUser);

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, is_super_admin")
          .eq("id", currentUser.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        throw new Error(
          "غير مصرح. هذه الصفحة خاصة بـ Super Admin."
        );
      }

      const [
        profilesResult,
        shopsResult,
        productsResult,
        marketingResult,
        designsResult,
        videosResult,
        tasksResult,
        usageResult,
        employeesResult,
        performanceResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, role, account_status, is_super_admin, created_at, last_login_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("shops")
          .select(
            "id, owner_id, name, status, created_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("products")
          .select(
            "id, shop_id, name, brand, verification_status, ai_status, safety_status, safety_level, created_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("marketing_contents")
          .select(
            "id, shop_id, product_id, status, created_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("ad_images")
          .select(
            "id, shop_id, product_id, status, created_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("ad_videos")
          .select(
            "id, shop_id, product_id, status, provider, created_at, completed_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("ai_tasks")
          .select(
            "id, title, ai_employee_id, status, points_cost, estimated_cost, actual_cost, created_at, started_at, completed_at, updated_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("ai_usage")
          .select(
            "id, user_id, shop_id, product_id, operation, model, provider, status, total_tokens, estimated_cost, credits_used, created_at"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("ai_employees")
          .select(
            "id, name, specialization, status, level, tasks_completed, tasks_failed, success_rate, average_speed_seconds, total_cost, last_active_at"
          )
          .order("created_at", {
            ascending: true,
          }),

        supabase
          .from("ai_employee_performance")
          .select(
            "id, ai_employee_id, tasks_total, tasks_completed, tasks_failed, tasks_cancelled, success_rate, average_speed_seconds, total_cost, quality_score, efficiency_score, overall_score, updated_at"
          )
          .order("updated_at", {
            ascending: false,
          }),
      ]);

      const results = [
        profilesResult,
        shopsResult,
        productsResult,
        marketingResult,
        designsResult,
        videosResult,
        tasksResult,
        usageResult,
        employeesResult,
        performanceResult,
      ];

      const failed = results.find(
        (result) => result.error
      );

      if (failed?.error) {
        throw failed.error;
      }

      setProfiles(profilesResult.data || []);
      setShops(shopsResult.data || []);
      setProducts(productsResult.data || []);
      setMarketing(marketingResult.data || []);
      setDesigns(designsResult.data || []);
      setVideos(videosResult.data || []);
      setTasks(tasksResult.data || []);
      setUsage(usageResult.data || []);
      setEmployees(employeesResult.data || []);
      setPerformance(performanceResult.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err?.message || "تعذر تحميل التقارير."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * حالات المنتجات هنا متبادلة:
   *
   * 1. locked
   * 2. review
   * 3. verified
   * 4. processing
   * 5. other
   *
   * لذلك مجموع الحالات لا يتجاوز إجمالي المنتجات.
   */
  const productStatus = useMemo(() => {
    let locked = 0;
    let review = 0;
    let verified = 0;
    let processing = 0;
    let other = 0;

    products.forEach((product) => {
      const safety = String(
        product.safety_status || ""
      ).toLowerCase();

      const verification = String(
        product.verification_status || ""
      ).toLowerCase();

      const aiStatus = String(
        product.ai_status || ""
      ).toLowerCase();

      if (
        safety === "locked" ||
        safety === "violation" ||
        safety === "blocked"
      ) {
        locked += 1;
        return;
      }

      if (
        safety === "review" ||
        verification === "review" ||
        verification === "pending" ||
        verification === "unverified"
      ) {
        review += 1;
        return;
      }

      if (
        verification === "verified" ||
        verification === "approved" ||
        verification === "verified_by_ai" ||
        aiStatus === "completed"
      ) {
        verified += 1;
        return;
      }

      if (
        aiStatus === "processing" ||
        aiStatus === "pending" ||
        aiStatus === "analyzing"
      ) {
        processing += 1;
        return;
      }

      other += 1;
    });

    return {
      locked,
      review,
      verified,
      processing,
      other,
    };
  }, [products]);

  /*
   * نحسب أداء الموظفين مباشرة من ai_tasks.
   * هذا يجعل التقرير يعمل حتى لو لم يتم حفظ سجل
   * ai_employee_performance بعد.
   */
  const employeeReports = useMemo(() => {
    const employeeMap = new Map();

    employees.forEach((employee) => {
      employeeMap.set(employee.id, {
        employee,
        tasks: [],
      });
    });

    tasks.forEach((task) => {
      if (!task.ai_employee_id) return;

      if (!employeeMap.has(task.ai_employee_id)) {
        employeeMap.set(task.ai_employee_id, {
          employee: {
            id: task.ai_employee_id,
            name: "موظف AI",
            specialization: "غير محدد",
            status: "unknown",
            level: "—",
          },
          tasks: [],
        });
      }

      employeeMap
        .get(task.ai_employee_id)
        .tasks.push(task);
    });

    const savedPerformance = new Map();

    performance.forEach((item) => {
      if (
        !savedPerformance.has(item.ai_employee_id)
      ) {
        savedPerformance.set(
          item.ai_employee_id,
          item
        );
      }
    });

    return Array.from(employeeMap.values())
      .map((entry) => {
        const employee = entry.employee;
        const employeeTasks = entry.tasks;

        const total = employeeTasks.length;

        const completed = employeeTasks.filter(
          (task) => task.status === "completed"
        ).length;

        const failed = employeeTasks.filter(
          (task) => task.status === "failed"
        ).length;

        const cancelled = employeeTasks.filter(
          (task) => task.status === "cancelled"
        ).length;

        const completedWithTime =
          employeeTasks.filter(
            (task) =>
              task.status === "completed" &&
              task.completed_at &&
              (task.started_at ||
                task.created_at)
          );

        const durations =
          completedWithTime.map((task) => {
            const start = new Date(
              task.started_at ||
                task.created_at
            ).getTime();

            const end = new Date(
              task.completed_at
            ).getTime();

            return Math.max(
              0,
              Math.round((end - start) / 1000)
            );
          });

        const averageSpeed =
          durations.length > 0
            ? durations.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) / durations.length
            : Number(
                employee.average_speed_seconds || 0
              );

        const successRate =
          total > 0
            ? (completed / total) * 100
            : Number(
                employee.success_rate || 0
              );

        let speedScore = 0;

        if (averageSpeed > 0) {
          if (averageSpeed <= 60) {
            speedScore = 100;
          } else if (averageSpeed <= 300) {
            speedScore = 90;
          } else if (averageSpeed <= 600) {
            speedScore = 80;
          } else if (averageSpeed <= 1200) {
            speedScore = 70;
          } else {
            speedScore = 60;
          }
        }

        const qualityScore =
          successRate;

        const efficiencyScore =
          averageSpeed > 0
            ? successRate * 0.7 +
              speedScore * 0.3
            : successRate;

        const saved =
          savedPerformance.get(employee.id);

        const savedOverall =
          saved &&
          Number(saved.overall_score || 0) > 0
            ? Number(saved.overall_score)
            : null;

        const overallScore =
          savedOverall !== null
            ? savedOverall
            : averageSpeed > 0
            ? qualityScore * 0.65 +
              efficiencyScore * 0.35
            : qualityScore;

        const latestTask = [...employeeTasks]
          .sort((a, b) => {
            const dateA = new Date(
              a.completed_at ||
                a.updated_at ||
                a.created_at
            ).getTime();

            const dateB = new Date(
              b.completed_at ||
                b.updated_at ||
                b.created_at
            ).getTime();

            return dateB - dateA;
          })[0];

        const totalCost =
          employeeTasks.reduce(
            (sum, task) =>
              sum +
              Number(
                task.actual_cost ||
                  task.estimated_cost ||
                  0
              ),
            0
          );

        return {
          employee,
          total,
          completed,
          failed,
          cancelled,
          successRate,
          averageSpeed,
          qualityScore,
          efficiencyScore,
          overallScore,
          totalCost,
          latestTask,
        };
      })
      .filter(
        (item) =>
          item.total > 0 ||
          item.employee.status === "active"
      )
      .sort(
        (a, b) =>
          b.overallScore -
          a.overallScore
      );
  }, [
    employees,
    tasks,
    performance,
  ]);

  const report = useMemo(() => {
    const totalUsers = profiles.length;

    const activeUsers =
      profiles.filter(
        (item) =>
          item.account_status === "active"
      ).length;

    const totalShops = shops.length;

    const activeShops =
      shops.filter(
        (item) => item.status === "active"
      ).length;

    const totalProducts = products.length;

    const totalMarketing =
      marketing.length;

    const completedMarketing =
      marketing.filter(
        (item) =>
          String(item.status || "")
            .toLowerCase() ===
          "completed"
      ).length;

    const totalDesigns =
      designs.length;

    const completedDesigns =
      designs.filter(
        (item) =>
          String(item.status || "")
            .toLowerCase() ===
          "completed"
      ).length;

    const totalVideos =
      videos.length;

    const completedVideos =
      videos.filter(
        (item) =>
          String(item.status || "")
            .toLowerCase() ===
          "completed"
      ).length;

    const totalTasks =
      tasks.length;

    const completedTasks =
      tasks.filter(
        (item) =>
          item.status === "completed"
      ).length;

    const failedTasks =
      tasks.filter(
        (item) =>
          item.status === "failed"
      ).length;

    const cancelledTasks =
      tasks.filter(
        (item) =>
          item.status === "cancelled"
      ).length;

    const processingTasks =
      tasks.filter((item) =>
        [
          "pending",
          "in_progress",
          "processing",
        ].includes(item.status)
      ).length;

    const successfulUsage =
      usage.filter(
        (item) =>
          item.status === "completed" ||
          item.status === "success"
      ).length;

    const failedUsage =
      usage.filter(
        (item) =>
          item.status === "failed"
      ).length;

    const totalUsageCost =
      usage.reduce(
        (sum, item) =>
          sum +
          Number(
            item.estimated_cost || 0
          ),
        0
      );

    const openaiCost =
      usage
        .filter(
          (item) =>
            item.provider === "openai"
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.estimated_cost || 0
            ),
          0
        );

    const runwayCost =
      usage
        .filter(
          (item) =>
            item.provider === "runway"
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.estimated_cost || 0
            ),
          0
        );

    const runwayCredits =
      usage
        .filter(
          (item) =>
            item.provider === "runway"
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.credits_used || 0
            ),
          0
        );

    const totalCredits =
      usage.reduce(
        (sum, item) =>
          sum +
          Number(
            item.credits_used || 0
          ),
        0
      );

    const pointsUsed =
      tasks.reduce(
        (sum, item) =>
          sum +
          Number(
            item.points_cost || 0
          ),
        0
      );

    const completedWithTime =
      tasks.filter(
        (item) =>
          item.status === "completed" &&
          item.completed_at &&
          (item.started_at ||
            item.created_at)
      );

    const durations =
      completedWithTime.map(
        (item) => {
          const start =
            new Date(
              item.started_at ||
                item.created_at
            ).getTime();

          const end =
            new Date(
              item.completed_at
            ).getTime();

          return Math.max(
            0,
            Math.round(
              (end - start) / 1000
            )
          );
        }
      );

    const averageTaskSpeed =
      durations.length > 0
        ? durations.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / durations.length
        : 0;

    const successRate =
      totalTasks > 0
        ? (completedTasks /
            totalTasks) *
          100
        : 0;

    const failureRate =
      totalTasks > 0
        ? (failedTasks /
            totalTasks) *
          100
        : 0;

    const averageEmployeeScore =
      employeeReports.length > 0
        ? employeeReports.reduce(
            (sum, item) =>
              sum +
              Number(
                item.overallScore || 0
              ),
            0
          ) /
          employeeReports.length
        : 0;

    return {
      totalUsers,
      activeUsers,
      totalShops,
      activeShops,

      totalProducts,
      verifiedProducts:
        productStatus.verified,
      reviewProducts:
        productStatus.review,
      lockedProducts:
        productStatus.locked,
      processingProducts:
        productStatus.processing,
      otherProducts:
        productStatus.other,

      totalMarketing,
      completedMarketing,

      totalDesigns,
      completedDesigns,

      totalVideos,
      completedVideos,

      totalTasks,
      completedTasks,
      failedTasks,
      cancelledTasks,
      processingTasks,

      successfulUsage,
      failedUsage,

      totalUsageCost,
      openaiCost,
      runwayCost,
      runwayCredits,
      totalCredits,

      pointsUsed,

      averageTaskSpeed,
      successRate,
      failureRate,

      averageEmployeeScore,
    };
  }, [
    profiles,
    shops,
    products,
    marketing,
    designs,
    videos,
    tasks,
    usage,
    productStatus,
    employeeReports,
  ]);

  async function saveReport() {
    if (!user) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const title =
        period === "all_time"
          ? "التقرير الشامل"
          : period === "monthly"
          ? "التقرير الشهري"
          : period === "weekly"
          ? "التقرير الأسبوعي"
          : "التقرير اليومي";

      const { error: insertError } =
        await supabase
          .from("ai_reports")
          .insert({
            report_type:
              "overview",

            period_type:
              period,

            title,

            description:
              "تقرير شامل مبني على البيانات الفعلية المسجلة في سوق AI.",

            total_users:
              report.totalUsers,

            active_users:
              report.activeUsers,

            total_shops:
              report.totalShops,

            active_shops:
              report.activeShops,

            total_products:
              report.totalProducts,

            verified_products:
              report.verifiedProducts,

            review_products:
              report.reviewProducts,

            locked_products:
              report.lockedProducts,

            total_marketing:
              report.totalMarketing,

            total_designs:
              report.totalDesigns,

            total_videos:
              report.totalVideos,

            total_ai_tasks:
              report.totalTasks,

            completed_ai_tasks:
              report.completedTasks,

            failed_ai_tasks:
              report.failedTasks,

            total_ai_cost:
              report.totalUsageCost,

            openai_cost:
              report.openaiCost,

            runway_cost:
              report.runwayCost,

            total_ai_credits:
              report.totalCredits,

            runway_credits:
              report.runwayCredits,

            success_rate:
              report.successRate,

            failure_rate:
              report.failureRate,

            average_task_speed_seconds:
              report.averageTaskSpeed,

            total_points_used:
              report.pointsUsed,

            report_data: {
              processing_tasks:
                report.processingTasks,

              cancelled_tasks:
                report.cancelledTasks,

              processing_products:
                report.processingProducts,

              other_products:
                report.otherProducts,

              successful_usage:
                report.successfulUsage,

              failed_usage:
                report.failedUsage,

              average_employee_score:
                report.averageEmployeeScore,

              employees:
                employeeReports.map(
                  (item) => ({
                    id:
                      item.employee.id,

                    name:
                      item.employee.name,

                    tasks:
                      item.total,

                    completed:
                      item.completed,

                    failed:
                      item.failed,

                    success_rate:
                      item.successRate,

                    quality:
                      item.qualityScore,

                    efficiency:
                      item.efficiencyScore,

                    overall:
                      item.overallScore,

                    cost:
                      item.totalCost,
                  })
                ),

              generated_at:
                new Date().toISOString(),
            },

            generated_by:
              user.id,
          });

      if (insertError) {
        throw insertError;
      }

      setMessage(
        "تم حفظ التقرير بنجاح."
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر حفظ التقرير."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="page">
      <div className="container">

        <header className="topbar">
          <div>
            <div className="eyebrow">
              AI • REPORTS
            </div>

            <h1>
              التقارير والتحليلات
            </h1>

            <p>
              قراءة شاملة لأداء سوق AI
              وربط التقارير بالبيانات
              الفعلية للنظام.
            </p>
          </div>

          <div className="actions">

            <select
              value={period}
              onChange={(event) =>
                setPeriod(
                  event.target.value
                )
              }
              className="period-select"
            >
              <option value="all_time">
                كل الفترة
              </option>

              <option value="daily">
                اليومي
              </option>

              <option value="weekly">
                الأسبوعي
              </option>

              <option value="monthly">
                الشهري
              </option>
            </select>

            <button
              className="secondary-button"
              onClick={loadData}
              disabled={loading}
            >
              ↻ تحديث
            </button>

            <button
              className="primary-button"
              onClick={saveReport}
              disabled={
                saving || loading
              }
            >
              {saving
                ? "جاري الحفظ..."
                : "حفظ التقرير"}
            </button>

          </div>
        </header>

        {error ? (
          <div className="alert error">
            <strong>
              حدث خطأ
            </strong>

            <span>
              {error}
            </span>
          </div>
        ) : null}

        {message ? (
          <div className="alert success">
            <strong>
              تم
            </strong>

            <span>
              {message}
            </span>
          </div>
        ) : null}

        {loading ? (
          <div className="loading-card">
            <div className="spinner" />

            <div>
              <strong>
                جاري تحميل التقرير...
              </strong>

              <span>
                يتم جمع البيانات من أقسام
                سوق AI.
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="stats-grid">

              <StatCard
                icon="👥"
                label="المستخدمون"
                value={formatNumber(
                  report.totalUsers
                )}
                helper={`${formatNumber(
                  report.activeUsers
                )} نشط`}
              />

              <StatCard
                icon="🏪"
                label="المتاجر"
                value={formatNumber(
                  report.totalShops
                )}
                helper={`${formatNumber(
                  report.activeShops
                )} نشط`}
              />

              <StatCard
                icon="📦"
                label="المنتجات"
                value={formatNumber(
                  report.totalProducts
                )}
                helper={`${formatNumber(
                  report.verifiedProducts
                )} موثق`}
              />

              <StatCard
                icon="🤖"
                label="مهام AI"
                value={formatNumber(
                  report.totalTasks
                )}
                helper={`${formatNumber(
                  report.completedTasks
                )} مكتملة`}
              />

              <StatCard
                icon="📣"
                label="التسويق"
                value={formatNumber(
                  report.totalMarketing
                )}
                helper={`${formatNumber(
                  report.completedMarketing
                )} مكتمل`}
              />

              <StatCard
                icon="🎨"
                label="التصاميم"
                value={formatNumber(
                  report.totalDesigns
                )}
                helper={`${formatNumber(
                  report.completedDesigns
                )} مكتمل`}
              />

              <StatCard
                icon="🎬"
                label="الفيديوهات"
                value={formatNumber(
                  report.totalVideos
                )}
                helper={`${formatNumber(
                  report.completedVideos
                )} مكتمل`}
              />

              <StatCard
                icon="💰"
                label="تكلفة AI"
                value={formatMoney(
                  report.totalUsageCost
                )}
                helper={`${formatNumber(
                  report.totalCredits
                )} credits`}
              />

            </div>

            <div className="content-grid">

              <Section
                title="أداء العمليات"
                description="ملخص الإنتاج والتنفيذ داخل المنصة."
              >
                <div className="metric-list">

                  <div className="metric-row">
                    <span>
                      المهام المكتملة
                    </span>

                    <strong>
                      {formatNumber(
                        report.completedTasks
                      )}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span>
                      المهام قيد التنفيذ
                    </span>

                    <strong>
                      {formatNumber(
                        report.processingTasks
                      )}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span>
                      المهام الفاشلة
                    </span>

                    <strong>
                      {formatNumber(
                        report.failedTasks
                      )}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span>
                      المهام الملغاة
                    </span>

                    <strong>
                      {formatNumber(
                        report.cancelledTasks
                      )}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span>
                      نسبة النجاح
                    </span>

                    <strong>
                      {formatPercent(
                        report.successRate
                      )}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span>
                      نسبة الفشل
                    </span>

                    <strong>
                      {formatPercent(
                        report.failureRate
                      )}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span>
                      متوسط سرعة المهمة
                    </span>

                    <strong>
                      {formatDuration(
                        report.averageTaskSpeed
                      )}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span>
                      النقاط المستخدمة
                    </span>

                    <strong>
                      {formatNumber(
                        report.pointsUsed
                      )}
                    </strong>
                  </div>

                </div>
              </Section>

              <Section
                title="المنتجات"
                description="حالة المنتجات بشكل متبادل ودقيق."
              >
                <div className="product-summary">

                  <div className="summary-box">
                    <span>
                      إجمالي
                    </span>

                    <strong>
                      {report.totalProducts}
                    </strong>
                  </div>

                  <div className="summary-box good">
                    <span>
                      موثقة
                    </span>

                    <strong>
                      {report.verifiedProducts}
                    </strong>
                  </div>

                  <div className="summary-box warning">
                    <span>
                      مراجعة
                    </span>

                    <strong>
                      {report.reviewProducts}
                    </strong>
                  </div>

                  <div className="summary-box danger">
                    <span>
                      مقفلة
                    </span>

                    <strong>
                      {report.lockedProducts}
                    </strong>
                  </div>

                </div>

                <div className="product-extra">

                  <span>
                    قيد المعالجة:
                    {" "}
                    <strong>
                      {report.processingProducts}
                    </strong>
                  </span>

                  <span>
                    حالات أخرى:
                    {" "}
                    <strong>
                      {report.otherProducts}
                    </strong>
                  </span>

                </div>
              </Section>

              <Section
                title="تكلفة الذكاء الاصطناعي"
                description="التكلفة المسجلة من عمليات AI الفعلية."
              >
                <div className="cost-grid">

                  <div className="cost-card">
                    <span>
                      الإجمالي
                    </span>

                    <strong>
                      {formatMoney(
                        report.totalUsageCost
                      )}
                    </strong>
                  </div>

                  <div className="cost-card">
                    <span>
                      OpenAI
                    </span>

                    <strong>
                      {formatMoney(
                        report.openaiCost
                      )}
                    </strong>
                  </div>

                  <div className="cost-card">
                    <span>
                      Runway
                    </span>

                    <strong>
                      {formatMoney(
                        report.runwayCost
                      )}
                    </strong>
                  </div>

                  <div className="cost-card">
                    <span>
                      Runway Credits
                    </span>

                    <strong>
                      {formatNumber(
                        report.runwayCredits
                      )}
                    </strong>
                  </div>

                </div>
              </Section>

              <Section
                title="الإنتاج الإعلامي"
                description="حجم أعمال التسويق والتصميم والفيديو."
              >
                <div className="media-grid">

                  <div>
                    <span>
                      التسويق
                    </span>

                    <strong>
                      {report.totalMarketing}
                    </strong>
                  </div>

                  <div>
                    <span>
                      التصاميم
                    </span>

                    <strong>
                      {report.totalDesigns}
                    </strong>
                  </div>

                  <div>
                    <span>
                      الفيديوهات
                    </span>

                    <strong>
                      {report.totalVideos}
                    </strong>
                  </div>

                </div>
              </Section>

            </div>

            <Section
              title="أداء موظفي AI"
              description="الأداء محسوب مباشرة من المهام الفعلية."
            >

              {employeeReports.length === 0 ? (
                <div className="empty">
                  لا يوجد موظفو AI أو لا توجد
                  مهام مرتبطة بهم حتى الآن.
                </div>
              ) : (
                <div className="employee-table">

                  {employeeReports.map(
                    (item, index) => (
                      <div
                        className="employee-row"
                        key={
                          item.employee.id
                        }
                      >

                        <div className="rank">
                          #{index + 1}
                        </div>

                        <div className="employee-main">

                          <strong>
                            {item.employee.name ||
                              "موظف AI"}
                          </strong>

                          <span>
                            {item.employee
                              .specialization ||
                              "غير محدد"}
                          </span>

                        </div>

                        <div className="employee-stat">
                          <span>
                            المهام
                          </span>

                          <strong>
                            {item.total}
                          </strong>
                        </div>

                        <div className="employee-stat">
                          <span>
                            النجاح
                          </span>

                          <strong>
                            {formatPercent(
                              item.successRate
                            )}
                          </strong>
                        </div>

                        <div className="employee-stat">
                          <span>
                            الكفاءة
                          </span>

                          <strong>
                            {formatPercent(
                              item.efficiencyScore
                            )}
                          </strong>
                        </div>

                        <div className="employee-score">
                          {Number(
                            item.overallScore || 0
                          ).toFixed(0)}
                          %
                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </Section>

            <Section
              title="تفاصيل أداء الموظف"
              description="تفاصيل الأداء الحالية لكل موظف AI."
            >

              {employeeReports.length === 0 ? (
                <div className="empty">
                  لا توجد بيانات.
                </div>
              ) : (
                <div className="employee-details">

                  {employeeReports.map(
                    (item) => (
                      <div
                        className="employee-detail"
                        key={
                          `detail-${item.employee.id}`
                        }
                      >

                        <div className="detail-head">

                          <div>
                            <strong>
                              {item.employee.name}
                            </strong>

                            <span>
                              {item.employee
                                .specialization ||
                                "غير محدد"}
                            </span>
                          </div>

                          <div className="big-score">
                            {Number(
                              item.overallScore || 0
                            ).toFixed(0)}
                            %
                          </div>

                        </div>

                        <div className="detail-grid">

                          <div>
                            <span>
                              إجمالي المهام
                            </span>

                            <strong>
                              {item.total}
                            </strong>
                          </div>

                          <div>
                            <span>
                              مكتملة
                            </span>

                            <strong>
                              {item.completed}
                            </strong>
                          </div>

                          <div>
                            <span>
                              فاشلة
                            </span>

                            <strong>
                              {item.failed}
                            </strong>
                          </div>

                          <div>
                            <span>
                              النجاح
                            </span>

                            <strong>
                              {formatPercent(
                                item.successRate
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              الجودة
                            </span>

                            <strong>
                              {formatPercent(
                                item.qualityScore
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              الكفاءة
                            </span>

                            <strong>
                              {formatPercent(
                                item.efficiencyScore
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              متوسط السرعة
                            </span>

                            <strong>
                              {formatDuration(
                                item.averageSpeed
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              التكلفة
                            </span>

                            <strong>
                              {formatMoney(
                                item.totalCost
                              )}
                            </strong>
                          </div>

                        </div>

                        <div className="last-task">

                          <span>
                            آخر مهمة
                          </span>

                          <strong>
                            {item.latestTask?.title ||
                              "لا توجد مهمة"}
                          </strong>

                          <small>
                            {formatDate(
                              item.latestTask?.completed_at ||
                                item.latestTask?.updated_at ||
                                item.latestTask?.created_at
                            )}
                          </small>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </Section>

            <Section
              title="ملخص الاستخدام"
              description="عمليات الذكاء الاصطناعي المسجلة في النظام."
            >

              <div className="usage-summary">

                <div>
                  <span>
                    عمليات ناجحة
                  </span>

                  <strong>
                    {report.successfulUsage}
                  </strong>
                </div>

                <div>
                  <span>
                    عمليات فاشلة
                  </span>

                  <strong>
                    {report.failedUsage}
                  </strong>
                </div>

                <div>
                  <span>
                    إجمالي العمليات
                  </span>

                  <strong>
                    {usage.length}
                  </strong>
                </div>

                <div>
                  <span>
                    متوسط أداء موظفي AI
                  </span>

                  <strong>
                    {report.averageEmployeeScore.toFixed(
                      0
                    )}
                    %
                  </strong>
                </div>

              </div>

            </Section>

            <div className="footer-note">

              <span>
                آخر تحديث:
                {" "}
                {formatDate(
                  new Date().toISOString()
                )}
              </span>

              <span>
                هذه الصفحة للقراءة والتحليل
                ولا تشغّل أي نموذج AI.
              </span>

            </div>
          </>
        )}
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #f5f7f6;
          color: #18221d;
          padding: 32px 20px 60px;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 26px;
        }

        .eyebrow {
          color: #16834f;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }

        .topbar p {
          margin: 9px 0 0;
          color: #6a756f;
          font-size: 14px;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        button,
        select {
          font: inherit;
        }

        .period-select,
        .secondary-button,
        .primary-button {
          min-height: 44px;
          border-radius: 12px;
          padding: 0 15px;
          cursor: pointer;
        }

        .period-select,
        .secondary-button {
          border: 1px solid #d9e1dc;
          background: #fff;
          color: #27322c;
        }

        .primary-button {
          border: 1px solid #16834f;
          background: #16834f;
          color: #fff;
          font-weight: 800;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .alert {
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .alert.error {
          background: #fff0f0;
          border: 1px solid #ffd0d0;
          color: #a52323;
        }

        .alert.success {
          background: #eefaf3;
          border: 1px solid #ccefd9;
          color: #126b41;
        }

        .loading-card,
        .section,
        .stat-card {
          background: #fff;
          border: 1px solid #e2e8e4;
          border-radius: 20px;
          box-shadow: 0 8px 30px rgba(18, 44, 31, 0.04);
        }

        .loading-card {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          color: #637069;
        }

        .loading-card div:last-child {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid #d8e8df;
          border-top-color: #16834f;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: #edf8f2;
          display: grid;
          place-items: center;
          font-size: 22px;
          flex: 0 0 auto;
        }

        .stat-label {
          color: #748078;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 22px;
          font-weight: 900;
        }

        .stat-helper {
          margin-top: 3px;
          color: #16834f;
          font-size: 11px;
          font-weight: 700;
        }

        .content-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }

        .section {
          padding: 20px;
          margin-bottom: 18px;
        }

        .content-grid .section {
          margin-bottom: 0;
        }

        .section-header {
          margin-bottom: 16px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .section-header p {
          margin: 5px 0 0;
          color: #7a847f;
          font-size: 12px;
        }

        .metric-list {
          display: grid;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 13px 0;
          border-bottom: 1px solid #edf1ee;
          gap: 15px;
        }

        .metric-row:last-child {
          border-bottom: 0;
        }

        .metric-row span {
          color: #69746e;
          font-size: 13px;
        }

        .metric-row strong {
          font-size: 14px;
        }

        .product-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .summary-box {
          padding: 16px;
          border-radius: 14px;
          background: #f6f8f7;
        }

        .summary-box.good {
          background: #edf9f2;
        }

        .summary-box.warning {
          background: #fff8e9;
        }

        .summary-box.danger {
          background: #fff0f0;
        }

        .summary-box span,
        .summary-box strong {
          display: block;
        }

        .summary-box span {
          color: #707b75;
          font-size: 11px;
          margin-bottom: 7px;
        }

        .summary-box strong {
          font-size: 22px;
        }

        .product-extra {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 14px;
          color: #737e78;
          font-size: 12px;
        }

        .product-extra strong {
          color: #18221d;
        }

        .cost-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .cost-card {
          border: 1px solid #edf1ee;
          border-radius: 14px;
          padding: 15px;
        }

        .cost-card span,
        .cost-card strong {
          display: block;
        }

        .cost-card span {
          color: #748078;
          font-size: 11px;
          margin-bottom: 7px;
        }

        .cost-card strong {
          font-size: 18px;
        }

        .media-grid,
        .usage-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .media-grid > div,
        .usage-summary > div {
          background: #f7f9f8;
          border-radius: 14px;
          padding: 16px;
        }

        .media-grid span,
        .media-grid strong,
        .usage-summary span,
        .usage-summary strong {
          display: block;
        }

        .media-grid span,
        .usage-summary span {
          color: #748078;
          font-size: 11px;
          margin-bottom: 7px;
        }

        .media-grid strong,
        .usage-summary strong {
          font-size: 22px;
        }

        .employee-table {
          display: grid;
          gap: 8px;
        }

        .employee-row {
          display: grid;
          grid-template-columns: 50px minmax(180px, 1fr) repeat(3, 100px) 80px;
          align-items: center;
          gap: 12px;
          border: 1px solid #edf1ee;
          border-radius: 14px;
          padding: 13px;
        }

        .rank {
          color: #16834f;
          font-weight: 900;
        }

        .employee-main strong,
        .employee-main span,
        .employee-stat span,
        .employee-stat strong {
          display: block;
        }

        .employee-main strong {
          font-size: 13px;
        }

        .employee-main span,
        .employee-stat span {
          color: #7a847f;
          font-size: 11px;
          margin-top: 4px;
        }

        .employee-stat strong {
          font-size: 13px;
          margin-top: 4px;
        }

        .employee-score {
          min-width: 62px;
          text-align: center;
          padding: 8px 6px;
          border-radius: 10px;
          background: #edf8f2;
          color: #16834f;
          font-weight: 900;
        }

        .employee-details {
          display: grid;
          gap: 12px;
        }

        .employee-detail {
          border: 1px solid #e8eeea;
          border-radius: 16px;
          padding: 17px;
        }

        .detail-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 15px;
        }

        .detail-head strong,
        .detail-head span {
          display: block;
        }

        .detail-head strong {
          font-size: 16px;
        }

        .detail-head span {
          margin-top: 4px;
          color: #7a847f;
          font-size: 12px;
        }

        .big-score {
          color: #16834f;
          background: #edf8f2;
          border-radius: 12px;
          padding: 9px 14px;
          font-weight: 900;
          font-size: 18px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
        }

        .detail-grid > div {
          background: #f7f9f8;
          border-radius: 12px;
          padding: 12px;
        }

        .detail-grid span,
        .detail-grid strong {
          display: block;
        }

        .detail-grid span {
          color: #7a847f;
          font-size: 10px;
          margin-bottom: 6px;
        }

        .detail-grid strong {
          font-size: 15px;
        }

        .last-task {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #edf1ee;
        }

        .last-task span,
        .last-task strong,
        .last-task small {
          display: block;
        }

        .last-task span {
          color: #7a847f;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .last-task strong {
          font-size: 13px;
        }

        .last-task small {
          margin-top: 4px;
          color: #929b96;
          font-size: 10px;
        }

        .empty {
          padding: 35px 20px;
          text-align: center;
          color: #7b857f;
          border: 1px dashed #d9e1dc;
          border-radius: 14px;
        }

        .footer-note {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
          color: #87918b;
          font-size: 11px;
          padding: 2px 4px;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .employee-row {
            grid-template-columns:
              40px
              1fr
              repeat(2, 90px)
              70px;
          }

          .employee-stat:nth-of-type(4) {
            display: none;
          }

          .detail-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 20px 14px 45px;
          }

          .topbar {
            align-items: stretch;
            flex-direction: column;
          }

          h1 {
            font-size: 27px;
          }

          .actions {
            width: 100%;
          }

          .actions > * {
            flex: 1;
          }

          .stats-grid,
          .content-grid {
            grid-template-columns: 1fr;
          }

          .product-summary {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .media-grid,
          .usage-summary {
            grid-template-columns: 1fr;
          }

          .employee-row {
            grid-template-columns:
              36px
              1fr
              70px;
          }

          .employee-stat {
            display: none;
          }

          .employee-score {
            justify-self: end;
          }

          .detail-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .footer-note {
            flex-direction: column;
          }
        }

        @media (max-width: 430px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .actions {
            flex-direction: column;
          }

          .actions > * {
            width: 100%;
            flex: none;
          }

          .section,
          .stat-card {
            border-radius: 15px;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
