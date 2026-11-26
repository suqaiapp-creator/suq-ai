"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const STATUS = {
  pending: {
    title: "بانتظار التوليد",
    icon: "⏳",
    color: "#92400e",
    background: "#fef3c7",
  },
  processing: {
    title: "جاري التوليد",
    icon: "⚙️",
    color: "#1d4ed8",
    background: "#dbeafe",
  },
  completed: {
    title: "مكتمل",
    icon: "✓",
    color: "#166534",
    background: "#dcfce7",
  },
  failed: {
    title: "فشل التوليد",
    icon: "✕",
    color: "#991b1b",
    background: "#fee2e2",
  },
  cancelled: {
    title: "ملغي",
    icon: "—",
    color: "#6b7280",
    background: "#f3f4f6",
  },
};

const VIDEO_TYPES = {
  product_ad: "إعلان منتج",
  product_showcase: "عرض منتج",
  sale: "خصم وعرض",
  social: "سوشيال ميديا",
};

const MODES = {
  simple: "عادي",
  professional: "احترافي",
};

const STYLES = {
  modern: "حديث",
  luxury: "فاخر",
  clean: "نظيف",
  "dark-tech": "تقني داكن",
  premium: "احترافي",
  sale: "تجاري / عروض",
};

const BACKGROUNDS = {
  black: "أسود",
  white: "أبيض",
  dark: "داكن",
  light: "فاتح",
  gradient: "متدرج",
};

export default function VideoDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const videoId = params?.id;

  const [video, setVideo] = useState(null);
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [design, setDesign] = useState(null);

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  async function loadVideo() {
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
        throw new Error(
          "لا يوجد محل مرتبط بهذا الحساب."
        );
      }

      setShop(shopData);

      const { data: videoData, error: videoError } =
        await supabase
          .from("ad_videos")
          .select("*")
          .eq("id", videoId)
          .eq("shop_id", shopData.id)
          .maybeSingle();

      if (videoError) {
        throw videoError;
      }

      if (!videoData) {
        throw new Error(
          "الفيديو غير موجود أو لا تملك صلاحية الوصول إليه."
        );
      }

      setVideo(videoData);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("*")
          .eq("id", videoData.product_id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

      if (productError) {
        throw productError;
      }

      setProduct(productData || null);

      if (videoData.design_id) {
        const { data: designData, error: designError } =
          await supabase
            .from("ad_images")
            .select("*")
            .eq("id", videoData.design_id)
            .eq("shop_id", shopData.id)
            .maybeSingle();

        if (designError) {
          throw designError;
        }

        setDesign(designData || null);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل تفاصيل الفيديو."
      );
    } finally {
      setLoading(false);
    }
  }

  function getStatus(status) {
    return (
      STATUS[status] || {
        title: status || "غير معروف",
        icon: "•",
        color: "#374151",
        background: "#f3f4f6",
      }
    );
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "ar-AE",
        {
          dateStyle: "medium",
          timeStyle: "short",
        }
      ).format(new Date(value));
    } catch {
      return value;
    }
  }

  async function shareVideo() {
    if (!video?.video_url) {
      setError(
        "الفيديو غير متوفر للمشاركة حالياً."
      );
      return;
    }

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            video.title ||
            "فيديو إعلاني",
          text:
            "فيديو إعلاني من سوق AI",
          url: video.video_url,
        });
      } else {
        await navigator.clipboard.writeText(
          video.video_url
        );

        alert(
          "تم نسخ رابط الفيديو."
        );
      }
    } catch (err) {
      if (
        err?.name !==
        "AbortError"
      ) {
        console.error(err);
      }
    }
  }

  function openVideo() {
    if (!video?.video_url) {
      setError(
        "الفيديو لم يتم توليده بعد."
      );
      return;
    }

    window.open(
      video.video_url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function deleteVideo() {
    if (!video?.id) {
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا الفيديو؟ لا يمكن التراجع عن هذه العملية."
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const { error: deleteError } =
        await supabase
          .from("ad_videos")
          .delete()
          .eq("id", video.id)
          .eq(
            "shop_id",
            shop.id
          );

      if (deleteError) {
        throw deleteError;
      }

      router.push("/videos");
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر حذف الفيديو."
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 24,
          fontFamily:
            "Arial, Tahoma, sans-serif",
          background: "#f7f8f7",
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 16,
            padding: 40,
            textAlign: "center",
          }}
        >
          جاري تحميل تفاصيل الفيديو...
        </div>
      </main>
    );
  }

  if (error && !video) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 24,
          fontFamily:
            "Arial, Tahoma, sans-serif",
          background: "#f7f8f7",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border:
                "1px solid #fecaca",
              borderRadius: 14,
              padding: 18,
              fontWeight: 700,
            }}
          >
            {error}
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/videos")
            }
            style={{
              marginTop: 16,
              background: "#15803d",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding:
                "12px 18px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            العودة إلى فيديوهاتي
          </button>
        </div>
      </main>
    );
  }

  const status = getStatus(
    video.status
  );

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8f7",
        padding:
          "24px 16px 50px",
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
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <button
              type="button"
              onClick={() =>
                router.push("/videos")
              }
              style={{
                border: "none",
                background:
                  "transparent",
                padding: 0,
                color: "#15803d",
                fontWeight: 900,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              ← العودة إلى فيديوهاتي
            </button>

            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              {video.title ||
                product?.name ||
                "فيديو إعلاني"}
            </h1>
          </div>

          <div
            style={{
              background:
                status.background,
              color: status.color,
              borderRadius: 999,
              padding:
                "9px 14px",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            {status.icon}{" "}
            {status.title}
          </div>
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
              marginBottom: 18,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) 340px",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* VIDEO */}

          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              border:
                "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                background: "#111827",
                borderRadius: 14,
                minHeight: 500,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                overflow: "hidden",
              }}
            >
              {video.video_url ? (
                <video
                  src={video.video_url}
                  controls
                  playsInline
                  style={{
                    maxWidth: "100%",
                    maxHeight: 650,
                    display: "block",
                  }}
                />
              ) : product?.image_url ? (
                <div
                  style={{
                    width: "100%",
                    minHeight: 500,
                    display: "flex",
                    flexDirection:
                      "column",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    padding: 30,
                    boxSizing:
                      "border-box",
                  }}
                >
                  <img
                    src={
                      product.image_url
                    }
                    alt={
                      product.name ||
                      "المنتج"
                    }
                    style={{
                      maxWidth: "80%",
                      maxHeight: 330,
                      objectFit:
                        "contain",
                    }}
                  />

                  <div
                    style={{
                      color: "#fff",
                      marginTop: 22,
                      fontWeight: 900,
                      fontSize: 17,
                      textAlign: "center",
                    }}
                  >
                    {video.status ===
                    "processing"
                      ? "⚙️ جاري توليد الفيديو..."
                      : video.status ===
                        "failed"
                      ? "❌ تعذر توليد الفيديو"
                      : "⏳ الفيديو بانتظار مرحلة التوليد"}
                  </div>

                  {video.status ===
                    "pending" && (
                    <div
                      style={{
                        color: "#d1d5db",
                        marginTop: 8,
                        fontSize: 13,
                        textAlign:
                          "center",
                      }}
                    >
                      سيتم إنشاء الفيديو
                      باستخدام إعدادات
                      الإعلان المحفوظة.
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    color: "#fff",
                    textAlign: "center",
                    padding: 30,
                  }}
                >
                  <div
                    style={{
                      fontSize: 60,
                      marginBottom: 12,
                    }}
                  >
                    🎬
                  </div>

                  <strong>
                    الفيديو بانتظار
                    التوليد
                  </strong>
                </div>
              )}
            </div>

            {/* ACTIONS */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={openVideo}
                disabled={
                  !video.video_url
                }
                style={{
                  padding: 12,
                  border: "none",
                  borderRadius: 10,
                  background:
                    video.video_url
                      ? "#15803d"
                      : "#d1d5db",
                  color: "#fff",
                  fontWeight: 900,
                  cursor:
                    video.video_url
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                ▶️ فتح الفيديو
              </button>

              <a
                href={
                  video.video_url ||
                  "#"
                }
                download
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  padding: 12,
                  borderRadius: 10,
                  background:
                    video.video_url
                      ? "#f3f4f6"
                      : "#e5e7eb",
                  color:
                    video.video_url
                      ? "#111827"
                      : "#9ca3af",
                  fontWeight: 900,
                  pointerEvents:
                    video.video_url
                      ? "auto"
                      : "none",
                }}
              >
                ⬇️ تحميل
              </a>

              <button
                type="button"
                onClick={shareVideo}
                disabled={
                  !video.video_url
                }
                style={{
                  padding: 12,
                  border: "none",
                  borderRadius: 10,
                  background:
                    video.video_url
                      ? "#f3f4f6"
                      : "#e5e7eb",
                  color:
                    video.video_url
                      ? "#111827"
                      : "#9ca3af",
                  fontWeight: 900,
                  cursor:
                    video.video_url
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                📤 مشاركة
              </button>
            </div>
          </section>

          {/* DETAILS */}

          <aside
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {/* PRODUCT */}

            <section
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 18,
                border:
                  "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 14px",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                المنتج
              </h2>

              {product?.image_url && (
                <img
                  src={
                    product.image_url
                  }
                  alt={
                    product.name ||
                    "المنتج"
                  }
                  style={{
                    width: "100%",
                    height: 180,
                    objectFit:
                      "contain",
                    borderRadius: 10,
                    background:
                      "#f9fafb",
                    marginBottom: 12,
                  }}
                />
              )}

              <InfoRow
                label="الاسم"
                value={
                  product?.name ||
                  "—"
                }
              />

              <InfoRow
                label="العلامة"
                value={
                  product?.brand ||
                  "—"
                }
              />

              <InfoRow
                label="السعر"
                value={
                  product?.price !=
                  null
                    ? `${product.price} ${
                        product.currency ||
                        "AED"
                      }`
                    : "—"
                }
              />
            </section>

            {/* SETTINGS */}

            <section
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 18,
                border:
                  "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 14px",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                إعدادات الفيديو
              </h2>

              <InfoRow
                label="الحالة"
                value={status.title}
              />

              <InfoRow
                label="نوع الفيديو"
                value={
                  VIDEO_TYPES[
                    video.video_type
                  ] ||
                  video.video_type ||
                  "—"
                }
              />

              <InfoRow
                label="الوضع"
                value={
                  MODES[
                    video.mode
                  ] ||
                  video.mode ||
                  "—"
                }
              />

              <InfoRow
                label="المقاس"
                value={
                  video.format ||
                  "9:16"
                }
              />

              <InfoRow
                label="المدة"
                value={`${video.duration_seconds || 0} ثانية`}
              />

              <InfoRow
                label="الأسلوب"
                value={
                  STYLES[
                    video.style
                  ] ||
                  video.style ||
                  "—"
                }
              />

              <InfoRow
                label="الخلفية"
                value={
                  BACKGROUNDS[
                    video.background
                  ] ||
                  video.background ||
                  "—"
                }
              />

              <InfoRow
                label="تاريخ الإنشاء"
                value={formatDate(
                  video.created_at
                )}
              />

              {video.generated_at && (
                <InfoRow
                  label="تاريخ التوليد"
                  value={formatDate(
                    video.generated_at
                  )}
                />
              )}
            </section>

            {/* DESIGN */}

            <section
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 18,
                border:
                  "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 14px",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                التصميم المستخدم
              </h2>

              {design?.image_url ? (
                <img
                  src={
                    design.image_url
                  }
                  alt="التصميم المستخدم"
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit:
                      "contain",
                    borderRadius: 10,
                    background:
                      "#f9fafb",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: 20,
                    background:
                      "#f9fafb",
                    borderRadius: 10,
                    color: "#777",
                    textAlign:
                      "center",
                    fontSize: 13,
                  }}
                >
                  تم إنشاء الفيديو
                  مباشرة من بيانات
                  المنتج.
                </div>
              )}
            </section>

            {/* SHOP */}

            <section
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 18,
                border:
                  "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 14px",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                بيانات المحل
              </h2>

              <InfoRow
                label="المحل"
                value={
                  shop?.name ||
                  "—"
                }
              />

              <InfoRow
                label="الهاتف"
                value={
                  shop?.phone ||
                  "—"
                }
              />

              <InfoRow
                label="واتساب"
                value={
                  shop?.whatsapp ||
                  "—"
                }
              />

              <InfoRow
                label="الموقع"
                value={
                  shop?.website ||
                  "—"
                }
              />
            </section>

            {/* DESCRIPTION */}

            {video.prompt && (
              <section
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 18,
                  border:
                    "1px solid #e5e7eb",
                }}
              >
                <h2
                  style={{
                    margin:
                      "0 0 10px",
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  الوصف الإضافي
                </h2>

                <div
                  style={{
                    color: "#555",
                    lineHeight: 1.8,
                    fontSize: 13,
                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {video.prompt}
                </div>
              </section>
            )}

            {/* DELETE */}

            <button
              type="button"
              onClick={deleteVideo}
              disabled={deleting}
              style={{
                width: "100%",
                padding: 13,
                borderRadius: 10,
                border:
                  "1px solid #fecaca",
                background: "#fff",
                color: "#b91c1c",
                fontWeight: 900,
                cursor: deleting
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {deleting
                ? "جاري الحذف..."
                : "🗑️ حذف الفيديو"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/videos/new"
                )
              }
              style={{
                width: "100%",
                padding: 13,
                border: "none",
                borderRadius: 10,
                background: "#15803d",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              🎬 إنشاء فيديو جديد
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        gap: 12,
        padding:
          "9px 0",
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
          maxWidth: "65%",
          wordBreak:
            "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
