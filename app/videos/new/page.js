"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const VIDEO_TYPES = [
  {
    id: "product_ad",
    title: "إعلان منتج",
    description: "فيديو إعلاني احترافي يركز على المنتج.",
  },
  {
    id: "product_showcase",
    title: "عرض منتج",
    description: "إظهار المنتج بطريقة جذابة وواضحة.",
  },
  {
    id: "sale",
    title: "خصم وعرض",
    description: "فيديو مناسب للعروض والخصومات.",
  },
  {
    id: "social",
    title: "سوشيال ميديا",
    description: "فيديو قصير مناسب لمنصات التواصل.",
  },
];

const FORMATS = [
  {
    id: "9:16",
    title: "عمودي",
    description: "TikTok / Reels / Stories",
  },
  {
    id: "1:1",
    title: "مربع",
    description: "منشورات السوشيال",
  },
  {
    id: "16:9",
    title: "أفقي",
    description: "YouTube / شاشة",
  },
];

const DURATIONS = [
  {
    id: 10,
    title: "10 ثوانٍ",
  },
  {
    id: 15,
    title: "15 ثانية",
  },
  {
    id: 30,
    title: "30 ثانية",
  },
];

const STYLES = [
  {
    id: "modern",
    title: "حديث",
  },
  {
    id: "luxury",
    title: "فاخر",
  },
  {
    id: "clean",
    title: "نظيف",
  },
  {
    id: "dark-tech",
    title: "تقني داكن",
  },
  {
    id: "premium",
    title: "احترافي",
  },
  {
    id: "sale",
    title: "تجاري / عروض",
  },
];

const BACKGROUNDS = [
  {
    id: "black",
    title: "أسود",
  },
  {
    id: "white",
    title: "أبيض",
  },
  {
    id: "dark",
    title: "داكن",
  },
  {
    id: "light",
    title: "فاتح",
  },
  {
    id: "gradient",
    title: "متدرج",
  },
];

export default function NewVideoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);

  const [products, setProducts] = useState([]);
  const [designs, setDesigns] = useState([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedDesignId, setSelectedDesignId] = useState("");

  const [videoType, setVideoType] = useState("product_ad");
  const [format, setFormat] = useState("9:16");
  const [duration, setDuration] = useState(15);

  const [style, setStyle] = useState("modern");
  const [background, setBackground] = useState("dark");

  const [mode, setMode] = useState("professional");

  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.push("/login");
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
        setError("لا يوجد محل مرتبط بهذا الحساب.");
        return;
      }

      setShop(shopData);

      const { data: productData, error: productError } =
        await supabase
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

      const { data: designData, error: designError } =
        await supabase
          .from("ad_images")
          .select("*")
          .eq("shop_id", shopData.id)
          .eq("status", "completed")
          .order("created_at", {
            ascending: false,
          });

      if (designError) {
        throw designError;
      }

      setDesigns(designData || []);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل بيانات الفيديو."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedProduct = useMemo(() => {
    return (
      products.find(
        (product) =>
          product.id === selectedProductId
      ) || null
    );
  }, [products, selectedProductId]);

  const productDesigns = useMemo(() => {
    if (!selectedProductId) {
      return designs;
    }

    return designs.filter(
      (design) =>
        design.product_id === selectedProductId
    );
  }, [designs, selectedProductId]);

  const selectedDesign = useMemo(() => {
    return (
      designs.find(
        (design) =>
          design.id === selectedDesignId
      ) || null
    );
  }, [designs, selectedDesignId]);

  function handleProductChange(value) {
    setSelectedProductId(value);
    setSelectedDesignId("");
    setError("");
    setSuccess("");
  }

  async function createVideoRequest() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("يجب تسجيل الدخول أولاً.");
      return;
    }

    if (!shop) {
      setError("المحل غير موجود.");
      return;
    }

    if (!selectedProduct) {
      setError("اختر المنتج أولاً.");
      return;
    }

    if (
      selectedProduct.safety_status ===
        "locked" ||
      selectedProduct.safety_status ===
        "violation"
    ) {
      setError(
        "هذا المنتج مقفل ولا يمكن إنشاء فيديو له حالياً."
      );
      return;
    }

    if (
      selectedProduct.safety_status ===
        "review"
    ) {
      setError(
        "هذا المنتج يحتاج إلى مراجعة قبل إنشاء الفيديو."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        shop_id: shop.id,
        product_id: selectedProduct.id,
        design_id: selectedDesignId || null,

        title:
          `${selectedProduct.name || "منتج"} - فيديو إعلاني`,

        mode,

        video_type: videoType,

        format,

        duration_seconds: duration,

        style,

        background,

        prompt:
          description.trim() || null,

        status: "pending",
      };

      const { data, error: insertError } =
        await supabase
          .from("ad_videos")
          .insert(payload)
          .select()
          .single();

      if (insertError) {
        throw insertError;
      }

      setSuccess(
        "تم تجهيز طلب الفيديو بنجاح. الفيديو بانتظار مرحلة التوليد."
      );

      setTimeout(() => {
        if (data?.id) {
          router.push(
            `/videos/${data.id}`
          );
        } else {
          router.push("/videos");
        }
      }, 700);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر تجهيز طلب الفيديو."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: 24,
            textAlign: "center",
          }}
        >
          جاري تحميل صفحة الفيديو...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8f7",
        padding: "24px 16px 50px",
        fontFamily:
          "Arial, Tahoma, sans-serif",
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
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              🎬 إنشاء فيديو
            </h1>

            <p
              style={{
                margin:
                  "8px 0 0",
                color: "#666",
              }}
            >
              أنشئ فيديو إعلاني بالذكاء
              الاصطناعي باستخدام منتجك
              وتصميمك.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/videos")
            }
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 10,
              padding: "10px 16px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            فيديوهاتي
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border:
                "1px solid #fecaca",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              border:
                "1px solid #bbf7d0",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
            }}
          >
            {success}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) 320px",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              border:
                "1px solid #e5e7eb",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              1. اختر المنتج
            </h2>

            <select
              value={selectedProductId}
              onChange={(event) =>
                handleProductChange(
                  event.target.value
                )
              }
              style={{
                width: "100%",
                padding: 13,
                borderRadius: 10,
                border:
                  "1px solid #d1d5db",
                fontSize: 15,
                background: "#fff",
              }}
            >
              <option value="">
                اختر المنتج
              </option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.name}
                  {product.brand
                    ? ` - ${product.brand}`
                    : ""}
                </option>
              ))}
            </select>

            {selectedProduct && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 12,
                  background: "#f9fafb",
                  border:
                    "1px solid #e5e7eb",
                }}
              >
                <strong>
                  {selectedProduct.name}
                </strong>

                {selectedProduct.price !=
                  null && (
                  <div
                    style={{
                      marginTop: 5,
                      color: "#555",
                    }}
                  >
                    السعر:{" "}
                    {selectedProduct.price}{" "}
                    {selectedProduct.currency ||
                      "AED"}
                  </div>
                )}

                {selectedProduct.safety_status ===
                  "review" && (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#92400e",
                      fontWeight: 800,
                    }}
                  >
                    ⚠️ المنتج يحتاج مراجعة.
                  </div>
                )}

                {(selectedProduct.safety_status ===
                    "locked" ||
                  selectedProduct.safety_status ===
                    "violation") && (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#991b1b",
                      fontWeight: 800,
                    }}
                  >
                    🔒 هذا المنتج مقفل.
                  </div>
                )}
              </div>
            )}

            <hr
              style={{
                margin:
                  "24px 0",
                border: 0,
                borderTop:
                  "1px solid #eee",
              }}
            />

            <h2
              style={{
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              2. التصميم المستخدم
            </h2>

            <select
              value={selectedDesignId}
              onChange={(event) =>
                setSelectedDesignId(
                  event.target.value
                )
              }
              style={{
                width: "100%",
                padding: 13,
                borderRadius: 10,
                border:
                  "1px solid #d1d5db",
                fontSize: 15,
                background: "#fff",
              }}
            >
              <option value="">
                بدون تصميم سابق — أنشئ من
                صورة المنتج
              </option>

              {productDesigns.map(
                (design) => (
                  <option
                    key={design.id}
                    value={design.id}
                  >
                    {design.format ||
                      "تصميم"}{" "}
                    —{" "}
                    {design.status}
                  </option>
                )
              )}
            </select>

            {selectedDesign?.image_url && (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 12,
                  overflow: "hidden",
                  border:
                    "1px solid #e5e7eb",
                  background: "#f9fafb",
                }}
              >
                <img
                  src={
                    selectedDesign.image_url
                  }
                  alt="التصميم المختار"
                  style={{
                    width: "100%",
                    maxHeight: 320,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
            )}

            <hr
              style={{
                margin:
                  "24px 0",
                border: 0,
                borderTop:
                  "1px solid #eee",
              }}
            />

            <h2
              style={{
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              3. نوع الفيديو
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {VIDEO_TYPES.map(
                (type) => {
                  const active =
                    videoType ===
                    type.id;

                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() =>
                        setVideoType(
                          type.id
                        )
                      }
                      style={{
                        textAlign: "right",
                        padding: 14,
                        borderRadius: 12,
                        border: active
                          ? "2px solid #15803d"
                          : "1px solid #ddd",
                        background: active
                          ? "#f0fdf4"
                          : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                        }}
                      >
                        {type.title}
                      </div>

                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 13,
                          color: "#666",
                        }}
                      >
                        {type.description}
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <hr
              style={{
                margin:
                  "24px 0",
                border: 0,
                borderTop:
                  "1px solid #eee",
              }}
            />

            <h2
              style={{
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              4. طريقة الفيديو
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setMode("simple")
                }
                style={{
                  padding: 15,
                  borderRadius: 12,
                  border:
                    mode === "simple"
                      ? "2px solid #15803d"
                      : "1px solid #ddd",
                  background:
                    mode === "simple"
                      ? "#f0fdf4"
                      : "#fff",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                عادي
                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    marginTop: 5,
                  }}
                >
                  الذكاء الاصطناعي يحدد
                  المشاهد تلقائياً
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setMode(
                    "professional"
                  )
                }
                style={{
                  padding: 15,
                  borderRadius: 12,
                  border:
                    mode ===
                    "professional"
                      ? "2px solid #15803d"
                      : "1px solid #ddd",
                  background:
                    mode ===
                    "professional"
                      ? "#f0fdf4"
                      : "#fff",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                احترافي
                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    marginTop: 5,
                  }}
                >
                  تحكم أكبر في أسلوب
                  الفيديو
                </div>
              </button>
            </div>

            <hr
              style={{
                margin:
                  "24px 0",
                border: 0,
                borderTop:
                  "1px solid #eee",
              }}
            />

            <h2
              style={{
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              5. المقاس
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {FORMATS.map(
                (item) => {
                  const active =
                    format === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setFormat(
                          item.id
                        )
                      }
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: active
                          ? "2px solid #15803d"
                          : "1px solid #ddd",
                        background: active
                          ? "#f0fdf4"
                          : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                        }}
                      >
                        {item.id}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          marginTop: 4,
                        }}
                      >
                        {item.title}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: "#777",
                          marginTop: 4,
                        }}
                      >
                        {item.description}
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <hr
              style={{
                margin:
                  "24px 0",
                border: 0,
                borderTop:
                  "1px solid #eee",
              }}
            />

            <h2
              style={{
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              6. مدة الفيديو
            </h2>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {DURATIONS.map(
                (item) => {
                  const active =
                    duration ===
                    item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setDuration(
                          item.id
                        )
                      }
                      style={{
                        padding:
                          "12px 18px",
                        borderRadius: 10,
                        border: active
                          ? "2px solid #15803d"
                          : "1px solid #ddd",
                        background: active
                          ? "#f0fdf4"
                          : "#fff",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      {item.title}
                    </button>
                  );
                }
              )}
            </div>

            {mode ===
              "professional" && (
              <>
                <hr
                  style={{
                    margin:
                      "24px 0",
                    border: 0,
                    borderTop:
                      "1px solid #eee",
                  }}
                />

                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                  }}
                >
                  7. الأسلوب
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {STYLES.map(
                    (item) => {
                      const active =
                        style ===
                        item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setStyle(
                              item.id
                            )
                          }
                          style={{
                            padding: 13,
                            borderRadius: 10,
                            border: active
                              ? "2px solid #15803d"
                              : "1px solid #ddd",
                            background: active
                              ? "#f0fdf4"
                              : "#fff",
                            cursor: "pointer",
                            fontWeight: 800,
                          }}
                        >
                          {item.title}
                        </button>
                      );
                    }
                  )}
                </div>

                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    marginTop: 24,
                  }}
                >
                  8. الخلفية
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(5, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {BACKGROUNDS.map(
                    (item) => {
                      const active =
                        background ===
                        item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setBackground(
                              item.id
                            )
                          }
                          style={{
                            padding:
                              "11px 8px",
                            borderRadius: 10,
                            border: active
                              ? "2px solid #15803d"
                              : "1px solid #ddd",
                            background: active
                              ? "#f0fdf4"
                              : "#fff",
                            cursor: "pointer",
                            fontWeight: 800,
                          }}
                        >
                          {item.title}
                        </button>
                      );
                    }
                  )}
                </div>
              </>
            )}

            <hr
              style={{
                margin:
                  "24px 0",
                border: 0,
                borderTop:
                  "1px solid #eee",
              }}
            />

            <h2
              style={{
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              9. وصف إضافي
            </h2>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="مثال: أريد فيديو فاخر للسماعات مع حركة كاميرا بسيطة وإظهار المنتج بوضوح ثم عرض السعر وبيانات المحل."
              rows={5}
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding: 14,
                borderRadius: 12,
                border:
                  "1px solid #d1d5db",
                resize: "vertical",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            />

            <button
              type="button"
              onClick={
                createVideoRequest
              }
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 24,
                padding: 16,
                border: "none",
                borderRadius: 12,
                background: saving
                  ? "#86b89a"
                  : "#15803d",
                color: "#fff",
                fontSize: 17,
                fontWeight: 900,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving
                ? "جاري تجهيز الطلب..."
                : "🎬 تجهيز الفيديو"}
            </button>
          </section>

          <aside
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              border:
                "1px solid #e5e7eb",
              position: "sticky",
              top: 16,
            }}
          >
            <h2
              style={{
                marginTop: 0,
                fontSize: 19,
                fontWeight: 900,
              }}
            >
              معاينة الإعدادات
            </h2>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <InfoRow
                label="المنتج"
                value={
                  selectedProduct?.name ||
                  "لم يتم الاختيار"
                }
              />

              <InfoRow
                label="التصميم"
                value={
                  selectedDesign
                    ? "تصميم موجود"
                    : "صورة المنتج"
                }
              />

              <InfoRow
                label="نوع الفيديو"
                value={
                  VIDEO_TYPES.find(
                    (item) =>
                      item.id ===
                      videoType
                  )?.title ||
                  videoType
                }
              />

              <InfoRow
                label="الوضع"
                value={
                  mode ===
                  "professional"
                    ? "احترافي"
                    : "عادي"
                }
              />

              <InfoRow
                label="المقاس"
                value={format}
              />

              <InfoRow
                label="المدة"
                value={`${duration} ثانية`}
              />

              <InfoRow
                label="الأسلوب"
                value={
                  STYLES.find(
                    (item) =>
                      item.id ===
                      style
                  )?.title ||
                  style
                }
              />

              <InfoRow
                label="الخلفية"
                value={
                  BACKGROUNDS.find(
                    (item) =>
                      item.id ===
                      background
                  )?.title ||
                  background
                }
              />
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                background: "#f0fdf4",
                border:
                  "1px solid #bbf7d0",
                color: "#166534",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <strong>
                🤖 الذكاء الاصطناعي
              </strong>

              <div
                style={{
                  marginTop: 6,
                }}
              >
                سيستخدم معلومات المنتج
                والتصميم وبيانات المحل
                لبناء الفيديو الإعلاني.
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 12,
                background: "#f9fafb",
                border:
                  "1px solid #e5e7eb",
                color: "#555",
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              <strong>
                ملاحظة
              </strong>

              <div
                style={{
                  marginTop: 5,
                }}
              >
                تجهيز الطلب لا يبدأ توليد
                الفيديو فعلياً في هذه
                المرحلة. سيتم ربط محرك
                الفيديو بالذكاء الاصطناعي
                لاحقاً.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        gap: 10,
        paddingBottom: 9,
        borderBottom:
          "1px solid #f0f0f0",
        fontSize: 13,
      }}
    >
      <span
        style={{
          color: "#777",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          textAlign: "left",
          maxWidth: "60%",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
