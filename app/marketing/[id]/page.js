"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function MarketingPage({ params }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", params.id)
      .single();

    console.log("MARKETING PRODUCT:", data);
    console.log("MARKETING ERROR:", error);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setProduct(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f8fc",
          padding: "30px 18px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            background: "#fff",
            padding: "30px",
            borderRadius: "20px",
          }}
        >
          ⏳ جاري تحميل المنتج...
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f8fc",
          padding: "30px 18px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            background: "#fff",
            padding: "30px",
            borderRadius: "20px",
          }}
        >
          <h1>المنتج غير موجود</h1>

          <a href="/products">
            ← العودة إلى المنتجات
          </a>
        </div>
      </main>
    );
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
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <a
          href="/products"
          style={{
            textDecoration: "none",
            color: "#333",
            display: "inline-block",
            marginBottom: "20px",
          }}
        >
          ← العودة إلى المنتجات
        </a>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e8ef",
            borderRadius: "22px",
            padding: "25px",
          }}
        >
          <div style={{ fontSize: "15px", color: "#666" }}>
            🚀 سوق AI
          </div>

          <h1
            style={{
              fontSize: "32px",
              margin: "8px 0",
            }}
          >
            سوّق منتجك
          </h1>

          <p style={{ color: "#666" }}>
            جهّز محتوى تسويقي احترافي لهذا المنتج بالذكاء الاصطناعي.
          </p>

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #eee",
              margin: "25px 0",
            }}
          />

          <h2 style={{ fontSize: "24px" }}>
            {product.name}
          </h2>

          {product.brand && (
            <p>
              <strong>العلامة:</strong> {product.brand}
            </p>
          )}

          {product.category && (
            <p>
              <strong>الفئة:</strong> {product.category}
            </p>
          )}

          {product.price !== null && (
            <p>
              <strong>السعر:</strong>{" "}
              {product.price} {product.currency || "AED"}
            </p>
          )}

          {product.description && (
            <div style={{ marginTop: "20px" }}>
              <strong>الوصف:</strong>
              <p style={{ color: "#555", lineHeight: "1.8" }}>
                {product.description}
              </p>
            </div>
          )}

          <div
            style={{
              marginTop: "30px",
              padding: "20px",
              background: "#f7f8ff",
              borderRadius: "16px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              أدوات التسويق
            </h3>

            <p style={{ color: "#666" }}>
              هذه الصفحة ستكون مركز إنشاء جميع مواد التسويق للمنتج.
            </p>

            <button
              style={{
                width: "100%",
                border: "none",
                background: "#6246e5",
                color: "#fff",
                padding: "14px",
                borderRadius: "12px",
                fontSize: "17px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              🤖 إنشاء التسويق بالذكاء الاصطناعي
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
