"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOAD PRODUCTS ERROR:", error);
      setMessage("❌ تعذر تحميل المنتجات.");
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  }

  async function deleteProduct(id) {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا المنتج؟"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("DELETE PRODUCT ERROR:", error);
      setMessage("❌ تعذر حذف المنتج.");
      return;
    }

    setProducts((current) =>
      current.filter((product) => product.id !== id)
    );

    setMessage("✅ تم حذف المنتج.");
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f7fb",
          padding: "40px 18px",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        ⏳ جاري تحميل المنتجات...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f7fb",
        padding: "25px 18px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <a
          href="/dashboard"
          style={{
            display: "inline-block",
            marginBottom: "18px",
            color: "#6246e5",
            textDecoration: "none",
            fontWeight: "700",
          }}
        >
          ← لوحة التحكم
        </a>

        <div
          style={{
            background: "#fff",
            borderRadius: "24px",
            padding: "25px",
            boxShadow: "0 5px 20px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
              marginBottom: "25px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "30px",
                }}
              >
                📦 إدارة المنتجات
              </h1>

              <p
                style={{
                  color: "#666",
                  marginBottom: 0,
                }}
              >
                أدر منتجاتك وراجع معلومات الذكاء الاصطناعي.
              </p>
            </div>

            <a
              href="/add-product"
              style={{
                background: "#6246e5",
                color: "#fff",
                padding: "13px 18px",
                borderRadius: "12px",
                textDecoration: "none",
                fontWeight: "800",
              }}
            >
              ➕ إضافة منتج
            </a>
          </div>

          {message && (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px",
                borderRadius: "12px",
                background: message.startsWith("❌")
                  ? "#fff0f0"
                  : "#eefbf3",
                color: message.startsWith("❌")
                  ? "#b42318"
                  : "#16794c",
                fontWeight: "700",
              }}
            >
              {message}
            </div>
          )}

          {products.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "50px 20px",
                color: "#777",
              }}
            >
              <div
                style={{
                  fontSize: "50px",
                  marginBottom: "12px",
                }}
              >
                📦
              </div>

              <h2 style={{ color: "#333" }}>
                لا توجد منتجات بعد
              </h2>

              <p>
                أضف أول منتج وخلّ ذكاء المنتج يجهز معلوماته.
              </p>

              <a
                href="/add-product"
                style={{
                  display: "inline-block",
                  marginTop: "10px",
                  background: "#6246e5",
                  color: "#fff",
                  padding: "14px 20px",
                  borderRadius: "12px",
                  textDecoration: "none",
                  fontWeight: "800",
                }}
              >
                🧠 إضافة أول منتج
              </a>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              {products.map((product) => {
                const verified =
                  product.verification_status ===
                  "verified";

                const aiCompleted =
                  product.ai_status === "completed";

                return (
                  <div
                    key={product.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: "20px",
                      padding: "18px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "18px",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          style={{
                            width: "150px",
                            height: "150px",
                            objectFit: "contain",
                            borderRadius: "16px",
                            background: "#f8f8f8",
                            border:
                              "1px solid #eee",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "150px",
                            height: "150px",
                            borderRadius: "16px",
                            background: "#f5f5f7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "45px",
                          }}
                        >
                          📦
                        </div>
                      )}

                      <div
                        style={{
                          flex: 1,
                          minWidth: "220px",
                        }}
                      >
                        <h2
                          style={{
                            marginTop: 0,
                            marginBottom: "8px",
                          }}
                        >
                          {product.name}
                        </h2>

                        {product.brand && (
                          <div
                            style={{
                              color: "#666",
                              marginBottom: "5px",
                            }}
                          >
                            🏷️ {product.brand}
                          </div>
                        )}

                        {product.category && (
                          <div
                            style={{
                              color: "#666",
                              marginBottom: "5px",
                            }}
                          >
                            📂 {product.category}
                          </div>
                        )}

                        {product.price !== null &&
                          product.price !== undefined && (
                            <div
                              style={{
                                fontWeight: "800",
                                marginTop: "8px",
                              }}
                            >
                              💰 {product.price} AED
                            </div>
                          )}

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginTop: "14px",
                          }}
                        >
                          <span
                            style={{
                              padding:
                                "7px 10px",
                              borderRadius:
                                "10px",
                              background:
                                aiCompleted
                                  ? "#eefbf3"
                                  : "#fff5d9",
                              color:
                                aiCompleted
                                  ? "#16794c"
                                  : "#806000",
                              fontSize:
                                "13px",
                              fontWeight:
                                "800",
                            }}
                          >
                            {aiCompleted
                              ? "🧠 تم التحليل"
                              : "🧠 يحتاج تحليل"}
                          </span>

                          <span
                            style={{
                              padding:
                                "7px 10px",
                              borderRadius:
                                "10px",
                              background:
                                verified
                                  ? "#eefbf3"
                                  : "#fff5d9",
                              color:
                                verified
                                  ? "#16794c"
                                  : "#806000",
                              fontSize:
                                "13px",
                              fontWeight:
                                "800",
                            }}
                          >
                            {verified
                              ? "✅ معتمد"
                              : "⚠️ يحتاج مراجعة"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "10px",
                        marginTop: "18px",
                      }}
                    >
                      <a
                        href={`/product-intelligence/${product.id}`}
                        style={{
                          background: "#6246e5",
                          color: "#fff",
                          padding: "13px",
                          borderRadius: "12px",
                          textAlign: "center",
                          textDecoration: "none",
                          fontWeight: "800",
                        }}
                      >
                        🧠 ذكاء المنتج
                      </a>

                      <a
                        href={`/marketing/${product.id}`}
                        style={{
                          background: "#16794c",
                          color: "#fff",
                          padding: "13px",
                          borderRadius: "12px",
                          textAlign: "center",
                          textDecoration: "none",
                          fontWeight: "800",
                        }}
                      >
                        🚀 التسويق
                      </a>

                      <a
                        href={`/edit-product/${product.id}`}
                        style={{
                          background: "#f3f3f6",
                          color: "#333",
                          padding: "13px",
                          borderRadius: "12px",
                          textAlign: "center",
                          textDecoration: "none",
                          fontWeight: "800",
                        }}
                      >
                        ✏️ تعديل
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          deleteProduct(product.id)
                        }
                        style={{
                          border: "none",
                          background: "#fff0f0",
                          color: "#b42318",
                          padding: "13px",
                          borderRadius: "12px",
                          fontWeight: "800",
                          cursor: "pointer",
                          fontSize: "15px",
                        }}
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
