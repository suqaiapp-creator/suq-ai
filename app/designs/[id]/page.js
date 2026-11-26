"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useRouter } from "next/navigation";

const supabase = createClient();

const FORMATS = [
  {
    id: "1:1",
    title: "منشور مربع",
    description: "مناسب لمنشورات Instagram",
    icon: "▣",
  },
  {
    id: "4:5",
    title: "منشور عمودي",
    description: "مناسب للإعلانات والمنشورات",
    icon: "▯",
  },
  {
    id: "9:16",
    title: "ستوري",
    description: "Instagram / Snapchat / TikTok",
    icon: "▥",
  },
  {
    id: "16:9",
    title: "أفقي",
    description: "شاشات وإعلانات أفقية",
    icon: "▭",
  },
];

const TEMPLATES = [
  {
    id: "product",
    title: "عرض منتج",
    description: "منتج واضح مع اسم المنتج وهوية المحل",
    icon: "🛍️",
  },
  {
    id: "discount",
    title: "خصم وسعر",
    description: "تركيز على السعر أو الخصم",
    icon: "💰",
  },
  {
    id: "new",
    title: "منتج جديد",
    description: "إعلان إطلاق منتج جديد",
    icon: "🆕",
  },
  {
    id: "bestseller",
    title: "الأكثر مبيعاً",
    description: "إبراز منتج مميز أو مشهور",
    icon: "⭐",
  },
  {
    id: "offer",
    title: "عرض خاص",
    description: "تصميم قوي للعروض والمناسبات",
    icon: "🔥",
  },
  {
    id: "simple",
    title: "إعلان بسيط",
    description: "تصميم نظيف وسريع",
    icon: "📢",
  },
  {
    id: "social",
    title: "إعلان سوشيال",
    description: "تصميم جاهز للنشر على السوشيال",
    icon: "📱",
  },
  {
    id: "premium",
    title: "فاخر",
    description: "شكل أنيق ومناسب للمنتجات الفاخرة",
    icon: "✨",
  },
];

const STYLES = [
  {
    id: "luxury",
    title: "فاخر",
    icon: "🖤",
  },
  {
    id: "modern",
    title: "عصري",
    icon: "⚡",
  },
  {
    id: "clean",
    title: "نظيف",
    icon: "🧊",
  },
  {
    id: "dark-tech",
    title: "تقني داكن",
    icon: "🌑",
  },
  {
    id: "premium",
    title: "Premium",
    icon: "💎",
  },
  {
    id: "sale",
    title: "عرض قوي",
    icon: "🔥",
  },
];

const BACKGROUNDS = [
  {
    id: "black",
    title: "أسود",
    value: "خلفية سوداء فخمة",
  },
  {
    id: "white",
    title: "أبيض",
    value: "خلفية بيضاء نظيفة",
  },
  {
    id: "dark",
    title: "داكن",
    value: "خلفية داكنة عصرية",
  },
  {
    id: "light",
    title: "فاتح",
    value: "خلفية فاتحة وناعمة",
  },
  {
    id: "gradient",
    title: "تدرج",
    value: "خلفية بتدرج لوني احترافي",
  },
];

function IconBox({
  children,
  size = 44,
  background = "#f0fdf4",
  color = "#15803d",
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 13,
        background,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 42 ? 19 : 22,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          lineHeight: 1,
          transform: "translateY(-1px)",
        }}
      >
        {children}
      </span>
    </div>
  );
}

function StatusBadge({ type, children }) {
  const styles = {
    ready: {
      background: "#ecfdf3",
      color: "#067647",
      border: "1px solid #abefc6",
    },
    warning: {
      background: "#fffaeb",
      color: "#b54708",
      border: "1px solid #fedf89",
    },
    locked: {
      background: "#fef3f2",
      color: "#b42318",
      border: "1px solid #fecdca",
    },
    pending: {
      background: "#eff8ff",
      color: "#175cd3",
      border: "1px solid #b2ddff",
    },
  };

  return (
    <span
      style={{
        ...(styles[type] || styles.pending),
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function isLocked(product) {
  return (
    product?.verification_status === "locked" ||
    product?.safety_status === "locked" ||
    product?.safety_status === "violation" ||
    product?.safety_level === "critical"
  );
}

function isUnclear(product) {
  if (!product) return true;

  if (isLocked(product)) return false;

  return (
    product.verification_status === "review" ||
    product.verification_status === "unverified" ||
    product.ai_status === "pending" ||
    product.confidence === "low" ||
    product.confidence === "medium" ||
    !product.brand ||
    !product.category ||
    !product.description
  );
}

function getProductStatus(product) {
  if (isLocked(product)) {
    return {
      type: "locked",
      text: "مقفل",
      icon: "🔴",
    };
  }

  if (isUnclear(product)) {
    return {
      type: "warning",
      text: "يحتاج تأكيد",
      icon: "🟡",
    };
  }

  return {
    type: "ready",
    text: "جاهز للتصميم",
    icon: "🟢",
  };
}

function getDesignStatus(status) {
  if (status === "completed") {
    return {
      type: "ready",
      text: "مكتمل",
      icon: "✓",
    };
  }

  if (status === "failed") {
    return {
      type: "locked",
      text: "فشل",
      icon: "!",
    };
  }

  if (
    status === "processing" ||
    status === "generating"
  ) {
    return {
      type: "pending",
      text: "قيد الإنشاء",
      icon: "⏳",
    };
  }

  return {
    type: "pending",
    text: "بانتظار الإنشاء",
    icon: "◷",
  };
}

export default function DesignsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);

  const [products, setProducts] = useState([]);
  const [designs, setDesigns] = useState([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [mode, setMode] = useState("simple");
  const [selectedTemplate, setSelectedTemplate] =
    useState("product");

  const [selectedStyle, setSelectedStyle] =
    useState("modern");

  const [selectedBackground, setSelectedBackground] =
    useState("black");

  const [selectedFormat, setSelectedFormat] =
    useState("1:1");

  const [description, setDescription] =
    useState("");

  const [showIdentity, setShowIdentity] =
    useState(true);

  const [responsibilityAccepted, setResponsibilityAccepted] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = useMemo(() => {
    return (
      products.find(
        (item) => item.id === selectedProductId
      ) || null
    );
  }, [products, selectedProductId]);

  const selectedProductLocked = selectedProduct
    ? isLocked(selectedProduct)
    : false;

  const selectedProductUnclear = selectedProduct
    ? isUnclear(selectedProduct)
    : false;

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      const {
        data: shopData,
        error: shopError,
      } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", currentUser.id)
        .order("created_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        setError(
          "لم يتم العثور على المحل الخاص بالحساب."
        );
        return;
      }

      setShop(shopData);

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", shopData.id)
        .order("created_at", {
          ascending: false,
        });

      if (productError) {
        throw productError;
      }

      setProducts(productData || []);

      if (productData?.length > 0) {
        setSelectedProductId(productData[0].id);
      }

      const {
        data: designData,
        error: designError,
      } = await supabase
        .from("ad_images")
        .select("*")
        .eq("shop_id", shopData.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(20);

      if (!designError) {
        setDesigns(designData || []);
      } else {
        console.error(
          "DESIGNS FETCH ERROR:",
          designError
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        "حدث خطأ أثناء تحميل صفحة التصميم."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkResponsibilityAcceptance() {
    if (
      !user ||
      !shop ||
      !selectedProduct
    ) {
      return false;
    }

    if (!selectedProductUnclear) {
      return true;
    }

    const {
      data,
      error: acceptanceError,
    } = await supabase
      .from(
        "product_responsibility_acceptances"
      )
      .select("id")
      .eq("user_id", user.id)
      .eq(
        "product_id",
        selectedProduct.id
      )
      .maybeSingle();

    if (acceptanceError) {
      console.error(
        acceptanceError
      );

      return false;
    }

    return Boolean(data);
  }

  async function acceptResponsibility() {
    if (
      !user ||
      !shop ||
      !selectedProduct
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        error: acceptanceError,
      } = await supabase
        .from(
          "product_responsibility_acceptances"
        )
        .upsert(
          {
            user_id: user.id,
            shop_id: shop.id,
            product_id:
              selectedProduct.id,
            policy_version: "1.0",
          },
          {
            onConflict:
              "user_id,product_id",
          }
        );

      if (acceptanceError) {
        throw acceptanceError;
      }

      setResponsibilityAccepted(true);

      setMessage(
        "تم تأكيد مسؤولية المنتج ويمكنك الآن تجهيز التصميم."
      );
    } catch (err) {
      console.error(err);

      setError(
        "تعذر حفظ تأكيد المسؤولية."
      );
    } finally {
      setSaving(false);
    }
  }

  async function createDesign() {
    setError("");
    setMessage("");

    if (!selectedProduct) {
      setError("اختر المنتج أولاً.");
      return;
    }

    if (selectedProductLocked) {
      setError(
        "هذا المنتج مقفل ولا يمكن استخدامه في التسويق أو التصميم حالياً."
      );
      return;
    }

    if (!selectedProduct.image_url) {
      setError(
        "المنتج لا يحتوي على صورة. أضف صورة المنتج أولاً."
      );
      return;
    }

    if (
      selectedProductUnclear &&
      !responsibilityAccepted
    ) {
      const accepted =
        await checkResponsibilityAcceptance();

      if (!accepted) {
        setError(
          "هذا المنتج يحتاج تأكيد مسؤولية المنتج قبل إنشاء التصميم."
        );

        return;
      }

      setResponsibilityAccepted(true);
    }

    setSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        router.replace("/login");
        return;
      }

      let backgroundValue = null;

      if (mode === "professional") {
        const backgroundItem =
          BACKGROUNDS.find(
            (item) =>
              item.id ===
              selectedBackground
          );

        backgroundValue =
          backgroundItem?.value ||
          selectedBackground ||
          null;
      }

      const response = await fetch(
        "/api/generate-design",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productId:
              selectedProduct.id,
            mode,
            template:
              mode === "simple"
                ? selectedTemplate
                : null,
            style:
              mode === "professional"
                ? selectedStyle
                : null,
            background:
              backgroundValue,
            format: selectedFormat,
            description:
              typeof description ===
              "string"
                ? description.trim()
                : "",
          }),
        }
      );

      let result = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        if (
          result?.requiresResponsibility
        ) {
          setResponsibilityAccepted(
            false
          );

          setError(
            "يجب تأكيد مسؤولية المنتج قبل إنشاء التصميم."
          );
        } else {
          setError(
            result?.error ||
              "تعذر تجهيز طلب التصميم."
          );
        }

        return;
      }

      setMessage(
        "تم إنشاء التصميم بنجاح."
      );

      await loadPage();
    } catch (err) {
      console.error(
        "Create design error:",
        err
      );

      setError(
        "حدث خطأ أثناء إرسال طلب التصميم."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleProductChange(value) {
    setSelectedProductId(value);
    setResponsibilityAccepted(false);
    setError("");
    setMessage("");
  }

  function openDesign(designId) {
    if (!designId) return;

    router.push(
      `/designs/${designId}`
    );
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f6f8f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Arial, sans-serif",
          color: "#17201c",
        }}
      >
        جاري تحميل استوديو التصميم...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f6f8f7",
        color: "#17201c",
        fontFamily:
          "Arial, sans-serif",
        paddingBottom: 60,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 18px",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#15803d",
                fontWeight: 800,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              سوق AI
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              🎨 استوديو التصميم
            </h1>

            <p
              style={{
                margin: "8px 0 0",
                color: "#66736d",
                fontSize: 15,
              }}
            >
              حوّل منتجك إلى إعلان جاهز للنشر
            </p>
          </div>

          <button
            onClick={() =>
              router.push("/products")
            }
            style={{
              border:
                "1px solid #d7dfda",
              background: "#fff",
              color: "#1f2933",
              borderRadius: 12,
              padding:
                "11px 16px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ← المنتجات
          </button>
        </header>

        {error && (
          <div
            style={{
              background: "#fef3f2",
              border:
                "1px solid #fecdca",
              color: "#b42318",
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              background: "#ecfdf3",
              border:
                "1px solid #abefc6",
              color: "#067647",
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {message}
          </div>
        )}

        <div
          className="design-layout"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.6fr) minmax(300px, .8fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section>
            <div
              className="design-card"
              style={{
                background: "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 20,
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  margin: "0 0 14px",
                  fontSize: 19,
                }}
              >
                1. اختر المنتج
              </h2>

              <select
                value={
                  selectedProductId
                }
                onChange={(e) =>
                  handleProductChange(
                    e.target.value
                  )
                }
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 12,
                  border:
                    "1px solid #cfd8d3",
                  fontSize: 15,
                  background: "#fff",
                  boxSizing:
                    "border-box",
                }}
              >
                {products.length === 0 && (
                  <option value="">
                    لا توجد منتجات
                  </option>
                )}

                {products.map(
                  (product) => (
                    <option
                      key={
                        product.id
                      }
                      value={
                        product.id
                      }
                    >
                      {product.name}
                      {product.brand
                        ? ` — ${product.brand}`
                        : ""}
                    </option>
                  )
                )}
              </select>

              {selectedProduct && (
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    gap: 14,
                    alignItems:
                      "center",
                    padding: 14,
                    background:
                      "#f8faf9",
                    border:
                      "1px solid #e6ebe8",
                    borderRadius: 16,
                  }}
                >
                  <div
                    style={{
                      width: 82,
                      height: 82,
                      minWidth: 82,
                      borderRadius: 14,
                      background:
                        "#fff",
                      border:
                        "1px solid #e1e7e3",
                      overflow:
                        "hidden",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      flexShrink: 0,
                    }}
                  >
                    {selectedProduct.image_url ? (
                      <img
                        src={
                          selectedProduct.image_url
                        }
                        alt={
                          selectedProduct.name
                        }
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "contain",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 28,
                        }}
                      >
                        📦
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 17,
                        marginBottom: 6,
                      }}
                    >
                      {
                        selectedProduct.name
                      }
                    </div>

                    <div
                      style={{
                        color:
                          "#66736d",
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      {selectedProduct.brand ||
                        "بدون علامة"}{" "}
                      {selectedProduct.category
                        ? `• ${selectedProduct.category}`
                        : ""}
                    </div>

                    {(() => {
                      const status =
                        getProductStatus(
                          selectedProduct
                        );

                      return (
                        <StatusBadge
                          type={
                            status.type
                          }
                        >
                          {status.icon}{" "}
                          {status.text}
                        </StatusBadge>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div
              className="design-card"
              style={{
                background: "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 20,
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  margin: "0 0 14px",
                  fontSize: 19,
                }}
              >
                2. نوع التصميم
              </h2>

              <div
                className="mode-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: 12,
                }}
              >
                <button
                  onClick={() =>
                    setMode("simple")
                  }
                  style={{
                    textAlign: "right",
                    padding: 16,
                    borderRadius: 16,
                    cursor: "pointer",
                    background:
                      mode === "simple"
                        ? "#f0fdf4"
                        : "#fff",
                    border:
                      mode === "simple"
                        ? "2px solid #16a34a"
                        : "1px solid #d9e1dc",
                    display: "flex",
                    alignItems:
                      "flex-start",
                    gap: 13,
                    minHeight: 102,
                  }}
                >
                  <IconBox size={46}>
                    ⚡
                  </IconBox>

                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 17,
                      }}
                    >
                      عادي وسريع
                    </div>

                    <div
                      style={{
                        color:
                          "#66736d",
                        fontSize: 13,
                        marginTop: 5,
                      }}
                    >
                      قوالب جاهزة وتصميم سريع
                    </div>
                  </div>
                </button>

                <button
                  onClick={() =>
                    setMode(
                      "professional"
                    )
                  }
                  style={{
                    textAlign: "right",
                    padding: 16,
                    borderRadius: 16,
                    cursor: "pointer",
                    background:
                      mode ===
                      "professional"
                        ? "#f0fdf4"
                        : "#fff",
                    border:
                      mode ===
                      "professional"
                        ? "2px solid #16a34a"
                        : "1px solid #d9e1dc",
                    display: "flex",
                    alignItems:
                      "flex-start",
                    gap: 13,
                    minHeight: 102,
                  }}
                >
                  <IconBox
                    size={46}
                    background="#f5f3ff"
                    color="#6d28d9"
                  >
                    💎
                  </IconBox>

                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 17,
                      }}
                    >
                      احترافي
                    </div>

                    <div
                      style={{
                        color:
                          "#66736d",
                        fontSize: 13,
                        marginTop: 5,
                      }}
                    >
                      وصف حر وتحكم أكبر بالتصميم
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {mode === "simple" && (
              <div
                className="design-card"
                style={{
                  background: "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 6px",
                    fontSize: 19,
                  }}
                >
                  3. اختر قالباً
                </h2>

                <p
                  style={{
                    color: "#66736d",
                    fontSize: 13,
                    margin:
                      "0 0 16px",
                  }}
                >
                  اختر الشكل المناسب للإعلان بدون الحاجة لكتابة وصف طويل.
                </p>

                <div
                  className="template-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  {TEMPLATES.map(
                    (template) => {
                      const active =
                        selectedTemplate ===
                        template.id;

                      return (
                        <button
                          key={
                            template.id
                          }
                          onClick={() =>
                            setSelectedTemplate(
                              template.id
                            )
                          }
                          style={{
                            textAlign:
                              "right",
                            background:
                              active
                                ? "#f0fdf4"
                                : "#fff",
                            border:
                              active
                                ? "2px solid #16a34a"
                                : "1px solid #d9e1dc",
                            borderRadius: 15,
                            padding: 14,
                            cursor:
                              "pointer",
                            display:
                              "flex",
                            alignItems:
                              "flex-start",
                            gap: 12,
                          }}
                        >
                          <IconBox
                            size={44}
                            background={
                              active
                                ? "#dcfce7"
                                : "#f5f7f6"
                            }
                          >
                            {
                              template.icon
                            }
                          </IconBox>

                          <div>
                            <div
                              style={{
                                fontWeight: 900,
                              }}
                            >
                              {
                                template.title
                              }
                            </div>

                            <div
                              style={{
                                color:
                                  "#66736d",
                                fontSize: 12,
                                marginTop: 4,
                                lineHeight:
                                  1.6,
                              }}
                            >
                              {
                                template.description
                              }
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {mode === "professional" && (
              <div
                className="design-card"
                style={{
                  background: "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 6px",
                    fontSize: 19,
                  }}
                >
                  3. صمّم بالطريقة اللي تبيها
                </h2>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  placeholder="مثال: أبغي خلفية سوداء فخمة، المنتج في المنتصف وواضح، إضاءة زرقاء خفيفة من الخلف، شعار المحل فوق، والسعر 299 درهم بشكل أنيق."
                  style={{
                    width: "100%",
                    minHeight: 150,
                    resize: "vertical",
                    padding: 15,
                    borderRadius: 14,
                    border:
                      "1px solid #cfd8d3",
                    fontSize: 15,
                    lineHeight: 1.8,
                    boxSizing:
                      "border-box",
                    fontFamily:
                      "inherit",
                  }}
                />

                <div
                  style={{
                    marginTop: 18,
                    fontWeight: 900,
                    marginBottom: 10,
                  }}
                >
                  الستايل
                </div>

                <div
                  className="style-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {STYLES.map(
                    (style) => {
                      const active =
                        selectedStyle ===
                        style.id;

                      return (
                        <button
                          key={
                            style.id
                          }
                          onClick={() =>
                            setSelectedStyle(
                              style.id
                            )
                          }
                          style={{
                            padding:
                              "11px 10px",
                            borderRadius: 12,
                            cursor:
                              "pointer",
                            background:
                              active
                                ? "#f0fdf4"
                                : "#fff",
                            border:
                              active
                                ? "2px solid #16a34a"
                                : "1px solid #d9e1dc",
                            fontWeight: 800,
                          }}
                        >
                          {
                            style.icon
                          }{" "}
                          {
                            style.title
                          }
                        </button>
                      );
                    }
                  )}
                </div>

                <div
                  style={{
                    marginTop: 18,
                    fontWeight: 900,
                    marginBottom: 10,
                  }}
                >
                  الخلفية
                </div>

                <div
                  className="background-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {BACKGROUNDS.map(
                    (background) => {
                      const active =
                        selectedBackground ===
                        background.id;

                      return (
                        <button
                          key={
                            background.id
                          }
                          onClick={() =>
                            setSelectedBackground(
                              background.id
                            )
                          }
                          style={{
                            padding:
                              "12px 10px",
                            borderRadius: 12,
                            cursor:
                              "pointer",
                            background:
                              active
                                ? "#f0fdf4"
                                : "#fff",
                            border:
                              active
                                ? "2px solid #16a34a"
                                : "1px solid #d9e1dc",
                            fontWeight: 800,
                          }}
                        >
                          {
                            background.title
                          }
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            <div
              className="design-card"
              style={{
                background: "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 20,
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  margin: "0 0 14px",
                  fontSize: 19,
                }}
              >
                4. مقاس الإعلان
              </h2>

              <div
                className="format-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {FORMATS.map(
                  (format) => {
                    const active =
                      selectedFormat ===
                      format.id;

                    return (
                      <button
                        key={
                          format.id
                        }
                        onClick={() =>
                          setSelectedFormat(
                            format.id
                          )
                        }
                        style={{
                          textAlign:
                            "right",
                          padding: 13,
                          borderRadius: 14,
                          cursor:
                            "pointer",
                          background:
                            active
                              ? "#f0fdf4"
                              : "#fff",
                          border:
                            active
                              ? "2px solid #16a34a"
                              : "1px solid #d9e1dc",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 12,
                        }}
                      >
                        <IconBox
                          size={42}
                          background={
                            active
                              ? "#dcfce7"
                              : "#f5f7f6"
                          }
                        >
                          {
                            format.icon
                          }
                        </IconBox>

                        <div>
                          <div
                            style={{
                              fontWeight: 900,
                            }}
                          >
                            {
                              format.title
                            }
                          </div>

                          <div
                            style={{
                              color:
                                "#66736d",
                              fontSize: 12,
                              marginTop: 3,
                            }}
                          >
                            {
                              format.description
                            }
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {selectedProductUnclear &&
              selectedProduct && (
                <div
                  style={{
                    background:
                      "#fffbeb",
                    border:
                      "1px solid #fedf89",
                    borderRadius: 18,
                    padding: 18,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      gap: 12,
                    }}
                  >
                    <IconBox
                      size={42}
                      background="#fef3c7"
                      color="#92400e"
                    >
                      🟡
                    </IconBox>

                    <div>
                      <div
                        style={{
                          fontWeight: 900,
                          color:
                            "#92400e",
                          marginBottom: 7,
                        }}
                      >
                        يحتاج تأكيد المنتج
                      </div>

                      <div
                        style={{
                          color:
                            "#92400e",
                          fontSize: 13,
                          lineHeight: 1.8,
                          marginBottom: 12,
                        }}
                      >
                        بعض معلومات المنتج غير مكتملة أو لم يتم التحقق منها بشكل كافٍ. يمكنك المتابعة بعد تأكيد مسؤوليتك عن صحة معلومات المنتج ومشروعيته.
                      </div>

                      {!responsibilityAccepted ? (
                        <button
                          onClick={
                            acceptResponsibility
                          }
                          disabled={
                            saving
                          }
                          style={{
                            background:
                              "#15803d",
                            color:
                              "#fff",
                            border: 0,
                            borderRadius: 11,
                            padding:
                              "11px 15px",
                            fontWeight: 900,
                          }}
                        >
                          {saving
                            ? "جاري الحفظ..."
                            : "أؤكد المسؤولية ويمكنني المتابعة"}
                        </button>
                      ) : (
                        <StatusBadge type="ready">
                          ✓ تم تأكيد المسؤولية
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                </div>
              )}

            <button
              onClick={createDesign}
              disabled={
                saving ||
                !selectedProduct ||
                selectedProductLocked ||
                (selectedProductUnclear &&
                  !responsibilityAccepted)
              }
              style={{
                width: "100%",
                border: 0,
                borderRadius: 16,
                padding: 17,
                background:
                  saving ||
                  !selectedProduct ||
                  selectedProductLocked ||
                  (selectedProductUnclear &&
                    !responsibilityAccepted)
                    ? "#aab5ae"
                    : "#15803d",
                color: "#fff",
                fontSize: 17,
                fontWeight: 900,
                cursor:
                  saving
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "جاري تجهيز التصميم..."
                : "🎨 إنشاء التصميم"}
            </button>
          </section>

          <aside>
            <div
              className="design-card"
              style={{
                background: "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <button
                onClick={() =>
                  setShowIdentity(
                    !showIdentity
                  )
                }
                style={{
                  width: "100%",
                  border: 0,
                  background:
                    "transparent",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 900,
                    fontSize: 17,
                  }}
                >
                  🏪 هوية المحل
                </span>

                <span>
                  {showIdentity
                    ? "⌃"
                    : "⌄"}
                </span>
              </button>

              {showIdentity &&
                shop && (
                  <div
                    style={{
                      marginTop: 16,
                    }}
                  >
                    {shop.logo_url && (
                      <div
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 15,
                          overflow:
                            "hidden",
                          border:
                            "1px solid #e1e7e3",
                          marginBottom: 12,
                        }}
                      >
                        <img
                          src={
                            shop.logo_url
                          }
                          alt={
                            shop.name
                          }
                          style={{
                            width:
                              "100%",
                            height:
                              "100%",
                            objectFit:
                              "contain",
                          }}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                      }}
                    >
                      {
                        shop.name
                      }
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "grid",
                        gap: 8,
                        color:
                          "#66736d",
                        fontSize: 13,
                      }}
                    >
                      {shop.phone && (
                        <div>
                          ☎️{" "}
                          {
                            shop.phone
                          }
                        </div>
                      )}

                      {shop.whatsapp && (
                        <div>
                          💬{" "}
                          {
                            shop.whatsapp
                          }
                        </div>
                      )}

                      {shop.instagram && (
                        <div>
                          📸{" "}
                          {
                            shop.instagram
                          }
                        </div>
                      )}

                      {shop.tiktok && (
                        <div>
                          🎵{" "}
                          {
                            shop.tiktok
                          }
                        </div>
                      )}

                      {shop.snapchat && (
                        <div>
                          👻{" "}
                          {
                            shop.snapchat
                          }
                        </div>
                      )}

                      {shop.website && (
                        <div>
                          🌐{" "}
                          {
                            shop.website
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>

            <div
              className="design-card"
              style={{
                background: "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <h3
                style={{
                  margin: "0 0 14px",
                  fontSize: 17,
                }}
              >
                🛡️ قواعد التصميم
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: 11,
                  color: "#56625c",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div>✓ المنتج هو محور الإعلان</div>
                <div>✓ الحفاظ على هوية المنتج الأصلية</div>
                <div>✓ عدم اختراع معلومات عن المنتج</div>
                <div>✓ استخدام هوية المحل</div>
                <div>✓ التصميم موجه للإعلان والنشر</div>
              </div>
            </div>

            {/* آخر التصاميم */}
            <div
              className="design-card"
              style={{
                background: "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 18,
              }}
            >
              <h3
                style={{
                  margin: "0 0 14px",
                  fontSize: 17,
                }}
              >
                🗂️ آخر التصاميم
              </h3>

              {designs.length === 0 ? (
                <div
                  style={{
                    color: "#7a857f",
                    fontSize: 13,
                  }}
                >
                  لا توجد تصاميم حتى الآن.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: 14,
                  }}
                >
                  {designs
                    .slice(0, 8)
                    .map((design) => {
                      const status =
                        getDesignStatus(
                          design.status
                        );

                      const product =
                        products.find(
                          (item) =>
                            item.id ===
                            design.product_id
                        );

                      return (
                        <div
                          key={
                            design.id
                          }
                          onClick={() =>
                            openDesign(
                              design.id
                            )
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (
                              e.key ===
                                "Enter" ||
                              e.key ===
                                " "
                            ) {
                              e.preventDefault();
                              openDesign(
                                design.id
                              );
                            }
                          }}
                          style={{
                            border:
                              "1px solid #e5ebe7",
                            borderRadius: 16,
                            overflow:
                              "hidden",
                            background:
                              "#fff",
                            cursor:
                              "pointer",
                            transition:
                              "transform .15s ease, box-shadow .15s ease",
                          }}
                        >
                          {design.status ===
                            "completed" &&
                          design.image_url ? (
                            <div
                              style={{
                                width:
                                  "100%",
                                background:
                                  "#f5f7f6",
                                padding: 10,
                                boxSizing:
                                  "border-box",
                              }}
                            >
                              <img
                                src={
                                  design.image_url
                                }
                                alt={
                                  product?.name ||
                                  "التصميم"
                                }
                                style={{
                                  display:
                                    "block",
                                  width:
                                    "100%",
                                  maxHeight: 420,
                                  objectFit:
                                    "contain",
                                  borderRadius: 10,
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                minHeight:
                                  180,
                                background:
                                  "#f8faf9",
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                color:
                                  "#7a857f",
                                fontSize: 13,
                              }}
                            >
                              {design.status ===
                              "failed"
                                ? "تعذر إنشاء التصميم"
                                : "جاري تجهيز التصميم..."}
                            </div>
                          )}

                          <div
                            style={{
                              padding: 13,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 14,
                                marginBottom: 8,
                              }}
                            >
                              {product?.name ||
                                "منتج"}
                            </div>

                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                alignItems:
                                  "center",
                                gap: 8,
                                flexWrap:
                                  "wrap",
                              }}
                            >
                              <span
                                style={{
                                  color:
                                    "#66736d",
                                  fontSize: 12,
                                }}
                              >
                                مقاس{" "}
                                {design.format ||
                                  "1:1"}
                              </span>

                              <StatusBadge
                                type={
                                  status.type
                                }
                              >
                                {
                                  status.icon
                                }{" "}
                                {
                                  status.text
                                }
                              </StatusBadge>
                            </div>

                            <div
                              style={{
                                marginTop: 11,
                                color:
                                  "#15803d",
                                fontSize: 12,
                                fontWeight: 900,
                                textAlign:
                                  "center",
                                background:
                                  "#f0fdf4",
                                borderRadius: 9,
                                padding: 8,
                              }}
                            >
                              اضغط لفتح تفاصيل التصميم ←
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        button {
          font-family: Arial, sans-serif;
        }

        [role="button"] {
          -webkit-tap-highlight-color: transparent;
        }

        [role="button"]:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        @media (max-width: 900px) {
          .design-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 650px) {
          .mode-grid {
            grid-template-columns: 1fr !important;
          }

          .template-grid {
            grid-template-columns: 1fr !important;
          }

          .format-grid {
            grid-template-columns: 1fr !important;
          }

          .style-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            ) !important;
          }

          .background-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            ) !important;
          }

          .design-card {
            padding: 16px !important;
            border-radius: 17px !important;
          }
        }

        @media (max-width: 420px) {
          .style-grid,
          .background-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
