"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function VideoDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const videoId = params?.id;

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [video, setVideo] = useState(null);
  const [product, setProduct] = useState(null);
  const [design, setDesign] = useState(null);
  const [shop, setShop] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadVideo() {
    if (!videoId) return;

    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

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

      if (shopError) throw shopError;

      if (!shopData) {
        throw new Error("المحل غير موجود.");
      }

      setShop(shopData);

      const { data: videoData, error: videoError } =
        await supabase
          .from("ad_videos")
          .select("*")
          .eq("id", videoId)
          .eq("shop_id", shopData.id)
          .maybeSingle();

      if (videoError) throw videoError;

      if (!videoData) {
        throw new Error("الفيديو غير موجود.");
      }

      setVideo(videoData);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("*")
          .eq("id", videoData.product_id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

      if (productError) throw productError;

      setProduct(productData || null);

      if (videoData.design_id) {
        const { data: designData, error: designError } =
          await supabase
            .from("ad_images")
            .select("*")
            .eq("id", videoData.design_id)
            .eq("shop_id", shopData.id)
            .maybeSingle();

        if (designError) throw designError;

        setDesign(designData || null);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر تحميل بيانات الفيديو."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkVideoStatus() {
    if (!videoId || !video) return;

    if (video.status !== "processing") return;

    try {
      setChecking(true);

      const response = await fetch(
        "/api/video-status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video_id: videoId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "تعذر فحص حالة الفيديو."
        );
      }

      if (
        result.status === "completed" &&
        result.video_url
      ) {
        setVideo((current) => ({
          ...current,
          status: "completed",
          video_url: result.video_url,
        }));

        setMessage(
          "تم إنشاء الفيديو بنجاح."
        );

        return;
      }

      if (result.status === "failed") {
        setVideo((current) => ({
          ...current,
          status: "failed",
          error_message:
            result.error ||
            "فشل إنشاء الفيديو.",
        }));

        return;
      }

      setVideo((current) => ({
        ...current,
        status:
          result.status ||
          current.status,
      }));
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر فحص حالة الفيديو."
      );
    } finally {
      setChecking(false);
    }
  }

  async function deleteVideo() {
    if (!videoId || !video || !shop) return;

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا الفيديو؟"
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const { error: deleteError } =
        await supabase
          .from("ad_videos")
          .delete()
          .eq("id", videoId)
          .eq("shop_id", shop.id);

      if (deleteError) throw deleteError;

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

  async function shareVideo() {
    if (!video?.video_url) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            video.title ||
            product?.name ||
            "فيديو إعلاني",
          text:
            "شاهد الفيديو الإعلاني",
          url: video.video_url,
        });
      } else {
        await navigator.clipboard.writeText(
          video.video_url
        );

        setMessage(
          "تم نسخ رابط الفيديو."
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadVideo();
  }, [videoId]);

  useEffect(() => {
    if (
      !video ||
      video.status !== "processing"
    ) {
      return;
    }

    const interval = setInterval(() => {
      checkVideoStatus();
    }, 8000);

    return () => {
      clearInterval(interval);
    };
  }, [
    video?.status,
    videoId,
  ]);

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 20,
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
              background: "#fff",
              borderRadius: 20,
              padding: 40,
              textAlign: "center",
              fontWeight: 900,
              color: "#166534",
            }}
          >
            جاري تحميل الفيديو...
          </div>
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
          background: "#f8fafc",
          padding: 20,
          fontFamily: "Arial, sans-serif",
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
              background: "#fff",
              borderRadius: 20,
              padding: 25,
              color: "#991b1b",
              fontWeight: 900,
            }}
          >
            {error}
          </div>

          <button
            onClick={() =>
              router.push("/videos")
            }
            style={{
              width: "100%",
              marginTop: 15,
              padding: 14,
              border: "none",
              borderRadius: 12,
              background: "#15803d",
              color: "#fff",
              fontWeight: 900,
            }}
          >
            العودة للفيديوهات
          </button>
        </div>
      </main>
    );
  }

  const statusMap = {
    pending: {
      text: "بانتظار التوليد",
      bg: "#fef3c7",
      color: "#92400e",
    },
    processing: {
      text: "جاري التوليد",
      bg: "#dbeafe",
      color: "#1d4ed8",
    },
    completed: {
      text: "مكتمل",
      bg: "#dcfce7",
      color: "#166534",
    },
    failed: {
      text: "فشل",
      bg: "#fee2e2",
      color: "#991b1b",
    },
    cancelled: {
      text: "ملغي",
      bg: "#e2e8f0",
      color: "#475569",
    },
  };

  const status =
    statusMap[video?.status] ||
    statusMap.pending;

  const typeMap = {
    product_ad: "إعلان منتج",
    product_showcase: "عرض منتج",
    sale: "عرض وخصم",
    social: "سوشيال ميديا",
  };

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* Header */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() =>
              router.push("/videos")
            }
            style={{
              border: "none",
              background: "#fff",
              padding: "11px 16px",
              borderRadius: 12,
              color: "#166534",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow:
                "0 2px 10px rgba(0,0,0,.05)",
            }}
          >
            ← الفيديوهات
          </button>

          <div
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              background: status.bg,
              color: status.color,
              fontWeight: 900,
            }}
          >
            {status.text}
          </div>
        </div>

        {/* Main Video */}

        <section
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 16,
            boxShadow:
              "0 5px 25px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              marginBottom: 16,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 25,
                color: "#0f172a",
              }}
            >
              {video?.title ||
                product?.name ||
                "فيديو إعلاني"}
            </h1>

            <div
              style={{
                marginTop: 7,
                color: "#64748b",
              }}
            >
              فيديو إعلاني بالذكاء الاصطناعي
            </div>
          </div>

          {/* Video */}

          <div
            style={{
              width: "100%",
              background: "#0f172a",
              borderRadius: 20,
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 420,
            }}
          >
            {video?.video_url ? (
              <video
                src={video.video_url}
                controls
                playsInline
                preload="metadata"
                style={{
                  width: "100%",
                  maxHeight: 700,
                  display: "block",
                }}
              />
            ) : product?.image_url ? (
              <div
                style={{
                  width: "100%",
                  padding: 30,
                  textAlign: "center",
                }}
              >
                <img
                  src={product.image_url}
                  alt={
                    product.name ||
                    "المنتج"
                  }
                  style={{
                    maxWidth: "100%",
                    maxHeight: 500,
                    objectFit: "contain",
                    borderRadius: 14,
                  }}
                />

                <div
                  style={{
                    marginTop: 20,
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  {video?.status ===
                  "processing"
                    ? "جاري إنشاء الفيديو..."
                    : video?.status ===
                      "pending"
                    ? "الفيديو بانتظار التوليد"
                    : "لا يوجد فيديو جاهز"}
                </div>

                {video?.status ===
                  "processing" && (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#cbd5e1",
                    }}
                  >
                    يتم تحديث الحالة تلقائياً.
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  color: "#fff",
                  padding: 30,
                }}
              >
                لا يوجد فيديو متاح.
              </div>
            )}
          </div>

          {/* Actions */}

          {video?.video_url && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(150px,1fr))",
                gap: 10,
                marginTop: 14,
              }}
            >
              <a
                href={video.video_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textAlign: "center",
                  padding: 13,
                  borderRadius: 12,
                  background: "#15803d",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 900,
                }}
              >
                ▶️ فتح الفيديو
              </a>

              <a
                href={video.video_url}
                download
                style={{
                  textAlign: "center",
                  padding: 13,
                  borderRadius: 12,
                  background: "#0f172a",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 900,
                }}
              >
                ⬇️ تحميل
              </a>

              <button
                onClick={shareVideo}
                style={{
                  padding: 13,
                  border: "none",
                  borderRadius: 12,
                  background: "#f1f5f9",
                  color: "#0f172a",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                📤 مشاركة
              </button>
            </div>
          )}

          {message && (
            <div
              style={{
                marginTop: 14,
                padding: 13,
                borderRadius: 12,
                background: "#ecfdf5",
                color: "#166534",
                fontWeight: 800,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: 13,
                borderRadius: 12,
                background: "#fef2f2",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {error}
            </div>
          )}

          {video?.status === "processing" && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 12,
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              🔵 جاري إنشاء الفيديو...
              <br />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                يتم فحص حالة التوليد تلقائياً.
              </span>
            </div>
          )}
        </section>

        {/* Product + Video Info */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(280px,1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          {/* Product */}

          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2
              style={{
                marginTop: 0,
                color: "#0f172a",
              }}
            >
              المنتج
            </h2>

            <InfoRow
              label="الاسم"
              value={product?.name}
            />

            <InfoRow
              label="العلامة"
              value={product?.brand}
            />

            <InfoRow
              label="السعر"
              value={
                product?.price != null
                  ? `${product.price} ${
                      product.currency ||
                      "AED"
                    }`
                  : null
              }
            />

            <InfoRow
              label="التصنيف"
              value={product?.category}
            />
          </section>

          {/* Video Settings */}

          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2
              style={{
                marginTop: 0,
                color: "#0f172a",
              }}
            >
              إعدادات الفيديو
            </h2>

            <InfoRow
              label="النوع"
              value={
                typeMap[
                  video?.video_type
                ] ||
                video?.video_type
              }
            />

            <InfoRow
              label="الوضع"
              value={
                video?.mode === "simple"
                  ? "بسيط"
                  : "احترافي"
              }
            />

            <InfoRow
              label="المقاس"
              value={video?.format}
            />

            <InfoRow
              label="المدة"
              value={
                video?.duration_seconds
                  ? `${video.duration_seconds} ثانية`
                  : null
              }
            />

            <InfoRow
              label="النمط"
              value={video?.style}
            />

            <InfoRow
              label="الخلفية"
              value={video?.background}
            />
          </section>

          {/* Shop */}

          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2
              style={{
                marginTop: 0,
                color: "#0f172a",
              }}
            >
              المحل
            </h2>

            <InfoRow
              label="اسم المحل"
              value={shop?.name}
            />

            <InfoRow
              label="الهاتف"
              value={shop?.phone}
            />

            <InfoRow
              label="واتساب"
              value={shop?.whatsapp}
            />

            <InfoRow
              label="Instagram"
              value={shop?.instagram}
            />

            <InfoRow
              label="TikTok"
              value={shop?.tiktok}
            />
          </section>
        </div>

        {/* Design */}

        {design && (
          <section
            style={{
              marginTop: 16,
              background: "#fff",
              borderRadius: 18,
              padding: 20,
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
              <h2
                style={{
                  margin: 0,
                }}
              >
                التصميم المستخدم
              </h2>

              <button
                onClick={() =>
                  router.push(
                    `/designs/${design.id}`
                  )
                }
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "#f1f5f9",
                  color: "#0f172a",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                فتح التصميم
              </button>
            </div>

            {design.image_url && (
              <img
                src={design.image_url}
                alt="التصميم"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 500,
                  objectFit: "contain",
                  marginTop: 16,
                  borderRadius: 14,
                  background: "#f8fafc",
                }}
              />
            )}
          </section>
        )}

        {/* Error */}

        {video?.error_message && (
          <section
            style={{
              marginTop: 16,
              background: "#fff",
              borderRadius: 18,
              padding: 20,
              border:
                "1px solid #fecaca",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                color: "#991b1b",
              }}
            >
              سبب الخطأ
            </h2>

            <div
              style={{
                color: "#991b1b",
                lineHeight: 1.8,
              }}
            >
              {video.error_message}
            </div>
          </section>
        )}

        {/* Bottom Actions */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 10,
            marginTop: 20,
            paddingBottom: 30,
          }}
        >
          <button
            onClick={() =>
              router.push("/videos/new")
            }
            style={{
              padding: 14,
              border: "none",
              borderRadius: 12,
              background: "#15803d",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            🎬 إنشاء فيديو جديد
          </button>

          <button
            onClick={() =>
              router.push("/videos")
            }
            style={{
              padding: 14,
              border: "none",
              borderRadius: 12,
              background: "#e2e8f0",
              color: "#0f172a",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            العودة للفيديوهات
          </button>

          <button
            onClick={deleteVideo}
            disabled={deleting}
            style={{
              padding: 14,
              border: "none",
              borderRadius: 12,
              background: "#fee2e2",
              color: "#991b1b",
              fontWeight: 900,
              cursor: deleting
                ? "wait"
                : "pointer",
            }}
          >
            {deleting
              ? "جاري الحذف..."
              : "🗑️ حذف الفيديو"}
          </button>
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
        justifyContent: "space-between",
        gap: 15,
        padding: "10px 0",
        borderBottom:
          "1px solid #f1f5f9",
        lineHeight: 1.6,
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontWeight: 700,
        }}
      >
        {label}
      </span>

      <span
        style={{
          color: "#0f172a",
          fontWeight: 800,
          textAlign: "left",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}
