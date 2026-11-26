"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function AdminAIUsagePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [usage, setUsage] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [shops, setShops] = useState([]);

  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedUsage, setSelectedUsage] = useState(null);

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

      const { data: adminProfile, error: adminError } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, role, is_super_admin, account_status"
          )
          .eq("id", user.id)
          .single();

      if (
        adminError ||
        !adminProfile?.is_super_admin
      ) {
        router.replace("/dashboard");
        return;
      }

      const [
        { data: usageData, error: usageError },
        { data: profilesData },
        { data: shopsData },
      ] = await Promise.all([
        supabase
          .from("ai_usage")
          .select("*")
          .order("created_at", {
            ascending: false,
          })
          .limit(1000),

        supabase
          .from("profiles")
          .select(
            "id, full_name, role, account_status, is_super_admin"
          ),

        supabase
          .from("shops")
          .select("id, owner_id, name"),
      ]);

      if (usageError) {
        throw usageError;
      }

      setUsage(usageData || []);
      setProfiles(profilesData || []);
      setShops(shopsData || []);
    } catch (error) {
      console.error(
        "Admin AI usage error:",
        error
      );

      alert(
        error?.message ||
          "حدث خطأ أثناء تحميل استهلاك الذكاء الاصطناعي."
      );
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

    profiles.forEach((profile) => {
      map[profile.id] = profile;
    });

    return map;
  }, [profiles]);

  const shopMap = useMemo(() => {
    const map = {};

    shops.forEach((shop) => {
      map[shop.id] = shop;
    });

    return map;
  }, [shops]);

  function firstValue(row, keys, fallback = null) {
    for (const key of keys) {
      if (
        row &&
        row[key] !== undefined &&
        row[key] !== null &&
        row[key] !== ""
      ) {
        return row[key];
      }
    }

    return fallback;
  }

  function getProvider(row) {
    return firstValue(
      row,
      [
        "provider",
        "service",
        "engine",
        "vendor",
      ],
      "غير محدد"
    );
  }

  function getModel(row) {
    return firstValue(
      row,
      [
        "model",
        "model_name",
        "model_id",
      ],
      "—"
    );
  }

  function getStatus(row) {
    return firstValue(
      row,
      [
        "status",
        "result",
        "state",
      ],
      "unknown"
    );
  }

  function getOperation(row) {
    return firstValue(
      row,
      [
        "operation",
        "action",
        "type",
        "operation_type",
      ],
      "عملية ذكاء اصطناعي"
    );
  }

  function getCost(row) {
    const value = firstValue(
      row,
      [
        "cost",
        "estimated_cost",
        "cost_usd",
        "amount",
        "price",
      ],
      0
    );

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function getTokens(row) {
    const value = firstValue(
      row,
      [
        "total_tokens",
        "tokens",
        "token_count",
        "usage_tokens",
      ],
      0
    );

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function getCredits(row) {
    const value = firstValue(
      row,
      [
        "credits",
        "credit_used",
        "credits_used",
        "runway_credits",
      ],
      0
    );

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function getUserId(row) {
    return firstValue(
      row,
      [
        "user_id",
        "owner_id",
      ],
      null
    );
  }

  function getShopId(row) {
    return firstValue(
      row,
      [
        "shop_id",
      ],
      null
    );
  }

  function getUserName(row) {
    const userId = getUserId(row);

    if (!userId) {
      return "—";
    }

    return (
      profileMap[userId]?.full_name ||
      "مستخدم"
    );
  }

  function getShopName(row) {
    const shopId = getShopId(row);

    if (!shopId) {
      return "—";
    }

    return (
      shopMap[shopId]?.name ||
      "متجر"
    );
  }

  function getStatusLabel(status) {
    const value = String(
      status || ""
    ).toLowerCase();

    if (
      value === "success" ||
      value === "completed" ||
      value === "succeeded" ||
      value === "done"
    ) {
      return "ناجحة";
    }

    if (
      value === "failed" ||
      value === "error"
    ) {
      return "فاشلة";
    }

    if (
      value === "processing" ||
      value === "running"
    ) {
      return "قيد التنفيذ";
    }

    if (
      value === "pending"
    ) {
      return "معلقة";
    }

    return status || "غير محدد";
  }

  function getStatusStyle(status) {
    const value = String(
      status || ""
    ).toLowerCase();

    if (
      value === "success" ||
      value === "completed" ||
      value === "succeeded" ||
      value === "done"
    ) {
      return {
        color: "#166534",
        background: "#dcfce7",
        border: "#bbf7d0",
      };
    }

    if (
      value === "failed" ||
      value === "error"
    ) {
      return {
        color: "#991b1b",
        background: "#fee2e2",
        border: "#fecaca",
      };
    }

    if (
      value === "processing" ||
      value === "running" ||
      value === "pending"
    ) {
      return {
        color: "#92400e",
        background: "#fef3c7",
        border: "#fde68a",
      };
    }

    return {
      color: "#374151",
      background: "#f3f4f6",
      border: "#e5e7eb",
    };
  }

  function formatDate(date) {
    if (!date) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "ar-AE",
        {
          dateStyle: "medium",
          timeStyle: "short",
        }
      ).format(new Date(date));
    } catch {
      return date;
    }
  }

  function getProviderKey(row) {
    return String(
      getProvider(row)
    )
      .trim()
      .toLowerCase();
  }

  const providerOptions = useMemo(() => {
    return Array.from(
      new Set(
        usage
          .map((item) =>
            getProvider(item)
          )
          .filter(Boolean)
      )
    ).sort();
  }, [usage]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(
        usage
          .map((item) =>
            getStatus(item)
          )
          .filter(Boolean)
      )
    ).sort();
  }, [usage]);

  const filteredUsage = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return usage.filter((row) => {
      const provider =
        String(
          getProvider(row)
        ).toLowerCase();

      const model =
        String(
          getModel(row)
        ).toLowerCase();

      const operation =
        String(
          getOperation(row)
        ).toLowerCase();

      const user =
        String(
          getUserName(row)
        ).toLowerCase();

      const shop =
        String(
          getShopName(row)
        ).toLowerCase();

      const status =
        String(
          getStatus(row)
        ).toLowerCase();

      const matchesSearch =
        !keyword ||
        provider.includes(keyword) ||
        model.includes(keyword) ||
        operation.includes(keyword) ||
        user.includes(keyword) ||
        shop.includes(keyword) ||
        status.includes(keyword);

      const matchesProvider =
        providerFilter === "all" ||
        getProviderKey(row) ===
          providerFilter;

      const matchesStatus =
        statusFilter === "all" ||
        String(
          getStatus(row)
        ).toLowerCase() ===
          statusFilter;

      return (
        matchesSearch &&
        matchesProvider &&
        matchesStatus
      );
    });
  }, [
    usage,
    search,
    providerFilter,
    statusFilter,
    profileMap,
    shopMap,
  ]);

  const stats = useMemo(() => {
    const total = usage.length;

    const successful = usage.filter(
      (row) => {
        const value =
          String(
            getStatus(row)
          ).toLowerCase();

        return [
          "success",
          "completed",
          "succeeded",
          "done",
        ].includes(value);
      }
    ).length;

    const failed = usage.filter(
      (row) => {
        const value =
          String(
            getStatus(row)
          ).toLowerCase();

        return [
          "failed",
          "error",
        ].includes(value);
      }
    ).length;

    const processing = usage.filter(
      (row) => {
        const value =
          String(
            getStatus(row)
          ).toLowerCase();

        return [
          "processing",
          "running",
          "pending",
        ].includes(value);
      }
    ).length;

    const totalCost = usage.reduce(
      (sum, row) =>
        sum + getCost(row),
      0
    );

    const totalTokens = usage.reduce(
      (sum, row) =>
        sum + getTokens(row),
      0
    );

    const totalCredits = usage.reduce(
      (sum, row) =>
        sum + getCredits(row),
      0
    );

    const runwayCount =
      usage.filter((row) => {
        const provider =
          getProviderKey(row);

        return (
          provider.includes("runway")
        );
      }).length;

    const openaiCount =
      usage.filter((row) => {
        const provider =
          getProviderKey(row);

        return (
          provider.includes("openai")
        );
      }).length;

    return {
      total,
      successful,
      failed,
      processing,
      totalCost,
      totalTokens,
      totalCredits,
      runwayCount,
      openaiCount,
    };
  }, [usage]);

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
            border:
              "1px solid #dcfce7",
            borderRadius: 20,
            padding: 30,
            color: "#166534",
            fontWeight: 800,
            boxShadow:
              "0 10px 30px rgba(22,101,52,0.08)",
          }}
        >
          جاري تحميل استهلاك الذكاء الاصطناعي...
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
        padding:
          "24px 16px 60px",
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
            border:
              "1px solid #dcfce7",
            borderRadius: 24,
            padding: 24,
            marginBottom: 20,
            boxShadow:
              "0 12px 35px rgba(22,101,52,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  gap: 8,
                  background:
                    "#dcfce7",
                  color:
                    "#166534",
                  borderRadius: 999,
                  padding:
                    "7px 12px",
                  fontSize: 13,
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
                🤖 مراقبة الذكاء الاصطناعي
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  color: "#14532d",
                }}
              >
                استهلاك الذكاء الاصطناعي
              </h1>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  color:
                    "#64748b",
                  lineHeight: 1.8,
                }}
              >
                متابعة عمليات الذكاء الاصطناعي
                والاستهلاك والتكلفة التقديرية
                بدون تشغيل أي عملية جديدة.
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
                onClick={() =>
                  loadData(true)
                }
                disabled={
                  refreshing
                }
                style={{
                  border:
                    "1px solid #bbf7d0",
                  background:
                    "#f0fdf4",
                  color:
                    "#166534",
                  padding:
                    "11px 16px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor:
                    refreshing
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    refreshing
                      ? 0.6
                      : 1,
                }}
              >
                {refreshing
                  ? "جاري التحديث..."
                  : "↻ تحديث"}
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
                style={{
                  border:
                    "1px solid #d1d5db",
                  background:
                    "#ffffff",
                  color:
                    "#374151",
                  padding:
                    "11px 16px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor:
                    "pointer",
                }}
              >
                لوحة الإدارة
              </button>
            </div>
          </div>
        </section>

        {/* Main stats */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {[
            {
              icon: "🤖",
              title:
                "إجمالي العمليات",
              value:
                stats.total,
              color:
                "#166534",
              background:
                "#dcfce7",
            },
            {
              icon: "✅",
              title:
                "ناجحة",
              value:
                stats.successful,
              color:
                "#166534",
              background:
                "#dcfce7",
            },
            {
              icon: "⛔",
              title:
                "فاشلة",
              value:
                stats.failed,
              color:
                "#991b1b",
              background:
                "#fee2e2",
            },
            {
              icon: "⏳",
              title:
                "قيد التنفيذ",
              value:
                stats.processing,
              color:
                "#92400e",
              background:
                "#fef3c7",
            },
            {
              icon: "💵",
              title:
                "التكلفة التقديرية",
              value:
                `$${stats.totalCost.toFixed(
                  4
                )}`,
              color:
                "#1d4ed8",
              background:
                "#dbeafe",
            },
            {
              icon: "🎟️",
              title:
                "Credits المستخدمة",
              value:
                stats.totalCredits,
              color:
                "#6d28d9",
              background:
                "#ede9fe",
            },
          ].map((stat) => (
            <div
              key={stat.title}
              style={{
                background:
                  "#ffffff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 20,
                padding: 20,
                boxShadow:
                  "0 8px 24px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background:
                    stat.background,
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: 21,
                  marginBottom: 12,
                }}
              >
                {stat.icon}
              </div>

              <div
                style={{
                  color:
                    "#64748b",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                {stat.title}
              </div>

              <div
                style={{
                  color:
                    stat.color,
                  fontSize: 27,
                  fontWeight: 900,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </section>

        {/* Provider overview */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background:
                "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 20,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 28,
                marginBottom: 8,
              }}
            >
              🧠
            </div>

            <div
              style={{
                color:
                  "#64748b",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              عمليات OpenAI
            </div>

            <strong
              style={{
                fontSize: 25,
                color:
                  "#166534",
              }}
            >
              {stats.openaiCount}
            </strong>
          </div>

          <div
            style={{
              background:
                "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 20,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 28,
                marginBottom: 8,
              }}
            >
              🎬
            </div>

            <div
              style={{
                color:
                  "#64748b",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              عمليات Runway
            </div>

            <strong
              style={{
                fontSize: 25,
                color:
                  "#166534",
              }}
            >
              {stats.runwayCount}
            </strong>
          </div>

          <div
            style={{
              background:
                "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 20,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 28,
                marginBottom: 8,
              }}
            >
              🔢
            </div>

            <div
              style={{
                color:
                  "#64748b",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              إجمالي Tokens
            </div>

            <strong
              style={{
                fontSize: 25,
                color:
                  "#166534",
              }}
            >
              {stats.totalTokens.toLocaleString(
                "en-US"
              )}
            </strong>
          </div>
        </section>

        {/* Filters */}
        <section
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #dcfce7",
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
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
                setSearch(
                  e.target.value
                )
              }
              placeholder="🔎 ابحث بالمزود أو الموديل أو العملية..."
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                border:
                  "1px solid #d1d5db",
                borderRadius: 12,
                padding:
                  "12px 14px",
                outline:
                  "none",
                fontSize: 14,
              }}
            />

            <select
              value={
                providerFilter
              }
              onChange={(e) =>
                setProviderFilter(
                  e.target.value
                )
              }
              style={{
                border:
                  "1px solid #d1d5db",
                borderRadius: 12,
                padding:
                  "12px 14px",
                background:
                  "#ffffff",
                fontSize: 14,
              }}
            >
              <option value="all">
                كل المزودين
              </option>

              {providerOptions.map(
                (provider) => (
                  <option
                    key={provider}
                    value={String(
                      provider
                    )
                      .trim()
                      .toLowerCase()}
                  >
                    {provider}
                  </option>
                )
              )}
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              style={{
                border:
                  "1px solid #d1d5db",
                borderRadius: 12,
                padding:
                  "12px 14px",
                background:
                  "#ffffff",
                fontSize: 14,
              }}
            >
              <option value="all">
                كل الحالات
              </option>

              {statusOptions.map(
                (status) => (
                  <option
                    key={status}
                    value={String(
                      status
                    ).toLowerCase()}
                  >
                    {getStatusLabel(
                      status
                    )}
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        {/* Usage table */}
        <section
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #dcfce7",
            borderRadius: 22,
            overflow:
              "hidden",
            boxShadow:
              "0 10px 30px rgba(22,101,52,0.06)",
          }}
        >
          <div
            style={{
              padding: 20,
              borderBottom:
                "1px solid #e5e7eb",
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 21,
                  color:
                    "#14532d",
                }}
              >
                سجل استهلاك الذكاء الاصطناعي
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "#64748b",
                  fontSize: 14,
                }}
              >
                عرض{" "}
                {
                  filteredUsage.length
                }{" "}
                من{" "}
                {usage.length}{" "}
                عملية
              </p>
            </div>

            <div
              style={{
                background:
                  "#f0fdf4",
                color:
                  "#166534",
                border:
                  "1px solid #bbf7d0",
                borderRadius:
                  999,
                padding:
                  "7px 12px",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              💰 مراقبة التكلفة
            </div>
          </div>

          {filteredUsage.length ===
          0 ? (
            <div
              style={{
                padding:
                  "70px 20px",
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  marginBottom: 14,
                }}
              >
                🤖
              </div>

              <h3
                style={{
                  margin:
                    "0 0 8px",
                  color:
                    "#166534",
                }}
              >
                لا توجد عمليات مسجلة
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    "#64748b",
                }}
              >
                لا توجد بيانات مطابقة للفلاتر الحالية.
              </p>
            </div>
          ) : (
            <div>
              {filteredUsage.map(
                (row) => {
                  const statusStyle =
                    getStatusStyle(
                      getStatus(row)
                    );

                  return (
                    <button
                      key={
                        row.id ||
                        `${getProvider(
                          row
                        )}-${row.created_at}`
                      }
                      onClick={() =>
                        setSelectedUsage(
                          row
                        )
                      }
                      style={{
                        width:
                          "100%",
                        border: 0,
                        borderBottom:
                          "1px solid #f1f5f9",
                        background:
                          "#ffffff",
                        padding:
                          18,
                        textAlign:
                          "right",
                        cursor:
                          "pointer",
                        display:
                          "grid",
                        gridTemplateColumns:
                          "auto minmax(0,1fr) auto",
                        gap: 14,
                        alignItems:
                          "center",
                      }}
                      onMouseEnter={(
                        e
                      ) => {
                        e.currentTarget.style.background =
                          "#f8fafc";
                      }}
                      onMouseLeave={(
                        e
                      ) => {
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
                            "#f0fdf4",
                          border:
                            "1px solid #bbf7d0",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          fontSize: 20,
                        }}
                      >
                        {String(
                          getProvider(
                            row
                          )
                        )
                          .toLowerCase()
                          .includes(
                            "runway"
                          )
                          ? "🎬"
                          : "🤖"}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            alignItems:
                              "center",
                            flexWrap:
                              "wrap",
                            marginBottom:
                              6,
                          }}
                        >
                          <span
                            style={{
                              background:
                                "#dcfce7",
                              color:
                                "#166534",
                              border:
                                "1px solid #bbf7d0",
                              borderRadius:
                                999,
                              padding:
                                "4px 9px",
                              fontSize:
                                12,
                              fontWeight:
                                900,
                            }}
                          >
                            {
                              getProvider(
                                row
                              )
                            }
                          </span>

                          <span
                            style={{
                              background:
                                statusStyle.background,
                              color:
                                statusStyle.color,
                              border:
                                `1px solid ${statusStyle.border}`,
                              borderRadius:
                                999,
                              padding:
                                "4px 9px",
                              fontSize:
                                12,
                              fontWeight:
                                900,
                            }}
                          >
                            {getStatusLabel(
                              getStatus(
                                row
                              )
                            )}
                          </span>
                        </div>

                        <div
                          style={{
                            color:
                              "#172033",
                            fontWeight:
                              900,
                            marginBottom:
                              5,
                          }}
                        >
                          {
                            getOperation(
                              row
                            )
                          }
                        </div>

                        <div
                          style={{
                            color:
                              "#64748b",
                            fontSize:
                              13,
                            display:
                              "flex",
                            gap: 12,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <span>
                            🧠{" "}
                            {getModel(
                              row
                            )}
                          </span>

                          <span>
                            👤{" "}
                            {getUserName(
                              row
                            )}
                          </span>

                          <span>
                            🏪{" "}
                            {getShopName(
                              row
                            )}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          textAlign:
                            "left",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        <div
                          style={{
                            color:
                              "#166534",
                            fontWeight:
                              900,
                            marginBottom:
                              5,
                          }}
                        >
                          $
                          {getCost(
                            row
                          ).toFixed(
                            4
                          )}
                        </div>

                        <div
                          style={{
                            color:
                              "#64748b",
                            fontSize:
                              12,
                          }}
                        >
                          {formatDate(
                            row.created_at
                          )}
                        </div>
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>

      {/* Details modal */}
      {selectedUsage && (
        <div
          onClick={() =>
            setSelectedUsage(
              null
            )
          }
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.55)",
            zIndex: 1000,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width:
                "100%",
              maxWidth: 780,
              maxHeight:
                "90vh",
              overflowY:
                "auto",
              background:
                "#ffffff",
              borderRadius:
                24,
              padding: 24,
              boxShadow:
                "0 25px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: 15,
                marginBottom:
                  20,
              }}
            >
              <div>
                <div
                  style={{
                    color:
                      "#166534",
                    fontSize:
                      13,
                    fontWeight:
                      900,
                    marginBottom:
                      7,
                  }}
                >
                  تفاصيل استهلاك الذكاء الاصطناعي
                </div>

                <h2
                  style={{
                    margin: 0,
                    color:
                      "#14532d",
                    fontSize:
                      24,
                  }}
                >
                  {
                    getOperation(
                      selectedUsage
                    )
                  }
                </h2>
              </div>

              <button
                onClick={() =>
                  setSelectedUsage(
                    null
                  )
                }
                style={{
                  width: 38,
                  height: 38,
                  borderRadius:
                    12,
                  border:
                    "1px solid #e5e7eb",
                  background:
                    "#f8fafc",
                  cursor:
                    "pointer",
                  fontSize:
                    18,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 12,
                marginBottom:
                  18,
              }}
            >
              {[
                [
                  "المزود",
                  getProvider(
                    selectedUsage
                  ),
                ],
                [
                  "الموديل",
                  getModel(
                    selectedUsage
                  ),
                ],
                [
                  "الحالة",
                  getStatusLabel(
                    getStatus(
                      selectedUsage
                    )
                  ),
                ],
                [
                  "التكلفة",
                  `$${getCost(
                    selectedUsage
                  ).toFixed(4)}`,
                ],
                [
                  "Tokens",
                  getTokens(
                    selectedUsage
                  ).toLocaleString(
                    "en-US"
                  ),
                ],
                [
                  "Credits",
                  getCredits(
                    selectedUsage
                  ),
                ],
                [
                  "المستخدم",
                  getUserName(
                    selectedUsage
                  ),
                ],
                [
                  "المتجر",
                  getShopName(
                    selectedUsage
                  ),
                ],
                [
                  "التاريخ",
                  formatDate(
                    selectedUsage.created_at
                  ),
                ],
              ].map(
                ([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background:
                        "#f8fafc",
                      border:
                        "1px solid #e5e7eb",
                      borderRadius:
                        14,
                      padding:
                        14,
                    }}
                  >
                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          12,
                        marginBottom:
                          6,
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        color:
                          "#172033",
                        fontWeight:
                          900,
                        wordBreak:
                          "break-word",
                        fontSize:
                          14,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                )
              )}
            </div>

            <div
              style={{
                background:
                  "#f0fdf4",
                border:
                  "1px solid #bbf7d0",
                borderRadius:
                  16,
                padding:
                  16,
                marginBottom:
                  16,
              }}
            >
              <div
                style={{
                  color:
                    "#166534",
                  fontWeight:
                    900,
                  marginBottom:
                    8,
                }}
              >
                ملاحظة
              </div>

              <div
                style={{
                  color:
                    "#374151",
                  lineHeight:
                    1.8,
                }}
              >
                هذه الصفحة للمتابعة والمراقبة
                فقط، ولا تقوم بتشغيل أي طلب
                جديد إلى OpenAI أو Runway.
              </div>
            </div>

            <div>
              <div
                style={{
                  color:
                    "#14532d",
                  fontWeight:
                    900,
                  marginBottom:
                    8,
                }}
              >
                البيانات الأصلية للعملية
              </div>

              <pre
                style={{
                  margin: 0,
                  background:
                    "#0f172a",
                  color:
                    "#e2e8f0",
                  borderRadius:
                    16,
                  padding:
                    16,
                  overflowX:
                    "auto",
                  fontSize:
                    12,
                  direction:
                    "ltr",
                  textAlign:
                    "left",
                  whiteSpace:
                    "pre-wrap",
                  wordBreak:
                    "break-word",
                }}
              >
                {JSON.stringify(
                  selectedUsage,
                  null,
                  2
                )}
              </pre>
            </div>

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "flex-end",
                marginTop:
                  20,
              }}
            >
              <button
                onClick={() =>
                  setSelectedUsage(
                    null
                  )
                }
                style={{
                  border: 0,
                  background:
                    "#166534",
                  color:
                    "#ffffff",
                  padding:
                    "12px 20px",
                  borderRadius:
                    12,
                  fontWeight:
                    900,
                  cursor:
                    "pointer",
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
