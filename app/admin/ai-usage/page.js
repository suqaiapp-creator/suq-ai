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
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error(error);
        setRecords([]);
        return;
      }

      const rows = data || [];

      setRecords(rows);

      const total = rows.length;

      const success = rows.filter(
        (item) =>
          !item.status ||
          item.status === "success"
      ).length;

      const failed = rows.filter(
        (item) => item.status === "failed"
      ).length;

      const tokens = rows.reduce(
        (sum, item) =>
          sum + Number(item.total_tokens || 0),
        0
      );

      const cost = rows.reduce(
        (sum, item) =>
          sum + Number(item.estimated_cost || 0),
        0
      );

      setStats({
        total,
        success,
        failed,
        tokens,
        cost,
      });
    } catch (error) {
      console.error(error);
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

  const filteredRecords = records.filter(
    (record) => {
      const text = search.trim().toLowerCase();

      const matchesSearch =
        !text ||
        [
          record.operation,
          record.model,
          record.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(text);

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
        جاري تحميل استخدام الذكاء الاصطناعي...
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
              🤖 استخدام الذكاء الاصطناعي
            </h1>

            <p
              style={{
                marginTop: 8,
                color: "#666",
              }}
            >
              متابعة عمليات AI والتكلفة التقديرية
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
            title="إجمالي التوكنات"
            value={stats.tokens.toLocaleString("en-US")}
            icon="🔢"
          />

          <StatCard
            title="التكلفة التقديرية"
            value={`$${stats.cost.toFixed(4)}`}
            icon="💰"
          />
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
            placeholder="ابحث بالعملية أو الموديل أو الحالة..."
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
              ["success", "ناجحة"],
              ["failed", "فاشلة"],
              ["analysis", "تحليل المنتجات"],
              ["marketing", "التسويق"],
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
          {filteredRecords.length === 0 ? (
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
                🤖
              </div>

              لا توجد عمليات AI مسجلة حالياً.
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
                      "العملية",
                      "الموديل",
                      "الحالة",
                      "الإدخال",
                      "الإخراج",
                      "الإجمالي",
                      "التكلفة",
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
                  {filteredRecords.map(
                    (record) => {
                      const success =
                        !record.status ||
                        record.status ===
                          "success";

                      return (
                        <tr
                          key={record.id}
                          style={{
                            borderBottom:
                              "1px solid #eee",
                          }}
                        >
                          <td
                            style={{
                              padding: 14,
                              fontWeight: "bold",
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
                                background: success
                                  ? "#dcfce7"
                                  : "#fee2e2",
                                color: success
                                  ? "#166534"
                                  : "#991b1b",
                                padding:
                                  "6px 10px",
                                borderRadius: 20,
                                fontSize: 13,
                                fontWeight:
                                  "bold",
                              }}
                            >
                              {success
                                ? "نجحت"
                                : "فشلت"}
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
                              fontWeight: "bold",
                            }}
                          >
                            $
                            {Number(
                              record.estimated_cost ||
                                0
                            ).toFixed(4)}
                          </td>

                          <td
                            style={{
                              padding: 14,
                              whiteSpace:
                                "nowrap",
                              color: "#666",
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

function StatCard({ title, value, icon }) {
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
