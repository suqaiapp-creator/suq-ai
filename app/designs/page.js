"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

const supabase = createClient();

const formats = [
  {
    value: "1:1",
    title: "مربع",
    description: "Instagram / منشورات",
  },
  {
    value: "9:16",
    title: "عمودي",
    description: "Stories / Reels / TikTok",
  },
  {
    value: "16:9",
    title: "أفقي",
    description: "YouTube / شاشات",
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

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        window.location.href = "/setup-shop";
        return;
      }

      if (shopData.status !== "active") {
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

      if (productsError) {
        throw productsError;
      }

      setProducts(productData || []);

      const firstAvailableProduct =
        (productData || []).find(
          (product) =>
            !isLocked(product)
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

    setResponsibilityAccepted(!!data);
  }

  async function selectProduct(product) {
    setSelectedProduct(product);
    setMessage("");

    if (isLocked(product)) {
      setResponsibilityAccepted(false);

      if (shop) {
        await loadDesigns(
          shop.id,
          product.id
        );
      }

      return;
    }

    if (shop) {
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
  }

  function isLocked(product) {
    return (
      product?.verification_status === "locked" ||
      product?.safety_status === "locked"
    );
  }

  function isProductUnclear(product) {
    if (!product) {
      return true;
    }

    if (
      product.verification_status === "review" ||
      product.verification_status === "unverified"
    ) {
      return true;
    }

    if (
      product.confidence === "low" ||
      product.confidence === "منخفض" ||
      product.confidence === "medium" ||
      product.confidence === "متوسط"
    ) {
      return true;
    }

    if (
      product.name &&
      (!product.brand ||
        !product.category ||
        !product.description)
    ) {
      return true;
    }

    return false;
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
        .insert({
          user_id: user.id,
          shop_id: shop.id,
          product_id: selectedProduct.id,
          policy_version: "1.0",
        });

      if (error) {
        /*
         * إذا كانت الموافقة موجودة مسبقًا،
         * نعتبرها مقبولة.
         */
        if (
          error.code === "23505"
        ) {
          setResponsibilityAccepted(true);

          setMessage(
            "✅ سبق تأكيد مسؤولية هذا المنتج."
          );

          return;
        }

        throw error;
      }

      setResponsibilityAccepted(true);

      setMessage(
        "✅ تم تأكيد مسؤولية التاجر. يمكنك الآن إنشاء التصميم."
      );
    } catch (error) {
      console.error(error);

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
      creating
    ) {
      return;
    }

    if (isLocked(selectedProduct)) {
      setMessage(
        "🔒 هذا المنتج مقفول ولا يمكن إنشاء تصميم له."
      );
      return;
    }

    if (
      isProductUnclear(selectedProduct) &&
      !responsibilityAccepted
    ) {
      setMessage(
        "⚠️ يجب تأكيد مسؤولية التاجر عن هذا المنتج قبل إنشاء التصميم."
      );
      return;
    }

    if (!selectedProduct.image_url) {
      setMessage(
        "أضف صورة للمنتج أولًا قبل إنشاء التصميم."
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

      if (error) {
        throw error;
      }

      setDesigns((current) => [
        data,
        ...current,
      ]);

      setMessage(
        "تم إنشاء طلب التصميم ووضعه في قائمة الانتظار."
      );
    } catch (error) {
      console.error(error);

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
          padding: 30,
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        جاري تحميل التصاميم...
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
              تصاميم منتجاتك باستخدام هوية محلك.
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
          <div
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
              هوية المحل المستخدمة في التصاميم
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
                marginTop: 8,
                color: "#666",
                lineHeight: 1.8,
              }}
            >
              {shop.phone && (
                <div>📞 {shop.phone}</div>
              )}

              {shop.whatsapp && (
                <div>
                  💬 واتساب: {shop.whatsapp}
                </div>
              )}

              {shop.instagram && (
                <div>
                  📸 {shop.instagram}
                </div>
              )}

              {shop.website && (
                <div>
                  🌐 {shop.website}
                </div>
              )}
            </div>
          </div>
        )}

        {message && (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 15,
              marginBottom: 18,
              border: "1px solid #eee",
              lineHeight: 1.7,
            }}
          >
            {message}
          </div>
        )}

        {products.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 30,
              textAlign: "center",
            }}
          >
            <h2>لا توجد منتجات</h2>

            <p style={{ color: "#666" }}>
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
          </div>
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
              <h2 style={{ marginTop: 0 }}>
                1. اختر المنتج
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 14,
                }}
              >
                {products.map((product) => {
                  const locked =
                    isLocked(product);

                  const selected =
                    selectedProduct?.id ===
                    product.id;

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
                        background: locked
                          ? "#fafafa"
                          : "#fff",
                        borderRadius: 16,
                        padding: 12,
                        cursor: "pointer",
                        opacity: locked
                          ? 0.65
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
                            لا توجد صورة
                          </div>
                        )}
                      </div>

                      <strong>
                        {product.name}
                      </strong>

                      {locked && (
                        <div
                          style={{
                            marginTop: 6,
                            color: "#a66b00",
                            fontSize: 13,
                          }}
                        >
                          🔒 مقفول
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedProduct && (
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
                <h2 style={{ marginTop: 0 }}>
                  2. اختر مقاس التصميم
                </h2>

                {isLocked(selectedProduct) ? (
                  <div
                    style={{
                      background: "#fff3cd",
                      border:
                        "1px solid #ffe08a",
                      borderRadius: 14,
                      padding: 16,
                      lineHeight: 1.8,
                    }}
                  >
                    🔒 المنتج مقفول.
                    <br />
                    لا يمكن إنشاء تصميم له حتى
                    تتم مراجعته واعتماده.
                  </div>
                ) : (
                  <>
                    {isProductUnclear(
                      selectedProduct
                    ) &&
                      !responsibilityAccepted && (
                        <div
                          style={{
                            background:
                              "#fff8e1",
                            border:
                              "1px solid #f0d98a",
                            borderRadius: 16,
                            padding: 18,
                            marginBottom: 20,
                            lineHeight: 1.9,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
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
                            الذكاء الاصطناعي لم يتمكن
                            من التحقق من جميع معلومات
                            المنتج بشكل كافٍ.
                            <br />
                            يمكنك الاستمرار، لكن
                            التاجر مسؤول عن صحة
                            المعلومات ومشروعية بيع
                            المنتج.
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
                            background:
                              "#eaf7ee",
                            border:
                              "1px solid #b7dfc2",
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: 20,
                            lineHeight: 1.7,
                          }}
                        >
                          ✅ تم تأكيد مسؤولية
                          التاجر عن هذا المنتج.
                          <br />
                          يمكنك الآن إنشاء التصميم.
                        </div>
                      )}

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
                          format === item.value;

                        return (
                          <button
                            key={item.value}
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
                              background: selected
                                ? "#f5f5f5"
                                : "#fff",
                              borderRadius: 15,
                              padding: 16,
                              cursor: "pointer",
                              textAlign: "right",
                            }}
                          >
                            <strong>
                              {item.title}
                            </strong>

                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 13,
                                color: "#777",
                              }}
                            >
                              {item.description}
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
                        background: "#f8f9fb",
                        borderRadius: 14,
                        lineHeight: 1.8,
                      }}
                    >
                      <strong>
                        هوية التصميم
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
                        الموقع:{" "}
                        {shop?.website || "—"}
                      </div>

                      <div>
                        حساب Instagram:{" "}
                        {shop?.instagram || "—"}
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          color: "#666",
                        }}
                      >
                        سيتم استخدام هذه البيانات
                        تلقائيًا عند تنفيذ نظام
                        التصميم النهائي.
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
            )}

            <section
              style={{
                background: "#fff",
                borderRadius: 20,
                padding: 20,
                boxShadow:
                  "0 5px 20px rgba(0,0,0,0.05)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                3. تصاميم المنتج
              </h2>

              {designs.length === 0 ? (
                <div
                  style={{
                    color: "#777",
                    padding: 20,
                    textAlign: "center",
                  }}
                >
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
                  }}
                >
                  {designs.map((design) => (
                    <div
                      key={design.id}
                      style={{
                        border:
                          "1px solid #eee",
                        borderRadius: 16,
                        overflow: "hidden",
                        background: "#fff",
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
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            height: 180,
                            background:
                              "#f5f5f5",
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            color: "#777",
                          }}
                        >
                          ⏳ قيد المعالجة
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
                            marginTop: 5,
                            color: "#777",
                            fontSize: 13,
                          }}
                        >
                          الحالة:{" "}
                          {design.status ||
                            "pending"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function buildDesignPrompt(
  shop,
  product,
  format
) {
  return JSON.stringify({
    shop: {
      name: shop?.name || "",
      phone: shop?.phone || "",
      whatsapp: shop?.whatsapp || "",
      instagram: shop?.instagram || "",
      tiktok: shop?.tiktok || "",
      snapchat: shop?.snapchat || "",
      website: shop?.website || "",
    },

    product: {
      name: product?.name || "",
      brand: product?.brand || "",
      category: product?.category || "",
      price: product?.price ?? null,
      currency: product?.currency || "AED",
      image_url: product?.image_url || "",
    },

    format,
  });
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
