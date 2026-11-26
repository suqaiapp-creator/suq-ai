"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function AdminActivityPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activities, setActivities] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [shops, setShops] = useState([]);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const [selectedActivity, setSelectedActivity] = useState(null);

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: adminProfile, error: adminError } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_super_admin, account_status")
        .eq("id", user.id)
        .single();

      if (adminError || !adminProfile?.is_super_admin) {
        router.replace("/dashboard");
        return;
      }

      const [
        { data: activityData, error: activityError },
        { data: profilesData },
        { data: shopsData },
      ] = await Promise.all([
        supabase
          .from("activity_logs")
          .select(
            `
              id,
              user_id,
              shop_id,
              action,
              entity_type,
              entity_id,
              description,
              metadata,
              created_at
            `
          )
          .order("created_at", { ascending: false })
          .limit(500),

        supabase
          .from("profiles")
          .select("id, full_name, role, account_status, is_super_admin"),

        supabase
          .from("shops")
          .select("id, owner_id, name"),
      ]);

      if (activityError) {
        throw activityError;
      }

      setActivities(activityData || []);
      setProfiles(profilesData || []);
      setShops(shopsData || []);
    } catch (error) {
      console.error("Admin activity error:", error);
      alert(error?.message || "حدث خطأ أثناء تحميل سجل النشاط.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const profileMap = useMemo(() => {
    const map = {};

    for (const profile of profiles) {
      map[profile.id] = profile;
    }

    return map;
  }, [profiles]);

  const shopMap = useMemo(() => {
    const map = {};

    for (const shop of shops) {
      map[shop.id] = shop;
    }

    return map;
  }, [shops]);

  function getUserName(activity) {
    const profile = profileMap[activity.user_id];

    if (profile?.full_name) {
      return profile.full_name;
    }

    if (profile?.is_super_admin) {
      return "Super Admin";
    }

    return "مستخدم";
  }

  function getShopName(activity) {
    if (!activity.shop_id) {
      return "—";
    }

    return shopMap[activity.shop_id]?.name || "متجر";
  }

  function getActionLabel(action) {
    const labels = {
      create: "إنشاء",
      created: "تم الإنشاء",
      update: "تعديل",
      updated: "تم التعديل",
      delete: "حذف",
      deleted: "تم الحذف",

      login: "تسجيل دخول",
      logout: "تسجيل خروج",

      product_created: "إضافة منتج",
      product_updated: "تعديل منتج",
      product_analyzed: "تحليل منتج",

      product_approved: "اعتماد منتج",
      product_review: "إرسال للمراجعة",
      product_locked: "قفل منتج",
      product_unlocked: "فتح منتج",
      product_violation: "مخالفة منتج",

      design_created: "إنشاء تصميم",
      design_generated: "توليد تصميم",

      video_created: "إنشاء فيديو",
      video_generated: "توليد فيديو",
      video_completed: "اكتمال فيديو",
      video_failed: "فشل فيديو",

      marketing_created: "إنشاء محتوى تسويقي",
      marketing_generated: "توليد محتوى تسويقي",

      user_activated: "تفعيل حساب",
      user_suspended: "تعليق حساب",
      user_blocked: "حظر حساب",

      admin_approve: "اعتماد إداري",
      admin_review: "مراجعة إدارية",
      admin_lock: "قفل إداري",
      admin_violation: "تسجيل مخالفة",

      moderation_approved: "اعتماد مراجعة",
      moderation_review: "إبقاء للمراجعة",
      moderation_locked: "قفل",
      moderation_violation: "مخالفة",

      shop_created: "إنشاء متجر",
      shop_updated: "تعديل متجر",

      ai_analysis: "تحليل بالذكاء الاصطناعي",
      ai_generation: "توليد بالذكاء الاصطناعي",
    };

    return labels[action] || action || "عملية";
  }

  function getEntityLabel(entityType) {
    const labels = {
      user: "مستخدم",
      profile: "حساب",
      shop: "متجر",
      product: "منتج",
      design: "تصميم",
      ad_image: "تصميم إعلاني",
      video: "فيديو",
      ad_video: "فيديو إعلاني",
      marketing: "تسويق",
      marketing_content: "محتوى تسويقي",
      moderation: "مراجعة",
      product_moderation: "مراجعة منتج",
      ai: "ذكاء اصطناعي",
      system: "النظام",
    };

    return labels[entityType] || entityType || "عام";
  }

  function getActionType(action) {
    const value = String(action || "").toLowerCase();

    if (
      value.includes("delete") ||
      value.includes("blocked") ||
      value.includes("violation") ||
      value.includes("lock")
    ) {
      return "danger";
    }

    if (
      value.includes("review") ||
      value.includes("pending") ||
      value.includes("failed") ||
      value.includes("suspend")
    ) {
      return "warning";
    }

    if (
      value.includes("create") ||
      value.includes("created") ||
      value.includes("approve") ||
      value.includes("approved") ||
      value.includes("completed") ||
      value.includes("activated")
    ) {
      return "success";
    }

    return "neutral";
  }

  function getActionStyle(action) {
    const type = getActionType(action);

    if (type === "success") {
      return {
        color: "#166534",
        background: "#dcfce7",
        border: "#bbf7d0",
      };
    }

    if (type === "warning") {
      return {
        color: "#92400e",
        background: "#fef3c7",
        border: "#fde68a",
      };
    }

    if (type === "danger") {
      return {
        color: "#991b1b",
        background: "#fee2e2",
        border: "#fecaca",
      };
    }

    return {
      color: "#374151",
      background: "#f3f4f6",
      border: "#e5e7eb",
    };
  }

  function formatDate(date) {
    if (!date) return "—";

    try {
      return new Intl.DateTimeFormat("ar-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date));
    } catch {
      return date;
    }
  }

  function getMetadataText(metadata) {
    if (!metadata) {
      return "لا توجد بيانات إضافية";
    }

    try {
      return JSON.stringify(metadata, null, 2);
    } catch {
      return String(metadata);
    }
  }

  const actionOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        activities
          .map((item) => item.action)
          .filter(Boolean)
      )
    );

    return values.sort();
  }, [activities]);

  const entityOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        activities
          .map((item) => item.entity_type)
          .filter(Boolean)
      )
    );

    return values.sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const userName = getUserName(activity);
      const shopName = getShopName(activity);
      const actionText = getActionLabel(activity.action);
      const entityText = getEntityLabel(activity.entity_type);
      const description = activity.description || "";

      const matchesSearch =
        !keyword ||
        userName.toLowerCase().includes(keyword) ||
        shopName.toLowerCase().includes(keyword) ||
        actionText.toLowerCase().includes(keyword) ||
        entityText.toLowerCase().includes(keyword) ||
        description.toLowerCase().includes(keyword);

      const matchesAction =
        actionFilter === "all" ||
        activity.action === actionFilter;

      const matchesEntity =
        entityFilter === "all" ||
        activity.entity_type === entityFilter;

      return matchesSearch && matchesAction && matchesEntity;
    });
  }, [
    activities,
    search,
    actionFilter,
    entityFilter,
    profileMap,
    shopMap,
  ]);

  const stats = useMemo(() => {
    const total = activities.length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const today = activities.filter((item) => {
      if (!item.created_at) return false;
      return new Date(item.created_at) >= todayStart;
    }).length;

    const adminActions = activities.filter((item) => {
      const action = String(item.action || "").toLowerCase();

      return (
        action.includes("admin") ||
        action.includes("moderation") ||
        action.includes("lock") ||
        action.includes("violation") ||
        action.includes("approve")
      );
    }).length;

    const aiActions = activities.filter((item) => {
      const action = String(item.action || "").toLowerCase();
      const entity = String(item.entity_type || "").toLowerCase();

      return (
        action.includes("ai") ||
        action.includes("analy") ||
        action.includes("generat") ||
        entity === "ai"
      );
    }).length;

    return {
      total,
      today,
      adminActions,
      aiActions,
    };
  }, [activities]);

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f0fdf4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Arial, Tahoma, sans-serif",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dcfce7",
            borderRadius: 20,
            padding: 30,
            color: "#166534",
            fontWeight: 700,
            boxShadow:
              "0 10px 30px rgba(22, 101, 52, 0.08)",
          }}
        >
          جاري تحميل سجل النشاط...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f0fdf4 0%, #ffffff 42%, #f8fafc 100%)",
        padding: "24px 16px 60px",
        fontFamily:
          "Arial, Tahoma, sans-serif",
        color: "#172033",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #dcfce7",
            borderRadius: 24,
            padding: 24,
            marginBottom: 20,
            boxShadow:
              "0 12px 35px rgba(22, 101, 52, 0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#dcfce7",
                  color: "#166534",
                  borderRadius: 999,
                  padding: "7px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  marginBottom: 10,
                }}
              >
                📋 سجل الإدارة
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  color: "#14532d",
                }}
              >
                سجل النشاط والإجراءات
              </h1>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "#64748b",
                  lineHeight: 1.8,
                }}
              >
                سجل مركزي لجميع العمليات المهمة التي تحدث داخل المنصة.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                style={{
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                  color: "#166534",
                  padding: "11px 16px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: refreshing
                    ? "not-allowed"
                    : "pointer",
                  opacity: refreshing ? 0.6 : 1,
                }}
              >
                {refreshing ? "جاري التحديث..." : "↻ تحديث"}
              </button>

              <button
                onClick={() => router.push("/admin")}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  padding: "11px 16px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                لوحة الإدارة
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {[
            {
              icon: "📋",
              title: "إجمالي العمليات",
              value: stats.total,
              color: "#166534",
              background: "#dcfce7",
            },
            {
              icon: "📅",
              title: "عمليات اليوم",
              value: stats.today,
              color: "#1d4ed8",
              background: "#dbeafe",
            },
            {
              icon: "🛡️",
              title: "إجراءات إدارية",
              value: stats.adminActions,
              color: "#92400e",
              background: "#fef3c7",
            },
            {
              icon: "🤖",
              title: "عمليات الذكاء الاصطناعي",
              value: stats.aiActions,
              color: "#6d28d9",
              background: "#ede9fe",
            },
          ].map((stat) => (
            <div
              key={stat.title}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 20,
                padding: 20,
                boxShadow:
                  "0 8px 24px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: stat.background,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 21,
                  marginBottom: 12,
                }}
              >
                {stat.icon}
              </div>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                {stat.title}
              </div>

              <div
                style={{
                  color: stat.color,
                  fontSize: 30,
                  fontWeight: 900,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </section>

        {/* Filters */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #dcfce7",
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            boxShadow:
              "0 8px 24px rgba(22, 101, 52, 0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) 220px 220px",
              gap: 12,
            }}
          >
            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="🔎 ابحث بالمستخدم أو المتجر أو العملية..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: "12px 14px",
                outline: "none",
                fontSize: 14,
              }}
            />

            <select
              value={actionFilter}
              onChange={(e) =>
                setActionFilter(e.target.value)
              }
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: "12px 14px",
                background: "#ffffff",
                fontSize: 14,
              }}
            >
              <option value="all">
                كل العمليات
              </option>

              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {getActionLabel(action)}
                </option>
              ))}
            </select>

            <select
              value={entityFilter}
              onChange={(e) =>
                setEntityFilter(e.target.value)
              }
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: "12px 14px",
                background: "#ffffff",
                fontSize: 14,
              }}
            >
              <option value="all">
                كل أنواع البيانات
              </option>

              {entityOptions.map((entity) => (
                <option key={entity} value={entity}>
                  {getEntityLabel(entity)}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Activity list */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #dcfce7",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 10px 30px rgba(22, 101, 52, 0.06)",
          }}
        >
          <div
            style={{
              padding: 20,
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 21,
                  color: "#14532d",
                }}
              >
                سجل العمليات
              </h2>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                عرض {filteredActivities.length} من{" "}
                {activities.length} عملية
              </p>
            </div>

            <div
              style={{
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              🛡️ Super Admin
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <div
              style={{
                padding: "70px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  marginBottom: 14,
                }}
              >
                📋
              </div>

              <h3
                style={{
                  margin: "0 0 8px",
                  color: "#166534",
                }}
              >
                لا توجد عمليات
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                }}
              >
                لا توجد سجلات مطابقة للفلاتر الحالية.
              </p>
            </div>
          ) : (
            <div>
              {filteredActivities.map((activity) => {
                const actionStyle = getActionStyle(
                  activity.action
                );

                return (
                  <button
                    key={activity.id}
                    onClick={() =>
                      setSelectedActivity(activity)
                    }
                    style={{
                      width: "100%",
                      border: 0,
                      borderBottom:
                        "1px solid #f1f5f9",
                      background: "#ffffff",
                      padding: 18,
                      textAlign: "right",
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns:
                        "auto minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "#ffffff";
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        background:
                          actionStyle.background,
                        border: `1px solid ${actionStyle.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                      }}
                    >
                      {getActionType(activity.action) ===
                      "danger"
                        ? "⛔"
                        : getActionType(
                            activity.action
                          ) === "warning"
                        ? "⚠️"
                        : getActionType(
                            activity.action
                          ) === "success"
                        ? "✅"
                        : "📋"}
                    </div>

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            background:
                              actionStyle.background,
                            color:
                              actionStyle.color,
                            border: `1px solid ${actionStyle.border}`,
                            borderRadius: 999,
                            padding: "4px 9px",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {getActionLabel(
                            activity.action
                          )}
                        </span>

                        <span
                          style={{
                            color: "#64748b",
                            fontSize: 12,
                          }}
                        >
                          {getEntityLabel(
                            activity.entity_type
                          )}
                        </span>
                      </div>

                      <div
                        style={{
                          color: "#172033",
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        {activity.description ||
                          getActionLabel(
                            activity.action
                          )}
                      </div>

                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          👤 {getUserName(activity)}
                        </span>

                        <span>
                          🏪 {getShopName(activity)}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(
                        activity.created_at
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Details modal */}
      {selectedActivity && (
        <div
          onClick={() =>
            setSelectedActivity(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15, 23, 42, 0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 24,
              padding: 24,
              boxShadow:
                "0 25px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 15,
                marginBottom: 20,
              }}
            >
              <div>
                <div
                  style={{
                    color: "#166534",
                    fontSize: 13,
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  تفاصيل العملية
                </div>

                <h2
                  style={{
                    margin: 0,
                    color: "#14532d",
                    fontSize: 24,
                  }}
                >
                  {getActionLabel(
                    selectedActivity.action
                  )}
                </h2>
              </div>

              <button
                onClick={() =>
                  setSelectedActivity(null)
                }
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border:
                    "1px solid #e5e7eb",
                  background: "#f8fafc",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginBottom: 18,
              }}
            >
              {[
                [
                  "المستخدم",
                  getUserName(selectedActivity),
                ],
                [
                  "المتجر",
                  getShopName(selectedActivity),
                ],
                [
                  "نوع البيانات",
                  getEntityLabel(
                    selectedActivity.entity_type
                  ),
                ],
                [
                  "التاريخ",
                  formatDate(
                    selectedActivity.created_at
                  ),
                ],
                [
                  "معرّف العملية",
                  selectedActivity.id,
                ],
                [
                  "معرّف العنصر",
                  selectedActivity.entity_id || "—",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      color: "#172033",
                      fontWeight: 800,
                      wordBreak: "break-word",
                      fontSize: 14,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#f0fdf4",
                border:
                  "1px solid #bbf7d0",
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: "#166534",
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                وصف العملية
              </div>

              <div
                style={{
                  color: "#374151",
                  lineHeight: 1.8,
                }}
              >
                {selectedActivity.description ||
                  "لا يوجد وصف إضافي."}
              </div>
            </div>

            <div>
              <div
                style={{
                  color: "#14532d",
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                البيانات الإضافية
              </div>

              <pre
                style={{
                  margin: 0,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: 16,
                  padding: 16,
                  overflowX: "auto",
                  fontSize: 12,
                  direction: "ltr",
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {getMetadataText(
                  selectedActivity.metadata
                )}
              </pre>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                onClick={() =>
                  setSelectedActivity(null)
                }
                style={{
                  border: 0,
                  background: "#166534",
                  color: "#ffffff",
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
