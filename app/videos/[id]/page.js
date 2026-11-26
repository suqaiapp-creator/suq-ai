"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const STATUS = {
  pending: {
    title: "بانتظار التوليد",
    color: "#92400e",
    background: "#fef3c7",
    icon: "⏳",
  },

  processing: {
    title: "جاري التوليد",
    color: "#1d4ed8",
    background: "#dbeafe",
    icon: "⚙️",
  },

  completed: {
    title: "مكتمل",
    color: "#166534",
    background: "#dcfce7",
    icon: "✓",
  },

  failed: {
    title: "فشل",
    color: "#991b1b",
    background: "#fee2e2",
    icon: "✕",
  },

  cancelled: {
    title: "ملغي",
    color: "#6b7280",
    background: "#f3f4f6",
    icon: "—",
  },
};

const VIDEO_TYPES = {
  product_ad: "إعلان منتج",
  product_showcase: "عرض منتج",
  sale: "عرض وخصم",
  social: "سوشيال ميديا",
};

const MODES = {
  simple: "عادي",
  professional: "احترافي",
};

export default function VideoDetailsPage() {
  const params = useParams();
  const router = useRouter();

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

  const checkingRef = useRef(false);
  const generationStartedRef = useRef(false);

  // =========================================
  // تحميل الفيديو
  // =========================================

  async function loadVideo() {
    if (!videoId) return;

    try {
      setLoading(true);
      setError("");

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

      // ---------------------------------------
      // المحل
      // ---------------------------------------

      const {
        data: shopData,
        error: shopError,
      } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        throw new Error("المحل غير موجود.");
      }

      setShop(shopData);

      // ---------------------------------------
      // الفيديو
      // ---------------------------------------

      const {
        data: videoData,
        error: videoError,
      } = await supabase
        .from("ad_videos")
        .select("*")
        .eq("id", videoId)
        .eq("shop_id", shopData.id)
        .maybeSingle();

      if (videoError) {
        throw videoError;
      }

      if (!videoData) {
        throw new Error("الفيديو غير موجود.");
      }

      setVideo(videoData);

      // ---------------------------------------
      // المنتج
      // ---------------------------------------

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("*")
        .eq("id", videoData.product_id)
        .eq("shop_id", shopData.id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      setProduct(productData || null);

      // ---------------------------------------
      // التصميم
      // ---------------------------------------

      if (videoData.design_id) {
        const {
          data: designData,
          error: designError,
        } = await supabase
          .from("ad_images")
          .select("*")
          .eq("id", videoData.design_id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

        if (designError) {
          throw designError;
        }

        setDesign(designData || null);
      } else {
        setDesign(null);
      }
    } catch (err) {
      console.error("VIDEO DETAILS ERROR:", err);

      setError(
        err?.message ||
          "تعذر تحميل بيانات الفيديو."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // تشغيل التوليد تلقائياً عند pending
  // =========================================

  async function startGenerationIfNeeded(currentVideo) {
    if (!currentVideo) return;

    if (currentVideo.status !== "pending") {
      return;
    }

    if (generationStartedRef.current) {
      return;
    }

    generationStartedRef.current = true;

    try {
      setMessage("جاري بدء إنشاء الفيديو...");

      const response = await fetch(
        "/api/generate-video",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video_id: currentVideo.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "تعذر بدء إنشاء الفيديو."
        );
      }

      if (
        result.status === "processing" ||
        result.status === "pending"
      ) {
        setVideo((current) => ({
          ...current,
          status:
            result.status || "processing",
          provider:
            result.provider ||
            current?.provider,
          provider_task_id:
            result.provider_task_id ||
            current?.provider_task_id,
        }));

        setMessage(
          "تم بدء إنشاء الفيديو بنجاح."
        );
      }
    } catch (err) {
      console.error(
        "START VIDEO GENERATION ERROR:",
        err
      );

      setError(
        err?.message ||
          "تعذر بدء إنشاء الفيديو."
      );

      generationStartedRef.current = false;
    }
  }

  // =========================================
  // فحص حالة الفيديو
  // =========================================

  async function checkVideoStatus() {
    if (!videoId || !video) return;

    if (
      video.status !== "processing" &&
      video.status !== "pending"
    ) {
      return;
    }

    if (checkingRef.current) {
      return;
    }

    checkingRef.current = true;

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
          completed_at:
            result.completed_at ||
            current?.completed_at,
          generated_at:
            result.generated_at ||
            current?.generated_at,
        }));

        setMessage(
          "🎉 تم إنشاء الفيديو بنجاح."
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

        setError(
          result.error ||
            "فشل إنشاء الفيديو."
        );

        return;
      }

      if (result.status === "cancelled") {
        setVideo((current) => ({
          ...current,
          status: "cancelled",
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
      console.error(
        "CHECK VIDEO STATUS ERROR:",
        err
      );

      setError(
        err?.message ||
          "تعذر فحص حالة الفيديو."
      );
    } finally {
      setChecking(false);
      checkingRef.current = false;
    }
  }

  // =========================================
  // الحذف
  // =========================================

  async function deleteVideo() {
    if (!videoId || !video || !shop) {
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا الفيديو؟"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");

      const { error: deleteError } =
        await supabase
          .from("ad_videos")
          .delete()
          .eq("id", videoId)
          .eq("shop_id", shop.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/videos");
    } catch (err) {
      console.error(
        "DELETE VIDEO ERROR:",
        err
      );

      setError(
        err?.message ||
          "تعذر حذف الفيديو."
      );
    } finally {
      setDeleting(false);
    }
  }

  // =========================================
  // مشاركة الفيديو
  // =========================================

  async function shareVideo() {
    if (!video?.video_url) {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            video.title ||
            product?.name ||
            "فيديو إعلاني",
          text: "شاهد الفيديو الإعلاني",
          url: video.video_url,
        });

        return;
      }

      await navigator.clipboard.writeText(
        video.video_url
      );

      setMessage(
        "تم نسخ رابط الفيديو."
      );
    } catch (err) {
      console.error(
        "SHARE VIDEO ERROR:",
        err
      );
    }
  }

  // =========================================
  // فتح التصميم
  // =========================================

  function openDesign() {
    if (!design?.id) {
      return;
    }

    router.push(
      `/designs/${design.id}`
    );
  }

  // =========================================
  // التاريخ
  // =========================================

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

  // =========================================
  // التحميل
  // =========================================

  useEffect(() => {
    loadVideo();
  }, [videoId]);

  // =========================================
  // بدء التوليد تلقائياً
  // =========================================

  useEffect(() => {
    if (!video) {
      return;
    }

    if (video.status === "pending") {
      startGenerationIfNeeded(video);
    }
  }, [video?.id, video?.status]);

  // =========================================
  // Polling
  // =========================================

  useEffect(() => {
    if (!video) {
      return;
    }

    if (
      video.status !== "processing" &&
      video.status !== "pending"
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

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f8f7",
          padding: 20,
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
              background: "#fff",
              borderRadius: 20,
              padding: 45,
              textAlign: "center",
              fontWeight: 900,
              color: "#166534",
              border:
                "1px solid #e5e7eb",
            }}
          >
            جاري تحميل الفيديو...
          </div>
        </div>
      </main>
    );
  }

  // =========================================
  // ERROR WITHOUT VIDEO
  // =========================================

  if (error && !video) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f8f7",
          padding: 20,
          fontFamily:
            "Arial, Tahoma, sans-serif",
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
              border:
                "1px solid #fecaca",
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
              width: "100%",
              marginTop: 15,
              padding: 14,
              border: "none",
              borderRadius: 12,
              background: "#15803d",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            العودة للفيديوهات
          </button>
        </div>
      </main>
    );
  }

  const status =
    STATUS[video?.status] ||
    STATUS.pending;

  const videoType =
    VIDEO_TYPES[video?.video_type] ||
    video?.video_type ||
    "فيديو";

  const mode =
    MODES[video?.mode] ||
    video?.mode ||
    "احترافي";

  const isProcessing =
    video?.status === "processing";

  const isPending =
    video?.status === "pending";

  const isCompleted =
    video?.status === "completed";

  const isFailed =
    video?.status === "failed";

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8f7",
        padding: "20px 16px 50px",
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
        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push("/videos")
            }
            style={{
              border: "1px solid #bbf7d0",
              background: "#fff",
              padding: "11px 16px",
              borderRadius: 12,
              color: "#166534",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ← الفيديوهات
          </button>

          <div
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              background:
                status.background,
              color: status.color,
              fontWeight: 900,
            }}
          >
            {status.icon}{" "}
            {status.title}
          </div>
        </div>

        {/* ================================= */}
        {/* MAIN VIDEO CARD */}
        {/* ================================= */}

        <section
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 16,
            border:
              "1px solid #e5e7eb",
            boxShadow:
              "0 5px 25px rgba(0,0,0,.05)",
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
                fontWeight: 900,
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

          {/* VIDEO PLAYER */}

          <div
            style={{
              width: "100%",
              background: "#0f172a",
              borderRadius: 20,
              overflow: "hidden",
              display: "flex",
              justifyContent:
                "center",
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
                  {isProcessing
                    ? "جاري إنشاء الفيديو..."
                    : isPending
                    ? "الفيديو بانتظار التوليد"
                    : isFailed
                    ? "تعذر إنشاء الفيديو"
                    : "لا يوجد فيديو جاهز"}
                </div>

                {(isProcessing ||
                  isPending) && (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#cbd5e1",
                    }}
                  >
                    يتم تحديث الحالة
                    تلقائياً.
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  color: "#fff",
                  padding: 30,
                  textAlign: "center",
                }}
              >
                لا يوجد فيديو متاح.
              </div>
            )}
          </div>

          {/* ACTIONS */}

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
                  textDecoration:
                    "none",
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
                  textDecoration:
                    "none",
                  fontWeight: 900,
                }}
              >
                ⬇️ تحميل
              </a>

              <button
                type="button"
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

          {/* PROCESSING */}

          {(isProcessing ||
            isPending) && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 12,
                background:
                  isPending
                    ? "#fffbeb"
                    : "#eff6ff",
                color:
                  isPending
                    ? "#92400e"
                    : "#1d4ed8",
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              {isPending
                ? "⏳ تجهيز طلب الفيديو..."
                : "🔵 جاري إنشاء الفيديو..."}
              <br />

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                يتم تحديث الحالة تلقائياً.
              </span>
            </div>
          )}

          {/* SUCCESS */}

          {isCompleted &&
            video?.video_url && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 12,
                  background: "#ecfdf5",
                  color: "#166534",
                  fontWeight: 900,
                  textAlign: "center",
                }}
              >
                ✓ تم إنشاء الفيديو وحفظه
                بنجاح.
              </div>
            )}

          {/* MESSAGE */}

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

          {/* ERROR */}

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
        </section>

        {/* ================================= */}
        {/* INFORMATION CARDS */}
        {/* ================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(280px,1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          {/* PRODUCT */}

          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
              border:
                "1px solid #e5e7eb",
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

            {product?.image_url && (
              <img
                src={product.image_url}
                alt={
                  product.name ||
                  "المنتج"
                }
                style={{
                  width: "100%",
                  height: 180,
                  objectFit: "contain",
                  borderRadius: 12,
                  background:
                    "#f8fafc",
                  marginBottom: 12,
                }}
              />
            )}

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

            <InfoRow
              label="الحالة"
              value={
                product?.safety_status ||
                null
              }
            />
          </section>

          {/* VIDEO SETTINGS */}

          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
              border:
                "1px solid #e5e7eb",
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
              value={videoType}
            />

            <InfoRow
              label="الوضع"
              value={mode}
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

            <InfoRow
              label="المحرك"
              value={
                video?.provider
                  ? video.provider
                  : null
              }
            />

            <InfoRow
              label="تاريخ الإنشاء"
              value={formatDate(
                video?.created_at
              )}
            />

            <InfoRow
              label="اكتمال التوليد"
              value={formatDate(
                video?.completed_at
              )}
            />
          </section>

          {/* SHOP */}

          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
              border:
                "1px solid #e5e7eb",
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

            <InfoRow
              label="الموقع"
              value={shop?.website}
            />
          </section>
        </div>

        {/* ================================= */}
        {/* DESIGN */}
        {/* ================================= */}

        {design && (
          <section
            style={{
              marginTop: 16,
              background: "#fff",
              borderRadius: 18,
              padding: 20,
              border:
                "1px solid #e5e7eb",
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
                    margin: 0,
                  }}
                >
                  التصميم المستخدم
                </h2>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  التصميم المرتبط بهذا
                  الفيديو.
                </p>
              </div>

              <button
                type="button"
                onClick={openDesign}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background:
                    "#f1f5f9",
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
                  background:
                    "#f8fafc",
                }}
              />
            )}
          </section>
        )}

        {/* ================================= */}
        {/* ERROR DETAILS */}
        {/* ================================= */}

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
              تفاصيل الخطأ
            </h2>

            <div
              style={{
                color: "#991b1b",
                lineHeight: 1.8,
              }}
            >
              {video.error_message}
            </div>

            {video.error_code && (
              <div
                style={{
                  marginTop: 10,
                  color: "#7f1d1d",
                  fontSize: 13,
                }}
              >
                رمز الخطأ:{" "}
                <strong>
                  {video.error_code}
                </strong>
              </div>
            )}
          </section>
        )}

        {/* ================================= */}
        {/* BOTTOM ACTIONS */}
        {/* ================================= */}

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
            type="button"
            onClick={() =>
              router.push(
                `/videos/new${
                  product?.id
                    ? `?product=${product.id}`
                    : ""
                }`
              )
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
            🎬 فيديو جديد للمنتج
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/videos"
              )
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

          {isProcessing && (
            <button
              type="button"
              onClick={checkVideoStatus}
              disabled={checking}
              style={{
                padding: 14,
                border: "none",
                borderRadius: 12,
                background: "#dbeafe",
                color: "#1d4ed8",
                fontWeight: 900,
                cursor: checking
                  ? "wait"
                  : "pointer",
              }}
            >
              {checking
                ? "جاري الفحص..."
                : "↻ فحص الحالة الآن"}
            </button>
          )}

          <button
            type="button"
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
        justifyContent:
          "space-between",
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
          maxWidth: "65%",
          wordBreak:
            "break-word",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}
