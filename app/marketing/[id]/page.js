"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

const supabase = createClient();

export default function MarketingPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [product, setProduct] = useState(null);
  const [marketing, setMarketing] = useState(null);

  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, [id]);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUser(user);

      const { data: shopData, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        router.replace("/setup-shop");
        return;
      }

      if (shopData.status !== "active") {
        setMessage("حساب المحل غير نشط حاليًا.");
        return;
      }

      setShop(shopData);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!productData) {
        router.replace("/products");
        return;
      }

      setProduct(productData);

      const isLocked =
        productData.verification_status === "locked" ||
        productData.safety_status === "locked";

      if (isLocked) {
        setMarketing(null);
        return;
      }

      const { data: marketingData, error: marketingError } =
        await supabase
          .from("marketing_contents")
          .select("*")
          .eq("product_id", productData.id)
          .eq("shop_id", shopData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (marketingError) {
        console.warn("Marketing load warning:", marketingError);
      }

      if (marketingData) {
        const marketingDate = new Date(
          marketingData.created_at
        ).getTime();

        const productDate = new Date(
          productData.updated_at || productData.created_at
        ).getTime();

        if (marketingDate >= productDate) {
          setMarketing(marketingData);
        }
      }
    } catch (error) {
      console.error(error);
      setMessage(
        error?.message || "حدث خطأ أثناء تحميل صفحة التسويق."
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateMarketing() {
    if (!product || !shop || generating) return;

    const isLocked =
      product.verification_status === "locked" ||
      product.safety_status === "locked";

    if (isLocked) {
      setMessage(
        "🔒 هذا المنتج مقفول ولا يمكن إنشاء محتوى تسويقي له."
      );
      return;
    }

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
          result?.error || "فشل إنشاء المحتوى التسويقي."
        );
      }

      const generated = result.marketing || result;

      const { data, error } = await supabase
        .from("marketing_contents")
        .insert({
          product_id: product.id,
          shop_id: shop.id,

          marketing_description:
            generated.marketing_description || null,

          instagram:
            generated.instagram || null,

          whatsapp:
            generated.whatsapp || null,

          tiktok_snapchat:
            generated.tiktok_snapchat || null,

          seo_title:
            generated.seo_title || null,

          seo_description:
            generated.seo_description || null,

          seo_keywords:
            generated.seo_keywords || null,

          call_to_action:
            generated.call_to_action || null,

          status: "completed",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setMarketing(data);

      await supabase
        .from("products")
        .update({
          ai_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id)
        .eq("shop_id", shop.id);

      setProduct({
        ...product,
        ai_status: "completed",
      });

      setMessage("تم إنشاء المحتوى التسويقي بنجاح.");
    } catch (error) {
      console.error(error);

      setMessage(
        error?.message ||
          "حدث خطأ أثناء إنشاء المحتوى التسويقي."
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
          minHeight: "100vh",
          padding: 30,
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        جاري تحميل صفحة التسويق...
      </main>
    );
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            background: "#fff",
            padding: 25,
            borderRadius: 18,
          }}
        >
          {message || "تعذر تحميل المنتج."}
        </div>
      </main>
    );
  }

  const isLocked =
    product.verification_status === "locked" ||
    product.safety_status === "locked";

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        padding: "24px 14px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 950,
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/products")}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 15,
            marginBottom: 15,
          }}
        >
          ← العودة للمنتجات
        </button>

        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            boxShadow: "0 5px 25px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            🚀 التسويق الذكي
          </h1>

          <p style={{ color: "#666" }}>
            إنشاء المحتوى التسويقي للمنتج:
            <strong> {product.name}</strong>
          </p>

          {isLocked ? (
            <div
              style={{
                marginTop: 20,
                padding: 20,
                borderRadius: 16,
                background: "#fff3cd",
                border: "1px solid #ffe08a",
                lineHeight: 1.9,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  marginBottom: 8,
                }}
              >
                🔒
              </div>

              <strong>المنتج مقفول</strong>

              <p style={{ marginBottom: 0 }}>
                لا يمكن إنشاء محتوى تسويقي لهذا المنتج حاليًا.
                يجب مراجعة المنتج واعتماده أولًا من النظام أو
                المشرف العام.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  marginTop: 20,
                }}
              >
                <InfoCard
                  title="المنتج"
                  value={product.name}
                />

                <InfoCard
                  title="العلامة"
                  value={product.brand || "غير محددة"}
                />

                <InfoCard
                  title="التصنيف"
                  value={product.category || "غير محدد"}
                />

                <InfoCard
                  title="السعر"
                  value={
                    product.price !== null &&
                    product.price !== undefined
                      ? `${product.price} ${
                          product.currency || "AED"
                        }`
                      : "غير محدد"
                  }
                />
              </div>

              {product.image_url && (
                <div
                  style={{
                    marginTop: 25,
                    textAlign: "center",
                  }}
                >
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{
                      width: "100%",
                      maxWidth: 300,
                      height: 300,
                      objectFit: "contain",
                      borderRadius: 18,
                      background: "#fafafa",
                      border: "1px solid #eee",
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={generateMarketing}
                disabled={generating}
                style={{
                  width: "100%",
                  marginTop: 25,
                  padding: "16px 18px",
                  border: "none",
                  borderRadius: 14,
                  background: generating
                    ? "#999"
                    : "#111",
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: "bold",
                  cursor: generating
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {generating
                  ? "جاري إنشاء المحتوى..."
                  : marketing
                  ? "🔄 إنشاء محتوى جديد"
                  : "🚀 إنشاء المحتوى التسويقي"}
              </button>
            </>
          )}

          {message && !isLocked && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                background: "#eef7ee",
                lineHeight: 1.7,
              }}
            >
              {message}
            </div>
          )}

          {marketing && !isLocked && (
            <div style={{ marginTop: 30 }}>
              <h2>📣 المحتوى التسويقي</h2>

              <MarketingSection
                title="الوصف التسويقي"
                value={marketing.marketing_description}
              />

              <MarketingSection
                title="Instagram"
                value={marketing.instagram}
              />

              <MarketingSection
                title="WhatsApp"
                value={marketing.whatsapp}
              />

              <MarketingSection
                title="TikTok / Snapchat"
                value={marketing.tiktok_snapchat}
              />

              <MarketingSection
                title="SEO Title"
                value={marketing.seo_title}
              />

              <MarketingSection
                title="SEO Description"
                value={marketing.seo_description}
              />

              <MarketingSection
                title="SEO Keywords"
                value={marketing.seo_keywords}
              />

              <MarketingSection
                title="Call To Action"
                value={marketing.call_to_action}
              />
            </div>
          )}

          <div
            style={{
              marginTop: 30,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() =>
                router.push(`/product-intelligence/${product.id}`)
              }
              style={secondaryButton}
            >
              🧠 معلومات المنتج
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(`/edit-product/${product.id}`)
              }
              style={secondaryButton}
            >
              ✏️ تعديل المنتج
            </button>

            <button
              type="button"
              onClick={() => router.push("/designs")}
              disabled={isLocked}
              style={{
                ...secondaryButton,
                opacity: isLocked ? 0.5 : 1,
                cursor: isLocked
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              🎨 التصميم
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, value }) {
  return (
    <div
      style={{
        background: "#f8f9fb",
        borderRadius: 14,
        padding: 15,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#777",
          marginBottom: 5,
        }}
      >
        {title}
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function MarketingSection({ title, value }) {
  if (!value) return null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        borderRadius: 15,
        background: "#f8f9fb",
        border: "1px solid #eee",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 10,
        }}
      >
        {title}
      </h3>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.8,
          color: "#333",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const secondaryButton = {
  border: "1px solid #ddd",
  background: "#fff",
  padding: "11px 15px",
  borderRadius: 12,
  fontSize: 14,
  cursor: "pointer",
};
