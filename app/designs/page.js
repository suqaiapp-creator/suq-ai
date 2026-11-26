"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

const supabase = createClient();

const formats = [
  {
    value: "1:1",
    title: "مربع",
    description: "Instagram / منشورات",
    icon: "⬛",
  },
  {
    value: "9:16",
    title: "عمودي",
    description: "Stories / Reels / TikTok",
    icon: "📱",
  },
  {
    value: "16:9",
    title: "أفقي",
    description: "YouTube / شاشات",
    icon: "🖥️",
  },
];

export default function DesignsPage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [designs, setDesigns] = useState([]);

  const [format, setFormat] = useState("1:1");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [responsibilityAccepted, setResponsibilityAccepted] =
    useState(false);

  const [acceptingResponsibility, setAcceptingResponsibility] =
    useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUser(user);

      const { data: shopData, error: shopError } =
        await supabase
          .from("shops")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();

      if (shopError) throw shopError;

      if (!shopData) {
        window.location.href = "/setup-shop";
        return;
      }

      if (shopData.status !== "active") {
        setMessageType("error");
        setMessage("حساب المحل غير نشط حاليًا.");
        return;
      }

      setShop(shopData);

      const { data: productData, error: productsError } =
        await supabase
          .from("products")
          .select("*")
          .eq("shop_id", shopData.id)
          .order("created_at", {
            ascending: false,
          });

      if (productsError) throw productsError;

      const safeProducts = productData || [];

      setProducts(safeProducts);

      const firstAvailableProduct =
        safeProducts.find(
          (product) => !isLocked(product)
        ) || null;

      setSelectedProduct(firstAvailableProduct);

      if (firstAvailableProduct) {
        await loadDesigns(
          shopData.id,
          firstAvailableProduct.id
        );

        await checkResponsibilityAcceptance(
          user.id,
          shopData.id,
          firstAvailableProduct
        );
      }
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        error?.message ||
          "حدث خطأ أثناء تحميل صفحة التصاميم."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDesigns(shopId, productId) {
    const { data, error } = await supabase
      .from("ad_images")
      .select("*")
      .eq("shop_id", shopId)
      .eq("product_id", productId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.warn(
        "Designs load warning:",
        error
      );
      return;
    }

    setDesigns(data || []);
  }

  async function checkResponsibilityAcceptance(
    userId,
    shopId,
    product
  ) {
    setResponsibilityAccepted(false);

    if (!product || isLocked(product)) {
      return;
    }

    if (!isProductUnclear(product)) {
      setResponsibilityAccepted(true);
      return;
    }

    const { data, error } = await supabase
      .from("product_responsibility_acceptances")
      .select("id")
      .eq("user_id", userId)
      .eq("shop_id", shopId)
      .eq("product_id", product.id)
      .maybeSingle();

    if (error) {
      console.warn(
        "Responsibility check warning:",
        error
      );
      return;
    }

    setResponsibilityAccepted(Boolean(data));
  }

  async function selectProduct(product) {
    setSelectedProduct(product);
    setMessage("");

    if (!shop || !user) return;

    await loadDesigns(
      shop.id,
      product.id
    );

    await checkResponsibilityAcceptance(
      user.id,
      shop.id,
      product
    );
  }

  function isLocked(product) {
    return (
      product?.verification_status === "locked" ||
      product?.safety_status === "locked"
    );
  }

  function isProductUnclear(product) {
    if (!product) return false;

    if (isLocked(product)) {
      return false;
    }

    if (
      product.safety_status === "violation" ||
      product.safety_level === "critical"
    ) {
      return false;
    }

    const verification =
      String(
        product.verification_status || ""
      )
        .trim()
        .toLowerCase();

    const confidence =
      String(product.confidence || "")
        .trim()
        .toLowerCase();

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

  function getProductStatus(product) {
    if (isLocked(product)) {
      return {
        label: "مقفل",
        icon: "🔒",
        background: "#fff1f1",
        color: "#9b2226",
        border: "#f1c0c0",
      };
    }

    if (isProductUnclear(product)) {
      return {
        label: "يحتاج تأكيد",
        icon: "🟡",
        background: "#fff8e1",
        color: "#8a6500",
        border: "#f0d98a",
      };
    }

    return {
      label: "جاهز",
      icon: "🟢",
      background: "#eef7ee",
      color: "#256029",
      border: "#cce8cc",
    };
  }

  async function acceptResponsibility() {
    if (
      !user ||
      !shop ||
      !selectedProduct ||
      acceptingResponsibility
    ) {
      return;
    }

    if (isLocked(selectedProduct)) {
      setMessageType("error");
      setMessage(
        "🔒 هذا المنتج مقفول ولا يمكن استخدامه."
      );
      return;
    }

    if (!isProductUnclear(selectedProduct)) {
      setResponsibilityAccepted(true);
      return;
    }

    setAcceptingResponsibility(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from(
          "product_responsibility_acceptances"
        )
        .upsert(
          {
            user_id: user.id,
            shop_id: shop.id,
            product_id: selectedProduct.id,
            policy_version: "1.0",
          },
          {
            onConflict: "user_id,product_id",
          }
        );

      if (error) throw error;

      setResponsibilityAccepted(true);

      setMessageType("success");
      setMessage(
        "✅ تم تأكيد مسؤولية التاجر. يمكنك الآن إنشاء التصميم."
      );
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        error?.message ||
          "تعذر حفظ تأكيد المسؤولية."
      );
    } finally {
      setAcceptingResponsibility(false);
    }
  }

  async function createDesign() {
    if (
      !selectedProduct ||
      !shop ||
      !user ||
      creating
    ) {
      return;
    }

    if (isLocked(selectedProduct)) {
      setMessageType("error");
      setMessage(
        "🔒 هذا المنتج مقفول ولا يمكن إنشاء تصميم له."
      );
      return;
    }

    if (
      isProductUnclear(selectedProduct) &&
      !responsibilityAccepted
    ) {
      setMessageType("error");
      setMessage(
        "⚠️ يجب تأكيد مسؤولية التاجر عن هذا المنتج قبل إنشاء التصميم."
      );
      return;
    }

    if (!selectedProduct.image_url) {
      setMessageType("error");
      setMessage(
        "📷 أضف صورة للمنتج أولًا قبل إنشاء التصميم."
      );
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("ad_images")
        .insert({
          product_id: selectedProduct.id,
          shop_id: shop.id,
          image_url: null,
          format,
          prompt: buildDesignPrompt(
            shop,
            selectedProduct,
            format
          ),
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      setDesigns((current) => [
        data,
        ...current,
      ]);

      setMessageType("success");
      setMessage(
        "🎨 تم إنشاء طلب التصميم ووضعه في قائمة الانتظار."
      );
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        error?.message ||
          "حدث خطأ أثناء إنشاء طلب التصميم."
      );
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
          جاري تحميل استوديو التصاميم...
        </div>
      </main>
    );
  }

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
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
              }}
            >
              🎨 استوديو التصاميم
            </h1>

            <p
              style={{
                marginTop: 8,
                color: "#666",
              }}
            >
              أنشئ تصاميم إعلانية لمنتجاتك باستخدام
              هوية محلك.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              (window.location.href =
                "/dashboard")
            }
            style={secondaryButton}
          >
            ← لوحة التحكم
          </button>
        </div>

        {shop && (
          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              marginBottom: 18,
              boxShadow:
                "0 5px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#777",
                marginBottom: 6,
              }}
            >
              هوية المحل
            </div>

            <strong
              style={{
                fontSize: 20,
              }}
            >
              {shop.name}
            </strong>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {shop.phone && (
                <IdentityBadge>
                  📞 {shop.phone}
                </IdentityBadge>
              )}

              {shop.whatsapp && (
                <IdentityBadge>
                  💬 {shop.whatsapp}
                </IdentityBadge>
              )}

              {shop.instagram && (
                <IdentityBadge>
                  📸 {shop.instagram}
                </IdentityBadge>
              )}

              {shop.tiktok && (
                <IdentityBadge>
                  🎵 {shop.tiktok}
                </IdentityBadge>
              )}

              {shop.snapchat && (
                <IdentityBadge>
                  👻 {shop.snapchat}
                </IdentityBadge>
              )}

              {shop.website && (
                <IdentityBadge>
                  🌐 {shop.website}
                </IdentityBadge>
              )}
            </div>
          </section>
        )}

        {message && (
          <div
            style={{
              background:
                messageType === "error"
                  ? "#fff1f1"
                  : "#eef7ee",
              color:
                messageType === "error"
                  ? "#9b2226"
                  : "#256029",
              border:
                messageType === "error"
                  ? "1px solid #f1c0c0"
                  : "1px solid #cce8cc",
              borderRadius: 14,
              padding: 15,
              marginBottom: 18,
              lineHeight: 1.7,
            }}
          >
            {message}
          </div>
        )}

        {products.length === 0 ? (
          <section
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 35,
              textAlign: "center",
              boxShadow:
                "0 5px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontSize: 45 }}>
              📦
            </div>

            <h2>
              لا توجد منتجات
            </h2>

            <p
              style={{
                color: "#666",
                lineHeight: 1.8,
              }}
            >
              أضف منتجًا أولًا حتى تتمكن من إنشاء
              تصميم إعلاني.
            </p>

            <button
              type="button"
              onClick={() =>
                (window.location.href =
                  "/add-product")
              }
              style={primaryButton}
            >
              + إضافة منتج
            </button>
          </section>
        ) : (
          <>
            <section
              style={{
                background: "#fff",
                borderRadius: 20,
                padding: 20,
                marginBottom: 20,
                boxShadow:
                  "0 5px 20px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: 5,
                    }}
                  >
                    1. اختر المنتج
                  </h2>

                  <div
                    style={{
                      color: "#777",
                      fontSize: 13,
                    }}
                  >
                    اختر المنتج الذي تريد تصميم إعلان
                    له.
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#777",
                  }}
                >
                  {products.length} منتج
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                {products.map((product) => {
                  const locked =
                    isLocked(product);

                  const selected =
                    selectedProduct?.id ===
                    product.id;

                  const status =
                    getProductStatus(product);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        selectProduct(product)
                      }
                      style={{
                        textAlign: "right",
                        border: selected
                          ? "2px solid #111"
                          : "1px solid #ddd",
                        background: "#fff",
                        borderRadius: 16,
                        padding: 12,
                        cursor: "pointer",
                        opacity: locked
                          ? 0.7
                          : 1,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 130,
                          borderRadius: 12,
                          background:
                            "#f5f5f5",
                          overflow: "hidden",
                          marginBottom: 10,
                        }}
                      >
                        {product.image_url ? (
                          <img
                            src={
                              product.image_url
                            }
                            alt={product.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit:
                                "contain",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: "100%",
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              color: "#999",
                            }}
                          >
                            📷 لا توجد صورة
                          </div>
                        )}
                      </div>

                      <strong
                        style={{
                          display: "block",
                          marginBottom: 7,
                        }}
                      >
                        {product.name}
                      </strong>

                      <span
                        style={{
                          display: "inline-block",
                          background:
                            status.background,
                          color: status.color,
                          border: `1px solid ${status.border}`,
                          padding:
                            "5px 9px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        {status.icon}{" "}
                        {status.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedProduct && (
              <>
                <section
                  style={{
                    background: "#fff",
                    borderRadius: 20,
                    padding: 20,
                    marginBottom: 20,
                    boxShadow:
                      "0 5px 20px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          marginTop: 0,
                          marginBottom: 5,
                        }}
                      >
                        2. إعداد التصميم
                      </h2>

                      <div
                        style={{
                          color: "#777",
                          fontSize: 13,
                        }}
                      >
                        المنتج المحدد:{" "}
                        <strong>
                          {selectedProduct.name}
                        </strong>
                      </div>
                    </div>

                    <StatusBadge
                      product={selectedProduct}
                    />
                  </div>

                  {isLocked(selectedProduct) ? (
                    <div
                      style={{
                        marginTop: 20,
                        background: "#fff1f1",
                        border:
                          "1px solid #f1c0c0",
                        borderRadius: 16,
                        padding: 18,
                        lineHeight: 1.8,
                      }}
                    >
                      <strong>
                        🔒 المنتج مقفول
                      </strong>

                      <p>
                        لا يمكن إنشاء تصميم لهذا
                        المنتج حتى تتم مراجعته
                        واعتماده.
                      </p>

                      {selectedProduct.safety_reason && (
                        <div
                          style={{
                            background: "#fff",
                            borderRadius: 10,
                            padding: 12,
                            color: "#8a2222",
                          }}
                        >
                          السبب:{" "}
                          {
                            selectedProduct.safety_reason
                          }
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {isProductUnclear(
                        selectedProduct
                      ) &&
                        !responsibilityAccepted && (
                          <div
                            style={{
                              marginTop: 20,
                              background:
                                "#fff8e1",
                              border:
                                "1px solid #f0d98a",
                              borderRadius: 16,
                              padding: 18,
                              lineHeight: 1.9,
                            }}
                          >
                            <div
                              style={{
                                fontWeight:
                                  "bold",
                                fontSize: 17,
                                marginBottom: 8,
                              }}
                            >
                              ⚠️ معلومات المنتج
                              غير مكتملة أو غير
                              واضحة
                            </div>

                            <div
                              style={{
                                color: "#555",
                              }}
                            >
                              عدم وضوح المعلومات لا
                              يعني أن المنتج مخالف.
                              يمكنك الاستمرار بعد
                              تأكيد مسؤوليتك عن
                              صحة المعلومات ومشروعية
                              بيع المنتج وتسويقه.
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
                                marginTop: 15,
                                opacity:
                                  acceptingResponsibility
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {acceptingResponsibility
                                ? "جاري الحفظ..."
                                : "☑️ أوافق وأكمل"}
                            </button>
                          </div>
                        )}

                      {isProductUnclear(
                        selectedProduct
                      ) &&
                        responsibilityAccepted && (
                          <div
                            style={{
                              marginTop: 20,
                              background:
                                "#eaf7ee",
                              border:
                                "1px solid #b7dfc2",
                              borderRadius: 14,
                              padding: 14,
                              lineHeight: 1.7,
                              color: "#256029",
                            }}
                          >
                            ✅ تم تأكيد مسؤولية
                            التاجر عن هذا المنتج.
                            يمكنك الآن إنشاء
                            التصميم.
                          </div>
                        )}

                      <h3
                        style={{
                          marginTop: 25,
                        }}
                      >
                        مقاس التصميم
                      </h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 12,
                        }}
                      >
                        {formats.map((item) => {
                          const selected =
                            format ===
                            item.value;

                          return (
                            <button
                              key={
                                item.value
                              }
                              type="button"
                              onClick={() =>
                                setFormat(
                                  item.value
                                )
                              }
                              style={{
                                border: selected
                                  ? "2px solid #111"
                                  : "1px solid #ddd",
                                background:
                                  selected
                                    ? "#f5f5f5"
                                    : "#fff",
                                borderRadius: 15,
                                padding: 16,
                                cursor:
                                  "pointer",
                                textAlign:
                                  "right",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 24,
                                  marginBottom: 8,
                                }}
                              >
                                {item.icon}
                              </div>

                              <strong>
                                {item.title}
                              </strong>

                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 13,
                                  color:
                                    "#777",
                                }}
                              >
                                {
                                  item.description
                                }
                              </div>

                              <div
                                style={{
                                  marginTop: 8,
                                  fontWeight:
                                    "bold",
                                }}
                              >
                                {item.value}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          marginTop: 20,
                          padding: 16,
                          background:
                            "#f8f9fb",
                          borderRadius: 14,
                          lineHeight: 1.9,
                        }}
                      >
                        <strong>
                          🏪 هوية التصميم
                        </strong>

                        <div>
                          اسم المحل:{" "}
                          {shop?.name || "—"}
                        </div>

                        <div>
                          رقم التواصل:{" "}
                          {shop?.phone ||
                            shop?.whatsapp ||
                            "—"}
                        </div>

                        <div>
                          Instagram:{" "}
                          {shop?.instagram ||
                            "—"}
                        </div>

                        <div>
                          TikTok:{" "}
                          {shop?.tiktok || "—"}
                        </div>

                        <div>
                          Snapchat:{" "}
                          {shop?.snapchat ||
                            "—"}
                        </div>

                        <div>
                          الموقع:{" "}
                          {shop?.website || "—"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={createDesign}
                        disabled={
                          creating ||
                          (isProductUnclear(
                            selectedProduct
                          ) &&
                            !responsibilityAccepted)
                        }
                        style={{
                          ...primaryButton,
                          width: "100%",
                          marginTop: 20,
                          opacity:
                            creating ||
                            (isProductUnclear(
                              selectedProduct
                            ) &&
                              !responsibilityAccepted)
                              ? 0.6
                              : 1,
                        }}
                      >
                        {creating
                          ? "جاري إنشاء الطلب..."
                          : "🎨 إنشاء التصميم"}
                      </button>
                    </>
                  )}
                </section>

                <section
                  style={{
                    background: "#fff",
                    borderRadius: 20,
                    padding: 20,
                    boxShadow:
                      "0 5px 20px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          marginTop: 0,
                          marginBottom: 5,
                        }}
                      >
                        3. تصاميم المنتج
                      </h2>

                      <div
                        style={{
                          color: "#777",
                          fontSize: 13,
                        }}
                      >
                        الطلبات والتصاميم السابقة
                        لهذا المنتج.
                      </div>
                    </div>

                    <span
                      style={{
                        background: "#f5f5f5",
                        padding: "7px 11px",
                        borderRadius: 20,
                        fontSize: 13,
                      }}
                    >
                      {designs.length} طلب
                    </span>
                  </div>

                  {designs.length === 0 ? (
                    <div
                      style={{
                        color: "#777",
                        padding: 30,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 35,
                        }}
                      >
                        🎨
                      </div>

                      لا توجد تصاميم لهذا المنتج
                      حاليًا.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: 16,
                        marginTop: 18,
                      }}
                    >
                      {designs.map(
                        (design) => (
                          <div
                            key={design.id}
                            style={{
                              border:
                                "1px solid #eee",
                              borderRadius: 16,
                              overflow:
                                "hidden",
                              background:
                                "#fff",
                            }}
                          >
                            {design.image_url ? (
                              <img
                                src={
                                  design.image_url
                                }
                                alt="تصميم إعلاني"
                                style={{
                                  width: "100%",
                                  display:
                                    "block",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  height: 180,
                                  background:
                                    "#f5f5f5",
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "center",
                                  flexDirection:
                                    "column",
                                  gap: 8,
                                  color:
                                    "#777",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 30,
                                  }}
                                >
                                  ⏳
                                </span>

                                قيد المعالجة
                              </div>
                            )}

                            <div
                              style={{
                                padding: 12,
                              }}
                            >
                              <strong>
                                {design.format ||
                                  "1:1"}
                              </strong>

                              <div
                                style={{
                                  marginTop: 6,
                                  color:
                                    "#777",
                                  fontSize: 13,
                                }}
                              >
                                الحالة:{" "}
                                {getDesignStatus(
                                  design.status
                                )}
                              </div>

                              <div
                                style={{
                                  marginTop: 5,
                                  color:
                                    "#999",
                                  fontSize: 12,
                                }}
                              >
                                {design.created_at
                                  ? new Date(
                                      design.created_at
                                    ).toLocaleString(
                                      "ar-AE"
                                    )
                                  : ""}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function getDesignStatus(status) {
  switch (status) {
    case "completed":
      return "✅ مكتمل";

    case "processing":
      return "🔄 جاري التنفيذ";

    case "failed":
      return "❌ فشل";

    case "pending":
    default:
      return "⏳ قيد الانتظار";
  }
}

function StatusBadge({ product }) {
  const status = getProductStatus(product);

  return (
    <span
      style={{
        display: "inline-block",
        background: status.background,
        color: status.color,
        border: `1px solid ${status.border}`,
        padding: "8px 13px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: "bold",
      }}
    >
      {status.icon} {status.label}
    </span>
  );
}

function getProductStatus(product) {
  if (
    product?.verification_status === "locked" ||
    product?.safety_status === "locked"
  ) {
    return {
      label: "مقفل",
      icon: "🔒",
      background: "#fff1f1",
      color: "#9b2226",
      border: "#f1c0c0",
    };
  }

  if (
    product?.safety_status === "violation" ||
    product?.safety_level === "critical"
  ) {
    return {
      label: "مراجعة مطلوبة",
      icon: "🔴",
      background: "#fff1f1",
      color: "#9b2226",
      border: "#f1c0c0",
    };
  }

  if (isProductUnclear(product)) {
    return {
      label: "يحتاج تأكيد",
      icon: "🟡",
      background: "#fff8e1",
      color: "#8a6500",
      border: "#f0d98a",
    };
  }

  return {
    label: "جاهز",
    icon: "🟢",
    background: "#eef7ee",
    color: "#256029",
    border: "#cce8cc",
  };
}

function isProductUnclear(product) {
  if (!product) return false;

  if (
    product.verification_status === "locked" ||
    product.safety_status === "locked"
  ) {
    return false;
  }

  if (
    product.safety_status === "violation" ||
    product.safety_level === "critical"
  ) {
    return false;
  }

  const verification =
    String(
      product.verification_status || ""
    )
      .trim()
      .toLowerCase();

  const confidence =
    String(product.confidence || "")
      .trim()
      .toLowerCase();

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

  return (
    hasName &&
    !hasBrand &&
    !hasCategory &&
    !hasDescription
  );
}

function buildDesignPrompt(
  shop,
  product,
  format
) {
  return JSON.stringify({
    type: "product_ad_design",

    format,

    shop: {
      name: shop?.name || "",
      phone: shop?.phone || "",
      whatsapp: shop?.whatsapp || "",
      instagram: shop?.instagram || "",
      tiktok: shop?.tiktok || "",
      snapchat: shop?.snapchat || "",
      website: shop?.website || "",
      logo_url: shop?.logo_url || "",
    },

    product: {
      name: product?.name || "",
      brand: product?.brand || "",
      category: product?.category || "",
      price: product?.price ?? null,
      currency: product?.currency || "AED",
      image_url: product?.image_url || "",
      description:
        product?.description || "",
      features:
        product?.features || "",
    },

    rules: {
      preserve_original_product_image: true,
      do_not_change_product_identity: true,
      do_not_invent_product_information: true,
      use_shop_identity: true,
    },
  });
}

function IdentityBadge({ children }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#f8f9fb",
        border: "1px solid #eee",
        borderRadius: 20,
        padding: "7px 10px",
        fontSize: 13,
        color: "#555",
      }}
    >
      {children}
    </span>
  );
}

const primaryButton = {
  border: "none",
  background: "#111",
  color: "#fff",
  padding: "14px 18px",
  borderRadius: 13,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #ddd",
  background: "#fff",
  color: "#111",
  padding: "11px 15px",
  borderRadius: 12,
  fontSize: 14,
  cursor: "pointer",
};
