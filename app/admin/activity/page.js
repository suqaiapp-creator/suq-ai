"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminActivityPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

      if (
        profileError ||
        !profile ||
        (profile.is_super_admin !== true &&
          profile.role !== "super_admin")
      ) {
        router.replace("/dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) {
        console.error(error);
        setActivities([]);
        return;
      }

      const logs = data || [];

      const userIds = [
        ...new Set(
          logs
            .map((item) => item.user_id)
            .filter(Boolean)
        ),
      ];

      const shopIds = [
        ...new Set(
          logs
            .map((item) => item.shop_id)
            .filter(Boolean)
        ),
      ];

      let profiles = [];
      let shops = [];

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", userIds);

        profiles = profileData || [];
      }

      if (shopIds.length > 0) {
        const { data: shopData } = await supabase
          .from("shops")
          .select("id, name")
          .in("id", shopIds);

        shops = shopData || [];
      }

      const profileMap = {};
      profiles.forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      const shopMap = {};
      shops.forEach((shop) => {
        shopMap[shop.id] = shop;
      });

      const enriched = logs.map((log) => ({
        ...log,
        user: log.user_id
          ? profileMap[log.user_id] || null
          : null,
        shop: log.shop_id
          ? shopMap[log.shop_id] || null
          : null,
      }));

      setActivities(enriched);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function getActionInfo(action) {
    const value = String(action || "").toLowerCase();

    if (
      value.includes("lock") ||
      value.includes("locked") ||
      value.includes("قفل")
    ) {
      return {
        label: "قفل منتج",
        icon: "🔒",
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    if (
      value.includes("unlock") ||
      value.includes("unlocked") ||
      value.includes("فتح")
    ) {
      return {
        label: "فتح قفل",
        icon: "🔓",
        background: "#dbeafe",
        color: "#1d4ed8",
      };
    }

    if (
      value.includes("approve") ||
      value.includes("approved") ||
      value.includes("اعتماد")
    ) {
      return {
        label: "اعتماد",
        icon: "✅",
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (
      value.includes("product")
    ) {
      return {
        label: "منتج",
        icon: "📦",
        background: "#f3f4f6",
        color: "#374151",
      };
    }

    if (
      value.includes("marketing")
    ) {
      return {
        label: "تسويق",
        icon: "📢",
        background: "#fef3c7",
        color: "#92400e",
      };
    }

    if (
      value.includes("design")
    ) {
      return {
        label: "تصميم",
        icon: "🎨",
        background: "#ede9fe",
        color: "#6d28d9",
      };
    }

    if (
      value.includes("shop")
    ) {
      return {
        label: "محل",
        icon: "🏪",
        background: "#e0f2fe",
        color: "#0369a1",
      };
    }

    if (
      value.includes("login")
    ) {
      return {
        label: "تسجيل دخول",
        icon: "🔑",
        background: "#ecfccb",
        color: "#3f6212",
      };
    }

    if (
      value.includes("user")
    ) {
      return {
        label: "مستخدم",
        icon: "👤",
        background: "#f3e8ff",
        color: "#7e22ce",
      };
    }

    return {
      label: action || "نشاط",
      icon: "📌",
      background: "#f3f4f6",
      color: "#374151",
    };
  }

  const filteredActivities = activities.filter(
    (activity) => {
      const text = search.trim().toLowerCase();

      const actionInfo = getActionInfo(
        activity.action
      );

      const matchesSearch =
        !text ||
        [
          activity.action,
          activity.description,
          activity.entity_type,
          activity.user?.full_name,
          activity.shop?.name,
          actionInfo.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(text);

      let matchesFilter = true;

      if (filter === "products") {
        matchesFilter =
          String(activity.action || "")
            .toLowerCase()
            .includes("product") ||
          activity.entity_type === "product";
      }

      if (filter === "moderation") {
        const value = String(
          activity.action || ""
        ).toLowerCase();

        matchesFilter =
          value.includes("lock") ||
          value.includes("unlock") ||
          value.includes("approve") ||
          value.includes("moderation") ||
          value.includes("قفل") ||
          value.includes("فتح") ||
          value.includes("اعتماد");
      }

      if (filter === "marketing") {
        matchesFilter = String(
          activity.action || ""
        )
          .toLowerCase()
          .includes("marketing");
      }

      if (filter === "designs") {
        matchesFilter = String(
          activity.action || ""
        )
          .toLowerCase()
          .includes("design");
      }

      return matchesSearch && matchesFilter;
    }
  );

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        جاري تحميل سجل النشاط...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f7f7",
        padding: "25px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1250,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>
              📋 سجل النشاط
            </h1>

            <p
              style={{
                marginTop: 8,
                color: "#666",
              }}
            >
              جميع العمليات المهمة داخل النظام
            </p>
          </div>

          <Link
            href="/admin"
            style={{
              textDecoration: "none",
              background: "#111",
              color: "#fff",
              padding: "11px 18px",
              borderRadius: 12,
              fontWeight: "bold",
            }}
          >
            لوحة التحكم
          </Link>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="ابحث في النشاط أو اسم المستخدم أو المحل..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border: "1px solid #ddd",
              borderRadius: 12,
              fontSize: 15,
              marginBottom: 12,
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {[
              ["all", "الكل"],
              ["products", "المنتجات"],
              ["moderation", "المراجعة"],
              ["marketing", "التسويق"],
              ["designs", "التصاميم"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: "9px 14px",
                  cursor: "pointer",
                  background:
                    filter === value
                      ? "#111"
                      : "#fff",
                  color:
                    filter === value
                      ? "#fff"
                      : "#111",
                  fontWeight:
                    filter === value
                      ? "bold"
                      : "normal",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {filteredActivities.length === 0 ? (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: "#666",
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  marginBottom: 10,
                }}
              >
                📋
              </div>

              لا توجد أنشطة مسجلة حالياً.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 950,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8f8f8",
                    }}
                  >
                    {[
                      "النشاط",
                      "المستخدم",
                      "المحل",
                      "التفاصيل",
                      "التاريخ",
                    ].map((title) => (
                      <th
                        key={title}
                        style={{
                          padding: 14,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          borderBottom:
                            "1px solid #eee",
                        }}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredActivities.map(
                    (activity) => {
                      const info =
                        getActionInfo(
                          activity.action
                        );

                      return (
                        <tr
                          key={activity.id}
                          style={{
                            borderBottom:
                              "1px solid #eee",
                          }}
                        >
                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                gap: 7,
                                background:
                                  info.background,
                                color: info.color,
                                padding:
                                  "7px 10px",
                                borderRadius: 20,
                                fontSize: 13,
                                fontWeight:
                                  "bold",
                              }}
                            >
                              {info.icon}
                              {info.label}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {activity.user
                              ?.full_name ||
                              "غير معروف"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {activity.shop?.name ||
                              "بدون محل"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                              maxWidth: 400,
                            }}
                          >
                            {activity.description ||
                              "بدون تفاصيل"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                              whiteSpace:
                                "nowrap",
                              color: "#666",
                            }}
                          >
                            {activity.created_at
                              ? new Date(
                                  activity.created_at
                                ).toLocaleString(
                                  "ar-AE"
                                )
                              : "-"}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
