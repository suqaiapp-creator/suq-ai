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
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    console.log("PRODUCTS:", data);
    console.log("PRODUCT ERROR:", error);

    if (error) {
      console.error(error);
      setProducts([]);
      setLoading(false);
      return;
    }

    setProducts(data || []);
    setLoading(false);
  }

  async function deleteProduct(productId) {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا المنتج؟ سيتم حذف المحتوى التسويقي المرتبط به أيضًا."
    );

    if (!confirmed) return;

    setDeleting(productId);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      console.error("DELETE ERROR:", error);
      alert("حدث خطأ أثناء حذف المنتج.");
      setDeleting(null);
      return;
    }

    setProducts((current) =>
      current.filter((product) => product.id !== productId)
    );

    setDeleting(null);
  }

  function getVerificationText(status) {
    if (status === "verified") return "✅ موثّق";
    if (status === "review") return "🟡 يحتاج مراجعة";
    return "⚪ غير موثّق";
  }

  function getAIStatusText(status) {
    if (status === "completed") return "✅ جاهز";
    if (status === "processing") return "🔄 قيد المعالجة";
    if (status === "error") return "❌ خطأ";
    return "⏳ بانتظار الذكاء الاصطناعي";
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f7fb",
        padding: "25px 18px 50px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "950px",
          margin: "0 auto",
        }}
      >
        <a
          href="/"
          style={{
            display: "inline-block",
            marginBottom: "18px",
            color: "#6246e5",
            textDecoration: "none",
            fontWeight: "700",
          }}
        >
          ← الرئيسية
        </a>

        <div
          style={{
            background: "#fff",
            borderRadius: "22px",
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
              flexWrap: "wrap",
              marginBottom: "25px",
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
                  margin: "8px 0 0",
                  color: "#666",
                }}
              >
                مكتبة منتجاتك جاهزة للتسويق بالذكاء الاصطناعي.
              </p>
            </div>

            <a
              href="/add-product"
              style={{
                display: "inline-block",
                padding: "13px 18px",
                borderRadius: "12px",
                background: "#6246e5",
                color: "#fff",
                textDecoration: "none",
                fontWeight: "800",
              }}
            >
              ➕ إضافة منتج
            </a>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#666",
              }}
            >
              جاري تحميل المنتجات...
            </div>
          ) : products.length === 0 ? (
            <div
              style={{
                padding: "45px 20px",
                textAlign: "center",
                background: "#fafafa",
                borderRadius: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "45px",
                  marginBottom: "12px",
                }}
              >
                📦
              </div>

              <h2>لا توجد منتجات حتى الآن</h2>

              <p
                style={{
                  color: "#666",
                }}
              >
                أضف أول منتج وابدأ بتسويقه بالذكاء الاصطناعي.
              </p>

              <a
                href="/add-product"
                style={{
                  display: "inline-block",
                  marginTop: "10px",
                  padding: "13px 20px",
                  borderRadius: "12px",
                  background: "#6246e5",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: "700",
                }}
              >
                ➕ إضافة أول منتج
              </a>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e8e8ee",
                    borderRadius: "18px",
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "18px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: "90px",
                        height: "90px",
                        flexShrink: 0,
                        borderRadius: "15px",
                        background: "#f0eff8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        fontSize: "38px",
                      }}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        "📦"
                      )}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <h2
                        style={{
                          margin: "0 0 7px",
                          fontSize: "21px",
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
                        product.price !== undefined &&
                        product.price !== "" && (
                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: "800",
                              marginTop: "8px",
                            }}
                          >
                            💰 {product.price} {product.currency || "AED"}
                          </div>
                        )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginTop: "17px",
                    }}
                  >
                    <span
                      style={{
                        padding: "7px 10px",
                        borderRadius: "20px",
                        background: "#f3f3f6",
                        fontSize: "13px",
                      }}
                    >
                      {getVerificationText(product.verification_status)}
                    </span>

                    <span
                      style={{
                        padding: "7px 10px",
                        borderRadius: "20px",
                        background: "#f3f3f6",
                        fontSize: "13px",
                      }}
                    >
                      🤖 {getAIStatusText(product.ai_status)}
                    </span>

                    {product.barcode && (
                      <span
                        style={{
                          padding: "7px 10px",
                          borderRadius: "20px",
                          background: "#f3f3f6",
                          fontSize: "13px",
                        }}
                      >
                        🔢 {product.barcode}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: "10px",
                      marginTop: "18px",
                    }}
                  >
                    <a
                      href={`/marketing/${product.id}`}
                      style={{
                        boxSizing: "border-box",
                        width: "100%",
                        textAlign: "center",
                        textDecoration: "none",
                        background: "#6246e5",
                        color: "#fff",
                        padding: "13px 10px",
                        borderRadius: "12px",
                        fontSize: "15px",
                        fontWeight: "800",
                      }}
                    >
                      🚀 سوّق المنتج
                    </a>

                    <a
                      href={`/edit-product/${product.id}`}
                      style={{
                        boxSizing: "border-box",
                        width: "100%",
                        textAlign: "center",
                        textDecoration: "none",
                        background: "#f0eff8",
                        color: "#333",
                        padding: "13px 10px",
                        borderRadius: "12px",
                        fontSize: "15px",
                        fontWeight: "800",
                      }}
                    >
                      ✏️ تعديل
                    </a>

                    <button
                      onClick={() => deleteProduct(product.id)}
                      disabled={deleting === product.id}
                      style={{
                        width: "100%",
                        border: "none",
                        background:
                          deleting === product.id ? "#ddd" : "#fff0f0",
                        color: "#b42318",
                        padding: "13px 10px",
                        borderRadius: "12px",
                        fontSize: "15px",
                        fontWeight: "800",
                        cursor:
                          deleting === product.id
                            ? "default"
                            : "pointer",
                      }}
                    >
                      {deleting === product.id
                        ? "جاري الحذف..."
                        : "🗑️ حذف"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
