"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function MarketingPage({ params }) {
  const [product, setProduct] = useState(null);
  const [marketing, setMarketing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { id } = await params;

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (productError) {
        console.error("PRODUCT ERROR:", productError);
        setMessage("❌ لم يتم العثور على المنتج.");
        setLoading(false);
        return;
      }

      setProduct(productData);

      const { data: marketingData, error: marketingError } = await supabase
        .from("marketing_contents")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (marketingError) {
        console.error("MARKETING ERROR:", marketingError);
      }

      if (marketingData) {
        setMarketing(marketingData);
      }
    } catch (error) {
      console.error(error);
      setMessage("❌ حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  }

  async function createMarketingContent() {
    if (!product) return;

    setCreating(true);
    setMessage("");
    setMarketing(null);

    try {
      // إرسال بيانات المنتج إلى API الخاص بنا
      const response = await fetch("/api/generate-marketing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: {
            name: product.name,
            brand: product.brand,
            category: product.category,
            price: product.price,
            currency: product.currency,
            description: product.description,
            specifications: product.specifications,
            features: product.features,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("AI ERROR:", result);
        throw new Error(
          result.error || "حدث خطأ أثناء إنشاء المحتوى بالذكاء الاصطناعي."
        );
      }

      // حفظ نتيجة الذكاء الاصطناعي في Supabase
      const { data, error } = await supabase
        .from("marketing_contents")
        .insert({
          product_id: product.id,

          marketing_description:
            result.marketing_description || null,

          instagram:
            result.instagram || null,

          whatsapp:
            result.whatsapp || null,

          tiktok_snapchat:
            result.tiktok_snapchat || null,

          seo_title:
            result.seo_title || null,

          seo_description:
            result.seo_description || null,

          seo_keywords:
            result.seo_keywords || null,

          call_to_action:
            result.call_to_action || null,

          status: "generated",
        })
        .select()
        .single();

      if (error) {
        console.error("SAVE MARKETING ERROR:", error);
        throw new Error("تم إنشاء المحتوى ولكن تعذر حفظه في قاعدة البيانات.");
      }

      setMarketing(data);
      setMessage("✅ تم إنشاء المحتوى التسويقي بالذكاء الاصطناعي وحفظه بنجاح.");
    } catch (error) {
      console.error("CREATE MARKETING ERROR:", error);
      setMessage(`❌ ${error.message}`);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: "30px 18px",
          fontFamily: "Arial, sans-serif",
          background: "#f7f7fb",
        }}
      >
        <div
          style={{
            maxWidth: "850px",
            margin: "0 auto",
            background: "#fff",
            padding: "30px",
            borderRadius: "20px",
            textAlign: "center",
          }}
        >
          جاري تحميل المنتج...
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
          padding: "30px 18px",
          fontFamily: "Arial, sans-serif",
          background: "#f7f7fb",
        }}
      >
        <div
          style={{
            maxWidth: "850px",
            margin: "0 auto",
            background: "#fff",
            padding: "30px",
            borderRadius: "20px",
            textAlign: "center",
          }}
        >
          <h2>المنتج غير موجود</h2>

          <a
            href="/products"
            style={{
              display: "inline-block",
              marginTop: "20px",
              padding: "12px 20px",
              borderRadius: "12px",
              background: "#6246e5",
              color: "#fff",
              textDecoration: "none",
              fontWeight: "700",
            }}
          >
            العودة إلى المنتجات
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
        padding: "25px 18px 50px",
        fontFamily: "Arial, sans-serif",
        background: "#f7f7fb",
      }}
    >
      <div
        style={{
          maxWidth: "850px",
          margin: "0 auto",
        }}
      >
        <a
          href="/products"
          style={{
            display: "inline-block",
            marginBottom: "18px",
            textDecoration: "none",
            color: "#6246e5",
            fontWeight: "700",
          }}
        >
          ← العودة إلى إدارة المنتجات
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
              marginBottom: "25px",
              paddingBottom: "20px",
              borderBottom: "1px solid #eee",
            }}
          >
            <div
              style={{
                display: "inline-block",
                background: "#eeeaff",
                color: "#6246e5",
                padding: "7px 12px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "700",
                marginBottom: "12px",
              }}
            >
              🤖 التسويق بالذكاء الاصطناعي
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "30px",
              }}
            >
              {product.name}
            </h1>

            <p
              style={{
                margin: "0",
                color: "#666",
                lineHeight: "1.8",
              }}
            >
              {product.brand && `العلامة التجارية: ${product.brand}`}
              {product.category && ` • ${product.category}`}
            </p>

            {product.price !== null &&
              product.price !== undefined &&
              product.price !== "" && (
                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "20px",
                    fontWeight: "800",
                  }}
                >
                  💰 {product.price} {product.currency || "AED"}
                </div>
              )}
          </div>

          <button
            onClick={createMarketingContent}
            disabled={creating}
            style={{
              width: "100%",
              border: "none",
              background: creating ? "#999" : "#6246e5",
              color: "#fff",
              padding: "16px",
              borderRadius: "14px",
              fontSize: "18px",
              fontWeight: "800",
              cursor: creating ? "default" : "pointer",
            }}
          >
            {creating
              ? "🤖 جاري إنشاء المحتوى بالذكاء الاصطناعي..."
              : "🚀 إنشاء الكل بالذكاء الاصطناعي"}
          </button>

          {message && (
            <div
              style={{
                marginTop: "18px",
                padding: "14px",
                borderRadius: "12px",
                background: message.startsWith("❌")
                  ? "#fff0f0"
                  : "#eefbf3",
                color: message.startsWith("❌")
                  ? "#b42318"
                  : "#16794c",
                lineHeight: "1.7",
                fontWeight: "700",
              }}
            >
              {message}
            </div>
          )}

          {marketing && (
            <div
              style={{
                marginTop: "25px",
                display: "grid",
                gap: "16px",
              }}
            >
              <MarketingCard
                title="✍️ الوصف التسويقي"
                content={marketing.marketing_description}
              />

              <MarketingCard
                title="📱 Instagram"
                content={marketing.instagram}
              />

              <MarketingCard
                title="💬 WhatsApp"
                content={marketing.whatsapp}
              />

              <MarketingCard
                title="🎵 TikTok / Snapchat"
                content={marketing.tiktok_snapchat}
              />

              <MarketingCard
                title="🔎 SEO"
                content={
                  <>
                    <strong>العنوان:</strong>
                    <div style={{ marginBottom: "12px" }}>
                      {marketing.seo_title}
                    </div>

                    <strong>الوصف:</strong>
                    <div style={{ marginBottom: "12px" }}>
                      {marketing.seo_description}
                    </div>

                    <strong>الكلمات المفتاحية:</strong>
                    <div>{marketing.seo_keywords}</div>
                  </>
                }
              />

              <MarketingCard
                title="🎯 الدعوة لاتخاذ إجراء"
                content={marketing.call_to_action}
              />

              <div
                style={{
                  background: "#f5f5f5",
                  borderRadius: "16px",
                  padding: "20px",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    fontSize: "20px",
                  }}
                >
                  🖼️ صورة الإعلان
                </h2>

                <p
                  style={{
                    color: "#666",
                    marginBottom: 0,
                  }}
                >
                  سيتم إضافة إنشاء صورة الإعلان بالذكاء الاصطناعي في الخطوة
                  التالية.
                </p>
              </div>

              <div
                style={{
                  background: "#f5f5f5",
                  borderRadius: "16px",
                  padding: "20px",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    fontSize: "20px",
                  }}
                >
                  🎬 فيديو الإعلان
                </h2>

                <p
                  style={{
                    color: "#666",
                    marginBottom: 0,
                  }}
                >
                  سيتم إضافة إنشاء فيديو الإعلان في مرحلة لاحقة.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function MarketingCard({ title, content }) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #eee",
        borderRadius: "16px",
        padding: "20px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: "14px",
          fontSize: "20px",
        }}
      >
        {title}
      </h2>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: "1.9",
          color: "#333",
        }}
      >
        {content || "لا يوجد محتوى."}
      </div>
    </div>
  );
}
