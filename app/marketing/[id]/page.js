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

  const [responsibilityAccepted, setResponsibilityAccepted] =
    useState(false);

  const [showResponsibility, setShowResponsibility] =
    useState(false);

  const [acceptingResponsibility, setAcceptingResponsibility] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

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

      if (shopError) throw shopError;

      if (!shopData) {
        router.replace("/setup-shop");
        return;
      }

      if (shopData.status !== "active") {
        setMessageType("error");
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

      if (productError) throw productError;

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

      const needsResponsibility =
        isProductUnclear(productData);

      if (needsResponsibility) {
        const { data: acceptanceData, error: acceptanceError } =
          await supabase
            .from("product_responsibility_acceptances")
            .select("id, policy_version, accepted_at")
            .eq("user_id", user.id)
            .eq("product_id", productData.id)
            .maybeSingle();

        if (acceptanceError) {
          console.warn(
            "Responsibility acceptance load warning:",
            acceptanceError
          );
        }

        if (acceptanceData) {
          setResponsibilityAccepted(true);
          setShowResponsibility(false);
        } else {
          setResponsibilityAccepted(false);
          setShowResponsibility(true);
        }
      } else {
        setResponsibilityAccepted(true);
        setShowResponsibility(false);
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
        console.warn(
          "Marketing load warning:",
          marketingError
        );
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

      setMessageType("error");
      setMessage(
        error?.message ||
          "حدث خطأ أثناء تحميل صفحة التسويق."
      );
    } finally {
      setLoading(false);
    }
  }

  async function acceptResponsibility() {
    if (
      !product ||
      !shop ||
      !user ||
      acceptingResponsibility
    ) {
      return;
    }

    setAcceptingResponsibility(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("product_responsibility_acceptances")
        .upsert(
          {
            user_id: user.id,
            shop_id: shop.id,
            product_id: product.id,
            policy_version: "1.0",
          },
          {
            onConflict: "user_id,product_id",
          }
        );

      if (error) throw error;

      setResponsibilityAccepted(true);
      setShowResponsibility(false);

      setMessageType("success");
      setMessage(
        "تم تسجيل إقرار المسؤولية. يمكنك الآن متابعة التسويق."
      );
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        error?.message ||
          "تعذر تسجيل إقرار المسؤولية."
      );
    } finally {
      setAcceptingResponsibility(false);
    }
  }

  async function generateMarketing() {
    if (!product || !shop || generating) return;

    const isLocked =
      product.verification_status === "locked" ||
      product.safety_status === "locked";

    if (isLocked) {
      setMessageType("error");
      setMessage(
        "🔒 هذا المنتج مقفول ولا يمكن إنشاء محتوى تسويقي له."
      );
      return;
    }

    if (
      isProductUnclear(product) &&
      !responsibilityAccepted
    ) {
      setShowResponsibility(true);

      setMessageType("error");
      setMessage(
        "⚠️ يجب قراءة إقرار المسؤولية والموافقة عليه قبل متابعة التسويق."
      );

      return;
    }

    setGenerating(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/generate-marketing",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "فشل إنشاء المحتوى التسويقي."
        );
      }

      const generated =
        result.marketing || result;

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

      if (error) throw error;

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
        updated_at: new Date().toISOString(),
      });

      setMessageType("success");
      setMessage(
        "تم إنشاء المحتوى التسويقي بنجاح."
      );
    } catch (error) {
      console.error(error);

      setMessageType("error");
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
          background: "#f7f8fa",
          padding: 30,
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 600,
            margin: "80px auto",
            background: "#fff",
            padding: 30,
            borderRadius: 20,
            boxShadow:
              "0 5px 25px rgba(0,0,0,0.06)",
          }}
        >
          جاري تحميل صفحة التسويق...
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
          background: "#f7f8fa",
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "50px auto",
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

  const productNeedsResponsibility =
    isProductUnclear(product);

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
            boxShadow:
              "0 5px 25px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 15,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  marginTop: 0,
                  marginBottom: 8,
                }}
              >
                🚀 التسويق الذكي
              </h1>

              <p
                style={{
                  color: "#666",
                  marginTop: 0,
                }}
              >
                إنشاء المحتوى التسويقي للمنتج:
                <strong> {product.name}</strong>
              </p>
            </div>

            <StatusBadge
              product={product}
            />
          </div>

          {isLocked ? (
            <div
              style={{
                marginTop: 20,
                padding: 20,
                borderRadius: 16,
                background: "#fff1f1",
                border: "1px solid #f1b5b5",
                lineHeight: 1.9,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 8,
                }}
              >
                🔒
              </div>

              <strong>
                المنتج مقفول
              </strong>

              <p>
                لا يمكن إنشاء محتوى تسويقي لهذا
                المنتج حاليًا بسبب وجود حالة تستدعي
                المراجعة.
              </p>

              {product.safety_reason && (
                <div
                  style={{
                    padding: 12,
                    background: "#fff",
                    borderRadius: 10,
                    color: "#8a2222",
                  }}
                >
                  <strong>
                    السبب:
                  </strong>{" "}
                  {product.safety_reason}
                </div>
              )}
            </div>
          ) : (
            <>
              {productNeedsResponsibility &&
                !responsibilityAccepted &&
                showResponsibility && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: 20,
                      borderRadius: 16,
                      background: "#fff8e1",
                      border:
                        "1px solid #f4c542",
                      lineHeight: 1.9,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 28,
                        marginBottom: 8,
                      }}
                    >
                      ⚠️
                    </div>

                    <h2
                      style={{
                        marginTop: 0,
                        marginBottom: 10,
                      }}
                    >
                      تنبيه قبل المتابعة
                    </h2>

                    <p>
                      لم يتمكن النظام من التحقق
                      بشكل كافٍ من بعض معلومات هذا
                      المنتج.
                    </p>

                    <p>
                      هذا لا يعني أن المنتج مخالف،
                      ولكن ننصحك بالتأكد بنفسك من
                      صحة المعلومات وقانونية بيع
                      المنتج وتسويقه.
                    </p>

                    <div
                      style={{
                        marginTop: 15,
                        padding: 15,
                        background: "#fff",
                        borderRadius: 12,
                        border:
                          "1px solid #eee",
                      }}
                    >
                      <strong>
                        إقرار مسؤولية التاجر
                      </strong>

                      <p
                        style={{
                          marginBottom: 0,
                        }}
                      >
                        أقر بأنني مسؤول عن المنتج
                        الذي أقوم ببيعه أو تسويقه،
                        وأنني مسؤول عن التأكد من
                        قانونية المنتج وصحة المعلومات
                        المقدمة عنه، وأوافق على
                        سياسة المسؤولية الخاصة
                        بالمنتجات.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={acceptResponsibility}
                      disabled={
                        acceptingResponsibility
                      }
                      style={{
                        width: "100%",
                        marginTop: 18,
                        padding: "15px 18px",
                        border: "none",
                        borderRadius: 13,
                        background:
                          acceptingResponsibility
                            ? "#999"
                            : "#111",
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: "bold",
                        cursor:
                          acceptingResponsibility
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {acceptingResponsibility
                        ? "جاري تسجيل الموافقة..."
                        : "☑️ أوافق وأكمل"}
                    </button>
                  </div>
                )}

              {productNeedsResponsibility &&
                responsibilityAccepted && (
                  <div
                    style={{
                      marginTop: 18,
                      padding: 13,
                      borderRadius: 12,
                      background: "#eef7ee",
                      border:
                        "1px solid #cce8cc",
                      color: "#256029",
                    }}
                  >
                    ✅ تم تسجيل إقرار المسؤولية لهذا
                    المنتج.
                  </div>
                )}

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
                  value={
                    product.brand ||
                    "غير محددة"
                  }
                />

                <InfoCard
                  title="التصنيف"
                  value={
                    product.category ||
                    "غير محدد"
                  }
                />

                <InfoCard
                  title="السعر"
                  value={
                    product.price !== null &&
                    product.price !== undefined
                      ? `${product.price} ${
                          product.currency ||
                          "AED"
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
                      border:
                        "1px solid #eee",
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={generateMarketing}
                disabled={
                  generating ||
                  (productNeedsResponsibility &&
                    !responsibilityAccepted)
                }
                style={{
                  width: "100%",
                  marginTop: 25,
                  padding: "16px 18px",
                  border: "none",
                  borderRadius: 14,
                  background:
                    generating ||
                    (productNeedsResponsibility &&
                      !responsibilityAccepted)
                      ? "#999"
                      : "#111",
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: "bold",
                  cursor:
                    generating ||
                    (productNeedsResponsibility &&
                      !responsibilityAccepted)
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {generating
                  ? "جاري إنشاء المحتوى..."
                  : productNeedsResponsibility &&
                    !responsibilityAccepted
                  ? "⚠️ وافق على الإقرار أولًا"
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
                background:
                  messageType === "error"
                    ? "#fff1f1"
                    : "#eef7ee",
                border:
                  messageType === "error"
                    ? "1px solid #f1c0c0"
                    : "1px solid #cce8cc",
                color:
                  messageType === "error"
                    ? "#9b2226"
                    : "#256029",
                lineHeight: 1.7,
              }}
            >
              {message}
            </div>
          )}

          {marketing && !isLocked && (
            <div style={{ marginTop: 30 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <h2 style={{ margin: 0 }}>
                  📣 المحتوى التسويقي
                </h2>

                <span
                  style={{
                    background: "#eef7ee",
                    color: "#256029",
                    padding: "7px 11px",
                    borderRadius: 20,
                    fontSize: 13,
                  }}
                >
                  ✅ جاهز
                </span>
              </div>

              <MarketingSection
                title="الوصف التسويقي"
                value={
                  marketing.marketing_description
                }
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
                value={
                  marketing.tiktok_snapchat
                }
              />

              <MarketingSection
                title="SEO Title"
                value={marketing.seo_title}
              />

              <MarketingSection
                title="SEO Description"
                value={
                  marketing.seo_description
                }
              />

              <MarketingSection
                title="SEO Keywords"
                value={
                  marketing.seo_keywords
                }
              />

              <MarketingSection
                title="Call To Action"
                value={
                  marketing.call_to_action
                }
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
                router.push(
                  `/product-intelligence/${product.id}`
                )
              }
              style={secondaryButton}
            >
              🧠 معلومات المنتج
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/edit-product/${product.id}`
                )
              }
              style={secondaryButton}
            >
              ✏️ تعديل المنتج
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/designs")
              }
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

function isProductUnclear(product) {
  if (!product) return false;

  const verification =
    product.verification_status;

  const safety =
    product.safety_status;

  const confidence =
    String(product.confidence || "")
      .trim()
      .toLowerCase();

  if (
    safety === "locked" ||
    verification === "locked"
  ) {
    return false;
  }

  if (
    safety === "violation" ||
    safety === "critical"
  ) {
    return false;
  }

  if (
    verification === "review" ||
    verification === "unverified"
  ) {
    return true;
  }

  if (
    confidence === "low" ||
    confidence === "منخفض" ||
    confidence === "medium" ||
    confidence === "متوسط"
  ) {
    return true;
  }

  const hasName = Boolean(
    String(product.name || "").trim()
  );

  const hasBrand = Boolean(
    String(product.brand || "").trim()
  );

  const hasCategory = Boolean(
    String(product.category || "").trim()
  );

  const hasDescription = Boolean(
    String(product.description || "").trim()
  );

  if (
    hasName &&
    !hasBrand &&
    !hasCategory &&
    !hasDescription
  ) {
    return true;
  }

  return false;
}

function StatusBadge({ product }) {
  const isLocked =
    product.verification_status === "locked" ||
    product.safety_status === "locked";

  if (isLocked) {
    return (
      <span
        style={{
          background: "#fff1f1",
          color: "#9b2226",
          border: "1px solid #f1c0c0",
          padding: "8px 13px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: "bold",
        }}
      >
        🔒 مقفل
      </span>
    );
  }

  if (isProductUnclear(product)) {
    return (
      <span
        style={{
          background: "#fff8e1",
          color: "#8a6500",
          border: "1px solid #f4d477",
          padding: "8px 13px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: "bold",
        }}
      >
        🟡 يحتاج تأكيد
      </span>
    );
  }

  return (
    <span
      style={{
        background: "#eef7ee",
        color: "#256029",
        border: "1px solid #cce8cc",
        padding: "8px 13px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: "bold",
      }}
    >
      🟢 جاهز للتسويق
    </span>
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
