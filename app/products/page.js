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

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*");

    console.log("PRODUCTS:", data);
    console.log("PRODUCT ERROR:", error);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setProducts(data || []);
    setLoading(false);
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fc",
        fontFamily: "Arial, sans-serif",
        color: "#171923",
        padding: "25px 18px",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <a
          href="/"
          style={{
            textDecoration: "none",
            color: "#333",
            display: "inline-block",
            marginBottom: "20px",
          }}
        >
          ← الرئيسية
        </a>

        <h1 style={{ fontSize: "34px", marginBottom: "8px" }}>
          منتجاتي 📦
        </h1>

        <p style={{ color: "#666", marginBottom: "30px" }}>
          جميع المنتجات التي أضفتها إلى سوق AI
        </p>

        {loading ? (
          <div
            style={{
              background: "#fff",
              padding: "30px",
              borderRadius: "18px",
              border: "1px solid #e8e8ef",
            }}
          >
            ⏳ جاري تحميل المنتجات...
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              background: "#fff",
              padding: "30px",
              borderRadius: "18px",
              border: "1px solid #e8e8ef",
            }}
          >
            لا توجد منتجات حتى الآن.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "18px",
            }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e8e8ef",
                  borderRadius: "20px",
                  padding: "20px",
                }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{
                      width: "100%",
                      height: "200px",
                      objectFit: "contain",
                      borderRadius: "14px",
                      background: "#f8f8f8",
                      marginBottom: "15px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: "160px",
                      background: "#f5f5f7",
                      borderRadius: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "55px",
                      marginBottom: "15px",
                    }}
                  >
                    📦
                  </div>
                )}

                <h2
                  style={{
                    fontSize: "20px",
                    margin: "0 0 8px",
                  }}
                >
                  {product.name}
                </h2>

                {product.brand && (
                  <div
                    style={{
                      color: "#666",
                      marginBottom: "8px",
                    }}
                  >
                    العلامة: {product.brand}
                  </div>
                )}

                {product.category && (
                  <div
                    style={{
                      color: "#666",
                      marginBottom: "8px",
                    }}
                  >
                    الفئة: {product.category}
                  </div>
                )}

                {product.price !== null && (
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      marginTop: "12px",
                    }}
                  >
                    {product.price} {product.currency || "AED"}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "15px",
                    padding: "8px 10px",
                    background: "#f3f4f6",
                    borderRadius: "10px",
                    fontSize: "13px",
                    color: "#555",
                  }}
                >
                  حالة التحقق:{" "}
                  {product.verification_status || "غير متحقق"}
                </div>

                <a
                  href={`/marketing/${product.id}`}
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "15px",
                    textAlign: "center",
                    textDecoration: "none",
                    background: "#6246e5",
                    color: "#fff",
                    padding: "13px",
                    borderRadius: "12px",
                    fontSize: "16px",
                    fontWeight: "700",
                  }}
                >
                  🚀 سوّق المنتج
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
