"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (!error) {
      setProducts(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const totalProducts = products.length;

  const completedProducts = products.filter(
    (product) =>
      product.ai_status === "completed"
  ).length;

  const pendingProducts = products.filter(
    (product) =>
      product.ai_status !== "completed"
  ).length;

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fc",
        fontFamily: "Arial, sans-serif",
        color: "#171923",
      }}
    >
      {/* Header */}

      <header
        style={{
          background: "#fff",
          borderBottom:
            "1px solid #e8e8ef",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "25px",
                fontWeight: "800",
              }}
            >
              سوق AI
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#777",
                marginTop: "4px",
              }}
            >
              لوحة التحكم
            </div>
          </div>

          <a
            href="/add-product"
            style={{
              background: "#6246e5",
              color: "#fff",
              textDecoration: "none",
              padding:
                "11px 17px",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "14px",
            }}
          >
            ➕ إضافة منتج
          </a>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "35px 20px 60px",
        }}
      >
        {/* Welcome */}

        <div
          style={{
            marginBottom: "25px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize:
                "clamp(28px, 5vw, 42px)",
            }}
          >
            أهلاً بك في سوق AI 👋
          </h1>

          <p
            style={{
              color: "#707070",
              fontSize: "16px",
              marginTop: "10px",
            }}
          >
            من هنا تدير منتجاتك
            وتسويقك وتصاميمك.
          </p>
        </div>

        {/* Statistics */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "30px",
          }}
        >
          <StatCard
            icon="📦"
            title="إجمالي المنتجات"
            value={totalProducts}
          />

          <StatCard
            icon="✅"
            title="منتجات مكتملة"
            value={completedProducts}
          />

          <StatCard
            icon="⏳"
            title="تحتاج معالجة"
            value={pendingProducts}
          />
        </div>

        {/* Main Actions */}

        <h2
          style={{
            fontSize: "24px",
            marginBottom: "18px",
          }}
        >
          ماذا تريد أن تفعل؟
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <DashboardAction
            href="/add-product"
            icon="➕"
            title="إضافة منتج"
            text="أضف منتجًا جديدًا إلى مكتبتك."
          />

          <DashboardAction
            href="/products"
            icon="📦"
            title="إدارة المنتجات"
            text="عرض وتعديل جميع منتجاتك."
          />

          <DashboardAction
            href="/designs"
            icon="🎨"
            title="تصاميم الإعلانات"
            text="إنشاء وإدارة تصاميم المنتجات."
          />

          <DashboardAction
            href="/products"
            icon="🚀"
            title="سوّق منتج"
            text="اختر منتجًا وابدأ التسويق."
          />
        </div>

        {/* Recent Products */}

        <div
          style={{
            background: "#fff",
            border:
              "1px solid #e8e8ef",
            borderRadius: "22px",
            padding: "25px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
              }}
            >
              آخر المنتجات
            </h2>

            <a
              href="/products"
              style={{
                color: "#6246e5",
                textDecoration:
                  "none",
                fontWeight: "700",
                fontSize: "14px",
              }}
            >
              عرض الكل
            </a>
          </div>

          {loading ? (
            <div
              style={{
                padding: "25px",
                textAlign: "center",
                color: "#777",
              }}
            >
              جاري تحميل المنتجات...
            </div>
          ) : products.length === 0 ? (
            <div
              style={{
                padding: "35px",
                textAlign: "center",
                color: "#777",
              }}
            >
              <div
                style={{
                  fontSize: "45px",
                  marginBottom: "10px",
                }}
              >
                📦
              </div>

              <div
                style={{
                  fontWeight: "700",
                  marginBottom: "8px",
                }}
              >
                لا توجد منتجات بعد
              </div>

              <div
                style={{
                  fontSize: "14px",
                  marginBottom: "18px",
                }}
              >
                أضف أول منتج وابدأ
                التسويق.
              </div>

              <a
                href="/add-product"
                style={{
                  display:
                    "inline-block",
                  background:
                    "#6246e5",
                  color: "#fff",
                  textDecoration:
                    "none",
                  padding:
                    "12px 20px",
                  borderRadius:
                    "12px",
                  fontWeight:
                    "700",
                }}
              >
                ➕ إضافة منتج
              </a>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              {products
                .slice(0, 5)
                .map((product) => (
                  <div
                    key={
                      product.id
                    }
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: "15px",
                      border:
                        "1px solid #eee",
                      borderRadius:
                        "16px",
                      padding:
                        "12px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "12px",
                        minWidth: 0,
                      }}
                    >
                      {product.image_url ? (
                        <img
                          src={
                            product.image_url
                          }
                          alt={
                            product.name
                          }
                          style={{
                            width:
                              "58px",
                            height:
                              "58px",
                            objectFit:
                              "cover",
                            borderRadius:
                              "12px",
                            border:
                              "1px solid #eee",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width:
                              "58px",
                            height:
                              "58px",
                            borderRadius:
                              "12px",
                            background:
                              "#f2f2f5",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize:
                              "25px",
                          }}
                        >
                          📦
                        </div>
                      )}

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontWeight:
                              "700",
                            overflow:
                              "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {
                            product.name
                          }
                        </div>

                        <div
                          style={{
                            color:
                              "#777",
                            fontSize:
                              "13px",
                            marginTop:
                              "4px",
                          }}
                        >
                          {
                            product.brand ||
                            "بدون علامة"
                          }
                        </div>
                      </div>
                    </div>

                    <a
                      href={`/marketing/${product.id}`}
                      style={{
                        flexShrink: 0,
                        background:
                          "#f0edff",
                        color:
                          "#6246e5",
                        textDecoration:
                          "none",
                        padding:
                          "9px 13px",
                        borderRadius:
                          "10px",
                        fontWeight:
                          "700",
                        fontSize:
                          "13px",
                      }}
                    >
                      🚀 سوّق
                    </a>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  title,
  value,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border:
          "1px solid #e8e8ef",
        borderRadius: "20px",
        padding: "22px",
      }}
    >
      <div
        style={{
          fontSize: "30px",
          marginBottom: "12px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#777",
          fontSize: "14px",
          marginBottom: "7px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: "800",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DashboardAction({
  href,
  icon,
  title,
  text,
}) {
  return (
    <a
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          background: "#fff",
          border:
            "1px solid #e8e8ef",
          borderRadius: "20px",
          padding: "22px",
          height: "100%",
          boxSizing:
            "border-box",
        }}
      >
        <div
          style={{
            fontSize: "32px",
            marginBottom: "12px",
          }}
        >
          {icon}
        </div>

        <h3
          style={{
            margin:
              "0 0 8px",
            fontSize: "18px",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: 0,
            color: "#707070",
            fontSize: "14px",
            lineHeight: "1.7",
          }}
        >
          {text}
        </p>
      </div>
    </a>
  );
}
