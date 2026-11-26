"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

export default function MarketingPage() {
  const params = useParams();
  const router = useRouter();

  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [acceptingResponsibility, setAcceptingResponsibility] =
    useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [product, setProduct] = useState(null);
  const [marketing, setMarketing] = useState(null);

  const [responsibilityAccepted, setResponsibilityAccepted] =
    useState(false);

  const [showResponsibility, setShowResponsibility] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  useEffect(() => {
    if (id) {
      loadPage();
    }
  }, [id]);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      const { data: shopData, error: shopError } =
        await supabase
          .from("shops")
          .select("*")
          .eq("owner_id", currentUser.id)
          .maybeSingle();

      if (shopError) {
        throw shopError;
      }

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

      if (productError) {
        throw productError;
      }

      if (!productData) {
        router.replace("/products");
        return;
      }

      setProduct(productData);

      const locked =
        productData.verification_status === "locked" ||
        productData.safety_status === "locked";

      if (locked) {
        setMarketing(null);
        return;
      }

      const needsResponsibility =
        isProductUnclear(productData);

      if (needsResponsibility) {
        const {
          data: acceptanceData,
          error: acceptanceError,
        } = await supabase
          .from("product_responsibility_acceptances")
          .select("id, policy_version, accepted_at")
          .eq("user_id", currentUser.id)
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

      const {
        data: marketingData,
        error: marketingError,
      } = await supabase
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
        setMarketing(marketingData);
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

      if (error) {
        throw error;
      }

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
    if (
      !product ||
      !shop ||
      generating
    ) {
      return;
    }

    const locked =
      product.verification_status === "locked" ||
      product.safety_status === "locked";

    if (locked) {
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
        "⚠️ يجب الموافقة على إقرار المسؤولية قبل متابعة التسويق."
      );
      return;
    }

    setGenerating(true);
    setMessage("");

    let createdMarketingId = null;

    try {
      /*
       * ننشئ سجلًا بحالة processing أولًا.
       * هذا يجعل النظام يعرف أن عملية التوليد بدأت.
       */
      const { data: processingRecord, error: processingError } =
        await supabase
          .from("marketing_contents")
          .insert({
            product_id: product.id,
            shop_id: shop.id,
            status: "processing",
          })
          .select()
          .single();

      if (processingError) {
        throw processingError;
      }

      createdMarketingId = processingRecord.id;
      setMarketing(processingRecord);

      const response = await fetch(
        "/api/generate-marketing",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product,
            shop,
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
        result?.marketing || result;

      const updatePayload = {
        marketing_description:
          generated.marketing_description ||
          null,

        instagram:
          generated.instagram ||
          null,

        whatsapp:
          generated.whatsapp ||
          null,

        tiktok_snapchat:
          generated.tiktok_snapchat ||
          null,

        seo_title:
          generated.seo_title ||
          null,

        seo_description:
          generated.seo_description ||
          null,

        seo_keywords:
          generated.seo_keywords ||
          null,

        call_to_action:
          generated.call_to_action ||
          null,

        status: "completed",

        updated_at:
          new Date().toISOString(),
      };

      const {
        data: completedMarketing,
        error: updateError,
      } = await supabase
        .from("marketing_contents")
        .update(updatePayload)
        .eq("id", createdMarketingId)
        .eq("product_id", product.id)
        .eq("shop_id", shop.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setMarketing(completedMarketing);

      const newUpdatedAt =
        new Date().toISOString();

      const { error: productUpdateError } =
        await supabase
          .from("products")
          .update({
            ai_status: "completed",
            updated_at: newUpdatedAt,
          })
          .eq("id", product.id)
          .eq("shop_id", shop.id);

      if (productUpdateError) {
        console.warn(
          "Product status update warning:",
          productUpdateError
        );
      }

      setProduct((previous) => ({
        ...previous,
        ai_status: "completed",
        updated_at: newUpdatedAt,
      }));

      setMessageType("success");
      setMessage(
        "✅ تم إنشاء المحتوى التسويقي بنجاح."
      );
    } catch (error) {
      console.error(error);

      /*
       * إذا فشل التوليد وكان عندنا سجل processing
       * نحوله إلى failed بدل تركه معلقًا.
       */
      if (createdMarketingId) {
        await supabase
          .from("marketing_contents")
          .update({
            status: "failed",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", createdMarketingId)
          .eq("shop_id", shop.id);
      }

      setMessageType("error");
      setMessage(
        error?.message ||
          "حدث خطأ أثناء إنشاء المحتوى التسويقي."
      );

      /*
       * لا نعرض السجل الفاشل كمحتوى جاهز.
       */
      if (createdMarketingId) {
        setMarketing(null);
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        style={pageStyle}
      >
        <div style={containerStyle}>
          <div style={cardStyle}>
            <div
              style={{
                fontSize: 42,
                marginBottom: 10,
              }}
            >
              ⚠️
            </div>

            <h2 style={{ marginTop: 0 }}>
              تعذر تحميل المنتج
            </h2>

            <p style={mutedText}>
              {message ||
                "لم يتم العثور على المنتج."}
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/products")
              }
              style={primaryButton}
            >
              العودة إلى المنتجات
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isLocked =
    product.verification_status === "locked" ||
    product.safety_status === "locked";

  const productNeedsResponsibility =
    isProductUnclear(product);

  const marketingProcessing =
    marketing?.status === "processing";

  return (
    <main
      dir="rtl"
      style={pageStyle}
    >
      <div style={containerStyle}>
        <button
          type="button"
          onClick={() =>
            router.push("/marketing")
          }
          style={backButton}
        >
          ← مركز التسويق
        </button>

        <div style={heroCardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "#ecfdf5",
                  color: "#047857",
                  border:
                    "1px solid #bbf7d0",
                  padding: "7px 11px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: "bold",
                  marginBottom: 12,
                }}
              >
                📣 التسويق الذكي
              </div>

              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: 30,
                }}
              >
                {product.name}
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  lineHeight: 1.7,
                }}
              >
                إنشاء وإدارة المحتوى التسويقي
                الكامل لهذا المنتج.
              </p>
            </div>

            <StatusBadge
              product={product}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginTop: 22,
            }}
          >
            <InfoCard
              title="العلامة التجارية"
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

            <InfoCard
              title="حالة التسويق"
              value={
                marketingProcessing
                  ? "جاري الإنشاء"
                  : marketing
                  ? "محتوى جاهز"
                  : "لم يتم الإنشاء"
              }
            />
          </div>
        </div>

        {isLocked ? (
          <div style={lockedCardStyle}>
            <div
              style={{
                fontSize: 42,
                marginBottom: 8,
              }}
            >
              🔒
            </div>

            <h2
              style={{
                margin: "0 0 10px",
              }}
            >
              المنتج مقفول
            </h2>

            <p style={{ lineHeight: 1.8 }}>
              لا يمكن إنشاء أو تعديل المحتوى
              التسويقي لهذا المنتج حتى تتم
              مراجعته واعتماده.
            </p>

            {product.safety_reason && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  background: "#fff",
                  borderRadius: 12,
                  color: "#991b1b",
                  lineHeight: 1.7,
                }}
              >
                <strong>
                  سبب القفل:
                </strong>{" "}
                {product.safety_reason}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 18,
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
                  router.push("/products")
                }
                style={secondaryButton}
              >
                ← المنتجات
              </button>
            </div>
          </div>
        ) : (
          <>
            {productNeedsResponsibility &&
              !responsibilityAccepted &&
              showResponsibility && (
                <div
                  style={
                    responsibilityCardStyle
                  }
                >
                  <div
                    style={{
                      fontSize: 36,
                      marginBottom: 8,
                    }}
                  >
                    ⚠️
                  </div>

                  <h2
                    style={{
                      margin: "0 0 10px",
                    }}
                  >
                    تنبيه قبل المتابعة
                  </h2>

                  <p
                    style={{
                      lineHeight: 1.8,
                      marginBottom: 12,
                    }}
                  >
                    لم يتمكن النظام من التحقق
                    بشكل كافٍ من بعض معلومات
                    هذا المنتج.
                  </p>

                  <p
                    style={{
                      lineHeight: 1.8,
                      marginBottom: 16,
                    }}
                  >
                    هذا لا يعني أن المنتج مخالف،
                    ولكن يجب عليك التأكد من صحة
                    المعلومات وقانونية بيع المنتج
                    وتسويقه.
                  </p>

                  <div
                    style={{
                      padding: 17,
                      background: "#fff",
                      borderRadius: 14,
                      border:
                        "1px solid #fde68a",
                      lineHeight: 1.8,
                    }}
                  >
                    <strong>
                      إقرار مسؤولية التاجر
                    </strong>

                    <p
                      style={{
                        margin:
                          "8px 0 0",
                      }}
                    >
                      أقر بأنني مسؤول عن المنتج
                      الذي أقوم ببيعه أو تسويقه،
                      وأنني مسؤول عن التأكد من
                      قانونية المنتج وصحة المعلومات
                      المقدمة عنه.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      acceptResponsibility
                    }
                    disabled={
                      acceptingResponsibility
                    }
                    style={{
                      ...primaryButton,
                      width: "100%",
                      marginTop: 16,
                      background:
                        acceptingResponsibility
                          ? "#94a3b8"
                          : "#059669",
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
                    borderRadius: 13,
                    background: "#ecfdf5",
                    border:
                      "1px solid #bbf7d0",
                    color: "#047857",
                    fontWeight: "bold",
                  }}
                >
                  ✅ تم تسجيل إقرار المسؤولية
                  لهذا المنتج.
                </div>
              )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) 1.5fr",
                gap: 18,
                marginTop: 18,
              }}
            >
              <div style={cardStyle}>
                <h2
                  style={{
                    marginTop: 0,
                  }}
                >
                  🛍️ المنتج
                </h2>

                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{
                      width: "100%",
                      height: 280,
                      objectFit: "contain",
                      borderRadius: 16,
                      background:
                        "#f8fafc",
                      border:
                        "1px solid #e2e8f0",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 280,
                      borderRadius: 16,
                      background:
                        "#f8fafc",
                      border:
                        "1px solid #e2e8f0",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      color: "#94a3b8",
                    }}
                  >
                    لا توجد صورة
                  </div>
                )}

                <div
                  style={{
                    marginTop: 15,
                    lineHeight: 1.8,
                  }}
                >
                  <strong>
                    {product.name}
                  </strong>

                  {product.description && (
                    <p
                      style={{
                        color: "#64748b",
                        marginBottom: 0,
                      }}
                    >
                      {product.description}
                    </p>
                  )}
                </div>
              </div>

              <div style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin:
                          "0 0 6px",
                      }}
                    >
                      🚀 إنشاء المحتوى
                    </h2>

                    <p
                      style={{
                        margin: 0,
                        color: "#64748b",
                      }}
                    >
                      دع الذكاء الاصطناعي يبني
                      المحتوى التسويقي للمنتج.
                    </p>
                  </div>

                  {marketing?.status ===
                    "completed" && (
                    <span
                      style={readyBadge}
                    >
                      ✅ جاهز
                    </span>
                  )}

                  {marketingProcessing && (
                    <span
                      style={{
                        ...readyBadge,
                        background:
                          "#fffbeb",
                        color:
                          "#a16207",
                        border:
                          "1px solid #fde68a",
                      }}
                    >
                      ⏳ جاري الإنشاء
                    </span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 20,
                    display: "grid",
                    gap: 11,
                  }}
                >
                  <FeatureRow
                    icon="📝"
                    title="الوصف التسويقي"
                    text="صياغة وصف احترافي مناسب للبيع."
                  />

                  <FeatureRow
                    icon="📸"
                    title="Instagram"
                    text="محتوى جاهز للنشر على Instagram."
                  />

                  <FeatureRow
                    icon="💬"
                    title="WhatsApp"
                    text="رسالة تسويقية جاهزة للعملاء."
                  />

                  <FeatureRow
                    icon="🎬"
                    title="TikTok / Snapchat"
                    text="نص مناسب للمحتوى القصير."
                  />

                  <FeatureRow
                    icon="🔎"
                    title="SEO"
                    text="عنوان ووصف وكلمات مفتاحية."
                  />

                  <FeatureRow
                    icon="🎯"
                    title="Call To Action"
                    text="دعوة واضحة للشراء أو التواصل."
                  />
                </div>

                <button
                  type="button"
                  onClick={
                    generateMarketing
                  }
                  disabled={
                    generating ||
                    marketingProcessing ||
                    (productNeedsResponsibility &&
                      !responsibilityAccepted)
                  }
                  style={{
                    ...primaryButton,
                    width: "100%",
                    marginTop: 20,
                    background:
                      generating ||
                      marketingProcessing ||
                      (productNeedsResponsibility &&
                        !responsibilityAccepted)
                        ? "#94a3b8"
                        : "#059669",
                    cursor:
                      generating ||
                      marketingProcessing ||
                      (productNeedsResponsibility &&
                        !responsibilityAccepted)
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {generating ||
                  marketingProcessing
                    ? "⏳ جاري إنشاء المحتوى..."
                    : productNeedsResponsibility &&
                      !responsibilityAccepted
                    ? "⚠️ وافق على الإقرار أولًا"
                    : marketing?.status ===
                      "completed"
                    ? "🔄 إنشاء محتوى جديد"
                    : "🚀 إنشاء المحتوى التسويقي"}
                </button>
              </div>
            </div>

            {message && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 13,
                  background:
                    messageType ===
                    "error"
                      ? "#fef2f2"
                      : "#ecfdf5",
                  border:
                    messageType ===
                    "error"
                      ? "1px solid #fecaca"
                      : "1px solid #bbf7d0",
                  color:
                    messageType ===
                    "error"
                      ? "#b91c1c"
                      : "#047857",
                  lineHeight: 1.7,
                  fontWeight: 600,
                }}
              >
                {message}
              </div>
            )}

            {marketing &&
              marketing.status ===
                "completed" && (
                <div
                  style={{
                    ...cardStyle,
                    marginTop: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin:
                            "0 0 5px",
                        }}
                      >
                        📣 المحتوى التسويقي
                      </h2>

                      <p
                        style={{
                          margin: 0,
                          color: "#64748b",
                        }}
                      >
                        المحتوى الذي تم إنشاؤه
                        لهذا المنتج.
                      </p>
                    </div>

                    <span
                      style={readyBadge}
                    >
                      🟢 مكتمل
                    </span>
                  </div>

                  <MarketingSection
                    title="📝 الوصف التسويقي"
                    value={
                      marketing.marketing_description
                    }
                  />

                  <MarketingSection
                    title="📸 Instagram"
                    value={
                      marketing.instagram
                    }
                  />

                  <MarketingSection
                    title="💬 WhatsApp"
                    value={
                      marketing.whatsapp
                    }
                  />

                  <MarketingSection
                    title="🎬 TikTok / Snapchat"
                    value={
                      marketing.tiktok_snapchat
                    }
                  />

                  <MarketingSection
                    title="🔎 SEO Title"
                    value={
                      marketing.seo_title
                    }
                  />

                  <MarketingSection
                    title="🔎 SEO Description"
                    value={
                      marketing.seo_description
                    }
                  />

                  <MarketingSection
                    title="🔑 SEO Keywords"
                    value={
                      marketing.seo_keywords
                    }
                  />

                  <MarketingSection
                    title="🎯 Call To Action"
                    value={
                      marketing.call_to_action
                    }
                  />

                  <div
                    style={{
                      marginTop: 20,
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <ActionButton
                      onClick={() =>
                        copyText(
                          marketing.marketing_description,
                          setMessage,
                          setMessageType
                        )
                      }
                      icon="📋"
                      title="نسخ الوصف"
                    />

                    <ActionButton
                      onClick={() =>
                        copyText(
                          marketing.instagram,
                          setMessage,
                          setMessageType
                        )
                      }
                      icon="📸"
                      title="نسخ Instagram"
                    />

                    <ActionButton
                      onClick={() =>
                        copyText(
                          marketing.whatsapp,
                          setMessage,
                          setMessageType
                        )
                      }
                      icon="💬"
                      title="نسخ WhatsApp"
                    />

                    <ActionButton
                      onClick={() =>
                        copyText(
                          marketing.seo_description,
                          setMessage,
                          setMessageType
                        )
                      }
                      icon="🔎"
                      title="نسخ SEO"
                    />
                  </div>
                </div>
              )}

            <div
              style={{
                ...cardStyle,
                marginTop: 18,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                ⚡ الانتقال للخطوات التالية
              </h2>

              <p
                style={{
                  color: "#64748b",
                  lineHeight: 1.7,
                }}
              >
                بعد تجهيز المحتوى يمكنك الانتقال
                مباشرة إلى التصميم أو الفيديو.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 10,
                  marginTop: 15,
                }}
              >
                <ActionButton
                  onClick={() =>
                    router.push(
                      `/product-intelligence/${product.id}`
                    )
                  }
                  icon="🧠"
                  title="معلومات المنتج"
                />

                <ActionButton
                  onClick={() =>
                    router.push(
                      `/edit-product/${product.id}`
                    )
                  }
                  icon="✏️"
                  title="تعديل المنتج"
                />

                <ActionButton
                  onClick={() =>
                    router.push(
                      `/designs?product=${product.id}`
                    )
                  }
                  icon="🎨"
                  title="إنشاء تصميم"
                />

                <ActionButton
                  onClick={() =>
                    router.push(
                      `/videos/new?product=${product.id}`
                    )
                  }
                  icon="🎬"
                  title="إنشاء فيديو"
                />
              </div>
            </div>
          </>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push("/marketing")
            }
            style={backButton}
          >
            ← العودة إلى مركز التسويق
          </button>
        </div>
      </div>
    </main>
  );
}

async function copyText(
  value,
  setMessage,
  setMessageType
) {
  if (!value) {
    setMessageType("error");
    setMessage("لا يوجد محتوى لنسخه.");
    return;
  }

  try {
    await navigator.clipboard.writeText(
      value
    );

    setMessageType("success");
    setMessage("✅ تم نسخ المحتوى.");
  } catch (error) {
    console.error(error);

    setMessageType("error");
    setMessage(
      "تعذر النسخ تلقائيًا. حاول تحديد النص ونسخه يدويًا."
    );
  }
}

function isProductUnclear(product) {
  if (!product) return false;

  const verification =
    product.verification_status;

  const safety =
    product.safety_status;

  const confidence = String(
    product.confidence || ""
  )
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
    product.verification_status ===
      "locked" ||
    product.safety_status === "locked";

  if (isLocked) {
    return (
      <span
        style={{
          background: "#fef2f2",
          color: "#b91c1c",
          border:
            "1px solid #fecaca",
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
          background: "#fffbeb",
          color: "#a16207",
          border:
            "1px solid #fde68a",
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
        background: "#ecfdf5",
        color: "#047857",
        border:
          "1px solid #bbf7d0",
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
        background: "#f8fafc",
        border:
          "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          marginBottom: 5,
        }}
      >
        {title}
      </div>

      <strong
        style={{
          color: "#0f172a",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  text,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: 12,
        borderRadius: 12,
        background: "#f8fafc",
        border:
          "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "#ecfdf5",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          fontSize: 19,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div>
        <strong
          style={{
            display: "block",
            marginBottom: 2,
          }}
        >
          {title}
        </strong>

        <span
          style={{
            color: "#64748b",
            fontSize: 13,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

function MarketingSection({
  title,
  value,
}) {
  if (!value) return null;

  return (
    <div
      style={{
        marginTop: 15,
        padding: 18,
        borderRadius: 15,
        background: "#f8fafc",
        border:
          "1px solid #e2e8f0",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 10,
          fontSize: 16,
        }}
      >
        {title}
      </h3>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.9,
          color: "#334155",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  title,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border:
          "1px solid #bbf7d0",
        background: "#f0fdf4",
        color: "#047857",
        padding: "13px 15px",
        borderRadius: 13,
        fontSize: 14,
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      {icon} {title}
    </button>
  );
}

function LoadingScreen() {
  return (
    <main
      dir="rtl"
      style={pageStyle}
    >
      <div style={containerStyle}>
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            marginTop: 70,
          }}
        >
          <div
            style={{
              fontSize: 42,
              marginBottom: 12,
            }}
          >
            📣
          </div>

          <strong>
            جاري تحميل صفحة التسويق...
          </strong>
        </div>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 280px)",
  padding: "24px 14px 60px",
  fontFamily:
    "Arial, sans-serif",
  color: "#0f172a",
};

const containerStyle = {
  maxWidth: 1050,
  margin: "0 auto",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 20,
  padding: 22,
  boxShadow:
    "0 8px 30px rgba(15, 23, 42, 0.06)",
  border:
    "1px solid #e2e8f0",
};

const heroCardStyle = {
  ...cardStyle,
  border:
    "1px solid #bbf7d0",
};

const lockedCardStyle = {
  marginTop: 18,
  padding: 22,
  borderRadius: 18,
  background: "#fef2f2",
  border:
    "1px solid #fecaca",
  color: "#991b1b",
  lineHeight: 1.8,
};

const responsibilityCardStyle = {
  marginTop: 18,
  padding: 22,
  borderRadius: 18,
  background: "#fffbeb",
  border:
    "1px solid #fde68a",
  color: "#713f12",
  lineHeight: 1.8,
};

const primaryButton = {
  border: "none",
  background: "#059669",
  color: "#fff",
  padding: "14px 18px",
  borderRadius: 13,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButton = {
  border:
    "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  padding: "11px 15px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: "bold",
  cursor: "pointer",
};

const backButton = {
  border: "none",
  background: "transparent",
  color: "#047857",
  padding: "5px 0",
  fontSize: 14,
  fontWeight: "bold",
  cursor: "pointer",
  marginBottom: 12,
};

const mutedText = {
  color: "#64748b",
  lineHeight: 1.8,
};

const readyBadge = {
  display: "inline-flex",
  alignItems: "center",
  background: "#ecfdf5",
  color: "#047857",
  border:
    "1px solid #bbf7d0",
  padding: "7px 11px",
  borderRadius: 20,
  fontSize: 13,
  fontWeight: "bold",
};
