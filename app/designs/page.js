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

      const { data: shopData, error: shopError } = await supabase
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
            product.verification_status !== "locked" &&
            product.safety_status !== "locked"
        ) || null;

      setSelectedProduct(firstAvailableProduct);

      if (firstAvailableProduct) {
        await loadDesigns(
          shopData.id,
          firstAvailableProduct.id
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
      console.warn("Designs load warning:", error);
      return;
    }

    setDesigns(data || []);
  }

  async function selectProduct(product) {
    setSelectedProduct(product);
    setMessage("");

    if (shop) {
      await loadDesigns(shop.id, product.id);
    }
  }

  function isLocked(product) {
    return (
      product?.verification_status === "locked" ||
      product?.safety_status === "locked"
    );
  }

  async function createDesign() {
    if (!selectedProduct || !shop || creating) {
      return;
    }

    if (isLocked(selectedProduct)) {
      setMessage(
        "🔒 هذا المنتج مقفول ولا يمكن إنشاء تصميم له."
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
      /*
       * لا نرسل الطلب إلى OpenAI هنا الآن.
       *
       * هذه الصفحة أصبحت جاهزة معماريًا.
       * توليد التصميم الفعلي سنربطه بعد تثبيت
       * نظام التصميم والحماية بالكامل.
       */

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
              (window.location.href = "/dashboard")
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
                <div>💬 واتساب: {shop.whatsapp}</div>
              )}

              {shop.instagram && (
                <div>📸 {shop.instagram}</div>
              )}

              {shop.website && (
                <div>🌐 {shop.website}</div>
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
                (window.location.href = "/add-product")
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
                  const locked = isLocked(product);
                  const selected =
                    selectedProduct?.id === product.id;

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
                        opacity: locked ? 0.65 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 130,
                          borderRadius: 12,
                          background: "#f5f5f5",
                          overflow: "hidden",
                          marginBottom: 10,
                        }}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
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
                    لا يمكن إنشاء تصميم له حتى تتم
                    مراجعته واعتماده.
                  </div>
                ) : (
                  <>
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
                              setFormat(item.value)
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
                                fontWeight: "bold",
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
                      disabled={creating}
                      style={{
                        ...primaryButton,
                        width: "100%",
                        marginTop: 20,
                        opacity: creating
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
                  لا توجد تصاميم لهذا المنتج حاليًا.
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
                          src={design.image_url}
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
