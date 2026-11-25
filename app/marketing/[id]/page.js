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
            maxWidth: "1000px",
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
            maxWidth: "1000px",
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
        padding: "25px 18px 60px",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
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

        {/* عنوان الصفحة */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e8ef",
            borderRadius: "22px",
            padding: "28px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              color: "#6246e5",
              fontWeight: "700",
            }}
          >
            🚀 سوق AI
          </div>

          <h1
            style={{
              fontSize: "34px",
              margin: "8px 0",
            }}
          >
            سوّق منتجك
          </h1>

          <p
            style={{
              color: "#666",
              margin: 0,
              lineHeight: "1.8",
            }}
          >
            أنشئ جميع مواد التسويق الخاصة بمنتجك من مكان واحد.
          </p>
        </div>

        {/* معلومات المنتج */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e8ef",
            borderRadius: "22px",
            padding: "25px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              fontSize: "25px",
            }}
          >
            📦 {product.name}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginTop: "20px",
            }}
          >
            {product.brand && (
              <InfoBox
                title="العلامة"
                value={product.brand}
              />
            )}

            {product.category && (
              <InfoBox
                title="الفئة"
                value={product.category}
              />
            )}

            {product.price !== null && (
              <InfoBox
                title="السعر"
                value={`${product.price} ${
                  product.currency || "AED"
                }`}
              />
            )}

            <InfoBox
              title="حالة التحقق"
              value={
                product.verification_status ||
                "غير متحقق"
              }
            />
          </div>
        </div>

        {/* زر إنشاء كل شيء */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #6246e5, #7c5cff)",
            color: "#fff",
            borderRadius: "22px",
            padding: "30px",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "42px" }}>🤖</div>

          <h2
            style={{
              margin: "10px 0",
              fontSize: "26px",
            }}
          >
            أنشئ تسويق المنتج بالذكاء الاصطناعي
          </h2>

          <p
            style={{
              margin: "0 auto 20px",
              maxWidth: "650px",
              lineHeight: "1.8",
              opacity: 0.9,
            }}
          >
            إنشاء المحتوى التسويقي المناسب لمنتجك لجميع
            المنصات من زر واحد.
          </p>

          <button
            style={{
              border: "none",
              background: "#fff",
              color: "#6246e5",
              padding: "14px 28px",
              borderRadius: "12px",
              fontSize: "17px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            🚀 إنشاء الكل
          </button>
        </div>

        {/* أدوات التسويق */}
        <h2
          style={{
            fontSize: "25px",
            margin: "30px 0 15px",
          }}
        >
          أدوات التسويق
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          <MarketingCard
            icon="✍️"
            title="وصف تسويقي"
            text="وصف احترافي وجذاب للمنتج."
          />

          <MarketingCard
            icon="📱"
            title="Instagram"
            text="منشور جاهز للنشر على إنستغرام."
          />

          <MarketingCard
            icon="💬"
            title="WhatsApp"
            text="رسالة تسويقية جاهزة للواتساب."
          />

          <MarketingCard
            icon="🎵"
            title="TikTok / Snapchat"
            text="نص قصير مناسب للفيديوهات القصيرة."
          />

          <MarketingCard
            icon="🔎"
            title="SEO"
            text="عنوان ووصف وكلمات مفتاحية للبحث."
          />

          <MarketingCard
            icon="🎯"
            title="دعوة لاتخاذ إجراء"
            text="CTA مناسب لتحويل المشاهد إلى عميل."
          />

          <MarketingCard
            icon="🖼️"
            title="صورة إعلان"
            text="تصميم إعلاني احترافي باستخدام صورة المنتج."
          />

          <MarketingCard
            icon="🎬"
            title="فيديو إعلان"
            text="فيديو قصير مناسب لـ Reels وTikTok وSnapchat."
          />
        </div>
      </div>
    </main>
  );
}

function InfoBox({ title, value }) {
  return (
    <div
      style={{
        background: "#f7f8fc",
        borderRadius: "14px",
        padding: "15px",
      }}
    >
      <div
        style={{
          color: "#777",
          fontSize: "13px",
          marginBottom: "5px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontWeight: "700",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MarketingCard({ icon, title, text }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8e8ef",
        borderRadius: "20px",
        padding: "22px",
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
          margin: "0 0 8px",
          fontSize: "19px",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          color: "#666",
          lineHeight: "1.7",
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}
