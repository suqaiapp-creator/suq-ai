"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminAIUsagePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  });

  useEffect(() => {
    loadAIUsage();
  }, []);

  async function loadAIUsage() {
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
        .from("ai_usage")
        .select("*")
        .order("created_at", {
          ascending: false,
        })
        .limit(500);

      if (error) {
        console.error(
          "AI usage loading error:",
          error
        );

        setRecords([]);
        return;
      }

      const rows = data || [];

      /*
       * الحصول على المستخدمين
       */
      const userIds = [
        ...new Set(
          rows
            .map((item) => item.user_id)
            .filter(Boolean)
        ),
      ];

      let usersMap = {};

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("profiles")
          .select(
            "id, full_name, role, account_status"
          )
          .in("id", userIds);

        (users || []).forEach((user) => {
          usersMap[user.id] = user;
        });
      }

      /*
       * الحصول على المحلات
       */
      const shopIds = [
        ...new Set(
          rows
            .map((item) => item.shop_id)
            .filter(Boolean)
        ),
      ];

      let shopsMap = {};

      if (shopIds.length > 0) {
        const { data: shops } = await supabase
          .from("shops")
          .select(
            "id, name, status, emirate"
          )
          .in("id", shopIds);

        (shops || []).forEach((shop) => {
          shopsMap[shop.id] = shop;
        });
      }

      /*
       * الحصول على المنتجات
       */
      const productIds = [
        ...new Set(
          rows
            .map((item) => item.product_id)
            .filter(Boolean)
        ),
      ];

      let productsMap = {};

      if (productIds.length > 0) {
        const { data: products } =
          await supabase
            .from("products")
            .select(
              "id, name, brand, verification_status, safety_status"
            )
            .in("id", productIds);

        (products || []).forEach((product) => {
          productsMap[product.id] =
            product;
        });
      }

      /*
       * دمج البيانات
       */
      const enrichedRows = rows.map((record) => ({
        ...record,
        user: record.user_id
          ? usersMap[record.user_id] || null
          : null,
        shop: record.shop_id
          ? shopsMap[record.shop_id] || null
          : null,
        product: record.product_id
          ? productsMap[record.product_id] || null
          : null,
      }));

      setRecords(enrichedRows);

      /*
       * الإحصائيات
       */
      const total = rows.length;

      const success = rows.filter(
        (item) =>
          !item.status ||
          item.status === "success"
      ).length;

      const failed = rows.filter(
        (item) =>
          item.status === "failed"
      ).length;

      const inputTokens = rows.reduce(
        (sum, item) =>
          sum +
          Number(
            item.input_tokens || 0
          ),
        0
      );

      const outputTokens = rows.reduce(
        (sum, item) =>
          sum +
          Number(
            item.output_tokens || 0
          ),
        0
      );

      const tokens = rows.reduce(
        (sum, item) =>
          sum +
          Number(
            item.total_tokens || 0
          ),
        0
      );

      const cost = rows.reduce(
        (sum, item) =>
          sum +
          Number(
            item.estimated_cost || 0
          ),
        0
      );

      setStats({
        total,
        success,
        failed,
        tokens,
        inputTokens,
        outputTokens,
        cost,
      });
    } catch (error) {
      console.error(
        "AI usage page error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  function getOperationLabel(operation) {
    const value = String(
      operation || ""
    ).toLowerCase();

    if (
      value.includes("analy") ||
      value.includes("product")
    ) {
      return "🧠 تحليل منتج";
    }

    if (
      value.includes("marketing") ||
      value.includes("market")
    ) {
      return "📢 إنشاء تسويق";
    }

    if (
      value.includes("image") ||
      value.includes("design")
    ) {
      return "🎨 إنشاء تصميم";
    }

    if (value.includes("video")) {
      return "🎬 إنشاء فيديو";
    }

    return operation || "عملية AI";
  }

  function getStatusLabel(status) {
    if (!status || status === "success") {
      return "نجحت";
    }

    if (status === "failed") {
      return "فشلت";
    }

    return status;
  }

  const filteredRecords =
    records.filter((record) => {
      const text = search
        .trim()
        .toLowerCase();

      const searchableText = [
        record.operation,
        record.model,
        record.status,
        record.user?.full_name,
        record.shop?.name,
        record.product?.name,
        record.product?.brand,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !text ||
        searchableText.includes(text);

      let matchesFilter = true;

      if (filter === "success") {
        matchesFilter =
          !record.status ||
          record.status === "success";
      }

      if (filter === "failed") {
        matchesFilter =
          record.status === "failed";
      }

      if (filter === "analysis") {
        const value = String(
          record.operation || ""
        ).toLowerCase();

        matchesFilter =
          value.includes("analy") ||
          value.includes("product");
      }

      if (filter === "marketing") {
        const value = String(
          record.operation || ""
        ).toLowerCase();

        matchesFilter =
          value.includes("marketing") ||
          value.includes("market");
      }

      if (filter === "design") {
        const value = String(
          record.operation || ""
        ).toLowerCase();

        matchesFilter =
          value.includes("image") ||
          value.includes("design");
      }

      return (
        matchesSearch &&
        matchesFilter
      );
    });

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 30,
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        جاري تحميل استخدام الذكاء
        الاصطناعي...
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
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
              }}
            >
              🤖 استخدام الذكاء الاصطناعي
            </h1>

            <p
              style={{
                marginTop: 8,
                color: "#666",
              }}
            >
              متابعة عمليات AI والتكلفة
              التقديرية والاستخدام
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={loadAIUsage}
              style={{
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
                padding:
                  "11px 16px",
                borderRadius: 12,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🔄 تحديث
            </button>

            <Link
              href="/admin"
              style={{
                textDecoration:
                  "none",
                background: "#111",
                color: "#fff",
                padding:
                  "11px 18px",
                borderRadius: 12,
                fontWeight: "bold",
              }}
            >
              لوحة التحكم
            </Link>
          </div>
        </div>

        {/* STATS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <StatCard
            title="إجمالي العمليات"
            value={stats.total}
            icon="🤖"
          />

          <StatCard
            title="ناجحة"
            value={stats.success}
            icon="✅"
          />

          <StatCard
            title="فاشلة"
            value={stats.failed}
            icon="❌"
          />

          <StatCard
            title="Input Tokens"
            value={stats.inputTokens.toLocaleString(
              "en-US"
            )}
            icon="📥"
          />

          <StatCard
            title="Output Tokens"
            value={stats.outputTokens.toLocaleString(
              "en-US"
            )}
            icon="📤"
          />

          <StatCard
            title="إجمالي Tokens"
            value={stats.tokens.toLocaleString(
              "en-US"
            )}
            icon="🔢"
          />

          <StatCard
            title="التكلفة التقديرية"
            value={`$${stats.cost.toFixed(
              4
            )}`}
            icon="💰"
          />
        </div>

        {/* SEARCH */}

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
            placeholder="ابحث بالمستخدم أو المحل أو المنتج أو العملية..."
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              padding:
                "13px 14px",
              border:
                "1px solid #ddd",
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
              ["success", "ناجحة"],
              ["failed", "فاشلة"],
              [
                "analysis",
                "تحليل المنتجات",
              ],
              [
                "marketing",
                "التسويق",
              ],
              [
                "design",
                "التصاميم",
              ],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setFilter(value)
                  }
                  style={{
                    border:
                      "1px solid #ddd",
                    borderRadius: 10,
                    padding:
                      "9px 14px",
                    cursor:
                      "pointer",
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
              )
            )}
          </div>
        </div>

        {/* TABLE */}

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {filteredRecords.length ===
          0 ? (
            <div
              style={{
                padding: 50,
                textAlign:
                  "center",
                color: "#666",
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  marginBottom: 10,
                }}
              >
                🤖
              </div>

              لا توجد عمليات AI
              مسجلة حالياً.
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  minWidth: 1450,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#f8f8f8",
                    }}
                  >
                    {[
                      "العملية",
                      "المستخدم",
                      "المحل",
                      "المنتج",
                      "الموديل",
                      "الحالة",
                      "الإدخال",
                      "الإخراج",
                      "الإجمالي",
                      "التكلفة",
                      "التاريخ",
                    ].map(
                      (title) => (
                        <th
                          key={title}
                          style={{
                            padding: 14,
                            textAlign:
                              "right",
                            whiteSpace:
                              "nowrap",
                            borderBottom:
                              "1px solid #eee",
                          }}
                        >
                          {title}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    (record) => {
                      const success =
                        !record.status ||
                        record.status ===
                          "success";

                      return (
                        <tr
                          key={
                            record.id
                          }
                          style={{
                            borderBottom:
                              "1px solid #eee",
                          }}
                        >
                          <td
                            style={{
                              padding: 14,
                              fontWeight:
                                "bold",
                            }}
                          >
                            {getOperationLabel(
                              record.operation
                            )}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {record.user
                              ?.full_name ||
                              "غير معروف"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {record.shop
                              ?.name ||
                              "بدون محل"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {record.product
                              ?.name ||
                              "بدون منتج"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {record.model ||
                              "-"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            <span
                              style={{
                                background:
                                  success
                                    ? "#dcfce7"
                                    : "#fee2e2",
                                color:
                                  success
                                    ? "#166534"
                                    : "#991b1b",
                                padding:
                                  "6px 10px",
                                borderRadius:
                                  20,
                                fontSize: 13,
                                fontWeight:
                                  "bold",
                              }}
                            >
                              {getStatusLabel(
                                record.status
                              )}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {Number(
                              record.input_tokens ||
                                0
                            ).toLocaleString(
                              "en-US"
                            )}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {Number(
                              record.output_tokens ||
                                0
                            ).toLocaleString(
                              "en-US"
                            )}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {Number(
                              record.total_tokens ||
                                0
                            ).toLocaleString(
                              "en-US"
                            )}
                          </td>

                          <td
                            style={{
                              padding: 14,
                              fontWeight:
                                "bold",
                            }}
                          >
                            $
                            {Number(
                              record.estimated_cost ||
                                0
                            ).toFixed(
                              4
                            )}
                          </td>

                          <td
                            style={{
                              padding: 14,
                              whiteSpace:
                                "nowrap",
                              color:
                                "#666",
                            }}
                          >
                            {record.created_at
                              ? new Date(
                                  record.created_at
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

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 18,
        boxShadow:
          "0 4px 18px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          color: "#777",
          fontSize: 14,
        }}
      >
        {icon} {title}
      </div>

      <strong
        style={{
          display: "block",
          fontSize: 27,
          marginTop: 7,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
