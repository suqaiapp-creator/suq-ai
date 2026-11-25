"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function MarketingPage() {
  const params = useParams();
  const productId = params.id;

  const [product, setProduct] = useState(null);
  const [marketing, setMarketing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: productData, error: productError } =
      await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

    if (productError) {
      console.error(productError);
      setMessage("❌ تعذر تحميل المنتج");
      setLoading(false);
      return;
    }

    setProduct(productData);

    const { data: marketingData, error: marketingError } =
      await supabase
        .from("marketing_contents")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!marketingError && marketingData) {
      const productUpdated = new Date(
        productData.updated_at || productData.created_at
      );

      const marketingCreated = new Date(
        marketingData.created_at
      );

      // لا نعرض التسويق القديم إذا تغير المنتج
      if (marketingCreated >= productUpdated) {
        setMarketing(marketingData);
      } else {
        setMarketing(null);
      }
    } else {
      setMarketing(null);
    }

    setLoading(false);
  }

  async function generateMarketing() {
    if (!product) return;

    setGenerating(true);
    setMessage("");

    try {
      const response = await fetch("/api/generate-marketing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "تعذر إنشاء المحتوى"
        );
      }

      const { data, error } = await supabase
        .from("marketing_contents")
        .insert({
          product_id: product.id,
          marketing_description:
            result.marketing_description || "",
          instagram: result.instagram || "",
          whatsapp: result.whatsapp || "",
          tiktok_snapchat:
            result.tiktok_snapchat || "",
          seo_title: result.seo_title || "",
          seo_description:
            result.seo_description || "",
          seo_keywords:
            result.seo_keywords || "",
          call_to_action:
            result.call_to_action || "",
          status: "completed",
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        throw new Error(
          "تم إنشاء المحتوى ولكن تعذر حفظه"
        );
      }

      setMarketing(data);

      await supabase
        .from("products")
        .update({
          ai_status: "completed",
        })
        .eq("id", product.id);

      setMessage(
        "✅ تم إنشاء وحفظ المحتوى التسويقي بنجاح."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        `❌ ${error.message || "حدث خطأ أثناء إنشاء المحتوى"}`
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 20,
          fontFamily: "Arial",
        }}
      >
        <h2>جاري تحميل المنتج...</h2>
      </main>
    );
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 20,
          fontFamily: "Arial",
        }}
      >
        <h2>❌ المنتج غير موجود</h2>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 900,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      <h1>🚀 تسويق المنتج بالذكاء الاصطناعي</h1>

      {/* بيانات المنتج */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              style={{
                width: 180,
                height: 180,
                objectFit: "contain",
                borderRadius: 12,
                border: "1px solid #eee",
              }}
            />
          ) : (
            <div
              style={{
                width: 180,
                height: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 60,
                background: "#f5f5f5",
                borderRadius: 12,
              }}
            >
              📦
            </div>
          )}

          <div>
            <h2>{product.name}</h2>

            {product.brand && (
              <p>
                <strong>العلامة التجارية:</strong>{" "}
                {product.brand}
              </p>
            )}

            {product.category && (
              <p>
                <strong>التصنيف:</strong>{" "}
                {product.category}
              </p>
            )}

            {product.price && (
              <p>
                <strong>💰 السعر:</strong>{" "}
                {product.price} {product.currency || "AED"}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* زر الإنشاء */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <h2>أنشئ تسويق المنتج بالذكاء الاصطناعي</h2>

        <p style={{ color: "#666" }}>
          إنشاء المحتوى التسويقي المناسب لمنتجك
          لجميع المنصات من زر واحد.
        </p>

        <button
          onClick={generateMarketing}
          disabled={generating}
          style={{
            padding: "15px 30px",
            borderRadius: 10,
            border: "none",
            background: generating
              ? "#999"
              : "#16a34a",
            color: "#fff",
            fontSize: 18,
            cursor: generating
              ? "not-allowed"
              : "pointer",
          }}
        >
          {generating
            ? "⏳ جاري إنشاء المحتوى..."
            : "🚀 إنشاء الكل"}
        </button>
      </section>

      {/* الرسالة */}
      {message && (
        <div
          style={{
            padding: 15,
            borderRadius: 10,
            background: "#f5f5f5",
            marginBottom: 20,
            fontWeight: "bold",
          }}
        >
          {message}
        </div>
      )}

      {/* المحتوى */}
      {marketing && (
        <section>
          <h2>📣 المحتوى التسويقي</h2>

          <ContentBox
            title="📝 الوصف التسويقي"
            content={marketing.marketing_description}
          />

          <ContentBox
            title="📸 Instagram"
            content={marketing.instagram}
          />

          <ContentBox
            title="💬 WhatsApp"
            content={marketing.whatsapp}
          />

          <ContentBox
            title="🎬 TikTok / Snapchat"
            content={marketing.tiktok_snapchat}
          />

          <ContentBox
            title="🔎 SEO Title"
            content={marketing.seo_title}
          />

          <ContentBox
            title="📄 SEO Description"
            content={marketing.seo_description}
          />

          <ContentBox
            title="🔑 SEO Keywords"
            content={marketing.seo_keywords}
          />

          <ContentBox
            title="📢 Call To Action"
            content={marketing.call_to_action}
          />
        </section>
      )}

      {!marketing && !generating && (
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            background: "#f8f8f8",
            textAlign: "center",
          }}
        >
          ℹ️ لا يوجد محتوى تسويقي حديث لهذا المنتج.
          <br />
          اضغط «إنشاء الكل» لإنشاء محتوى جديد بناءً
          على البيانات الحالية.
        </div>
      )}
    </main>
  );
}

function ContentBox({ title, content }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 20,
        marginBottom: 15,
      }}
    >
      <h3>{title}</h3>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.8,
          color: "#333",
        }}
      >
        {content || "لا يوجد محتوى"}
      </div>
    </div>
  );
}
