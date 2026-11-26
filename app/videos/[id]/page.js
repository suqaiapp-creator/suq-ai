"use client";

import { useEffect, useRef, useState } from "react";
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

  // يمنع إرسال طلب التوليد أكثر من مرة
  const generationStartedRef = useRef(false);

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
      console.error(err);

      setError(
        err?.message ||
          "تعذر تحميل بيانات الفيديو."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startVideoPreparation() {
    if (!videoId || !video) return;

    // لا نعيد إرسال طلب التوليد إذا بدأ مسبقاً
    if (generationStartedRef.current) {
      return;
    }

    // إذا كان الفيديو أصلاً قيد التوليد فلا نرسل طلب جديد
    if (
      video.status !== "pending"
    ) {
      return;
    }

    generationStartedRef.current = true;

    try {
      setChecking(true);
      setError("");
      setMessage("جاري تجهيز الفيديو...");

      const response = await fetch(
        "/api/generate-video",
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
            "تعذر تجهيز الفيديو."
        );
      }

      // المحرك غير مفعّل
      if (
        result.engine_enabled === false
      ) {
        setVideo((current) => ({
          ...current,
          status:
            result.video?.status ||
            "pending",
        }));

        setMessage(
          "تم تجهيز الفيديو، لكن محرك التوليد غير مفعّل حالياً."
        );

        // يسمح بالمحاولة اليدوية لاحقاً
        generationStartedRef.current = false;

        return;
      }

      // التوليد بدأ بنجاح
      setVideo((current) => ({
        ...current,
        status:
          result.video?.status ||
          "processing",
        provider:
          result.video?.provider ||
          "runway",
        provider_task_id:
          result.task_id ||
          current.provider_task_id,
        generation_started_at:
          new Date().toISOString(),
      }));

      setMessage(
        "تم إرسال الفيديو إلى محرك الذكاء الاصطناعي، وجاري التوليد..."
      );
    } catch (err) {
      console.error(err);

      generationStartedRef.current = false;

      setError(
        err?.message ||
          "حدث خطأ أثناء تجهيز الفيديو."
      );

      setVideo((current) => {
        if (!current) return current;

        return {
          ...current,
          status: "failed",
          error_message:
            err?.message ||
            "حدث خطأ أثناء تجهيز الفيديو.",
        };
      });
    } finally {
      setChecking(false);
    }
  }

  async function checkVideoStatus() {
    if (!videoId || !video) return;

    if (
      video.status !== "processing"
    ) {
      return;
    }

    if (checking) {
      return;
    }

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

      // الفيديو مكتمل
      if (
        result.status === "completed" &&
        result.video_url
      ) {
        setVideo((current) => ({
          ...current,
          status: "completed",
          video_url:
            result.video_url,
          completed_at:
            new Date().toISOString(),
        }));

        setMessage(
          "🎉 تم إنشاء الفيديو بنجاح."
        );

        return;
      }

      // فشل
      if (
        result.status === "failed"
      ) {
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

      // إلغاء
      if (
        result.status === "cancelled"
      ) {
        setVideo((current) => ({
          ...current,
          status: "cancelled",
          error_message:
            result.error ||
            "تم إلغاء الفيديو.",
        }));

        return;
      }

      // ما زال قيد التوليد
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
    if (!videoId || !video || !shop) {
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا الفيديو؟"
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const {
        error: deleteError,
      } = await supabase
        .from("ad_videos")
        .delete()
        .eq("id", videoId)
        .eq("shop_id", shop.id);

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

  // تحميل الفيديو عند فتح الصفحة
  useEffect(() => {
    loadVideo();
  }, [videoId]);

  // إذا وصل الفيديو بحالة pending
  // نبدأ التوليد تلقائياً مرة واحدة
  useEffect(() => {
    if (
      !video ||
      video.status !== "pending"
    ) {
      return;
    }

    if (
      generationStartedRef.current
    ) {
      return;
    }

    startVideoPreparation();
  }, [
    video?.status,
    videoId,
  ]);

  // فحص حالة Runway أثناء التوليد
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

    // فحص أولي مباشرة
    checkVideoStatus();

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
          padding: 24,
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
              padding: 24,
              borderRadius: 16,
              background: "#f8fafc",
              textAlign: "center",
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
          padding: 24,
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
              padding: 24,
              borderRadius: 16,
              background: "#fef2f2",
              color: "#991b1b",
              fontWeight: 800,
            }}
          >
            {error}
          </div>

          <button
            onClick={() =>
              router.push("/videos")
            }
            style={{
              marginTop: 16,
              width: "100%",
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

  const statusLabels = {
    pending: "بانتظار التوليد",
    processing: "جاري التوليد",
    completed: "مكتمل",
    failed: "فشل",
    cancelled: "ملغي",
  };

  const statusLabel =
    statusLabels[video?.status] ||
    video?.status ||
    "غير معروف";

  const typeLabels = {
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
        <button
          onClick={() =>
            router.push("/videos")
          }
          style={{
            marginBottom: 16,
            border: "none",
            background: "transparent",
            color: "#166534",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          ← العودة للفيديوهات
        </button>

        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 20,
            boxShadow:
              "0 4px 20px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 25,
                }}
              >
                {video?.title ||
                  product?.name ||
                  "فيديو إعلاني"}
              </h1>

              <p
                style={{
                  marginTop: 8,
                  color: "#64748b",
                }}
              >
                فيديو إعلاني بالذكاء الاصطناعي
              </p>
            </div>

            <span
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                background:
                  video?.status === "completed"
                    ? "#dcfce7"
                    : video?.status === "failed"
                    ? "#fee2e2"
                    : video?.status === "processing"
                    ? "#dbeafe"
                    : "#fef3c7",
                color:
                  video?.status === "completed"
                    ? "#166534"
                    : video?.status === "failed"
                    ? "#991b1b"
                    : video?.status === "processing"
                    ? "#1d4ed8"
                    : "#92400e",
                fontWeight: 900,
              }}
            >
              {statusLabel}
            </span>
          </div>

          {message && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
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
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                background: "#fef2f2",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              borderRadius: 18,
              overflow: "hidden",
              background: "#0f172a",
              minHeight: 420,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {video?.video_url ? (
              <video
                src={video.video_url}
                controls
                playsInline
                style={{
                  width: "100%",
                  maxHeight: 650,
                  display: "block",
                }}
              />
            ) : product?.image_url ? (
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: 30,
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
                    borderRadius: 12,
                  }}
                />

                <div
                  style={{
                    marginTop: 20,
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 18,
                  }}
                >
                  {video?.status ===
                  "processing"
                    ? "جاري إنشاء الفيديو..."
                    : video?.status === "pending"
                    ? "جاري تجهيز الفيديو..."
                    : video?.status === "failed"
                    ? "تعذر إنشاء الفيديو"
                    : video?.status === "cancelled"
                    ? "تم إلغاء الفيديو"
                    : "لا يوجد فيديو جاهز حالياً"}
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
                  textAlign: "center",
                }}
              >
                لا توجد صورة أو فيديو متاح حالياً.
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            {video?.video_url && (
              <>
                <a
                  href={video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    minWidth: 140,
                    textAlign: "center",
                    textDecoration: "none",
                    padding: 13,
                    borderRadius: 12,
                    background: "#15803d",
                    color: "#fff",
                    fontWeight: 900,
                  }}
                >
                  ▶️ فتح الفيديو
                </a>

                <a
                  href={video.video_url}
                  download
                  style={{
                    flex: 1,
                    minWidth: 140,
                    textAlign: "center",
                    textDecoration: "none",
                    padding: 13,
                    borderRadius: 12,
                    background: "#0f172a",
                    color: "#fff",
                    fontWeight: 900,
                  }}
                >
                  ⬇️ تحميل
                </a>
              </>
            )}

            {video?.status === "pending" && (
              <button
                onClick={startVideoPreparation}
                disabled={checking}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: 13,
                  border: "none",
                  borderRadius: 12,
                  background: "#15803d",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: checking
                    ? "wait"
                    : "pointer",
                }}
              >
                {checking
                  ? "جاري التجهيز..."
                  : "🎬 تجهيز الفيديو"}
              </button>
            )}

            {video?.status === "processing" && (
              <button
                onClick={checkVideoStatus}
                disabled={checking}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: 13,
                  border: "none",
                  borderRadius: 12,
                  background: "#166534",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: checking
                    ? "wait"
                    : "pointer",
                }}
              >
                {checking
                  ? "جاري الفحص..."
                  : "🔄 تحديث الحالة"}
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(280px,1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              المنتج
            </h2>

            <div
              style={{
                color: "#475569",
                lineHeight: 1.9,
              }}
            >
              <strong>الاسم:</strong>{" "}
              {product?.name || "—"}
              <br />

              <strong>العلامة:</strong>{" "}
              {product?.brand || "—"}
              <br />

              <strong>السعر:</strong>{" "}
              {product?.price != null
                ? `${product.price} ${
                    product.currency || "AED"
                  }`
                : "—"}
              <br />

              <strong>التصنيف:</strong>{" "}
              {product?.category || "—"}
            </div>
          </section>

          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              إعدادات الفيديو
            </h2>

            <div
              style={{
                color: "#475569",
                lineHeight: 1.9,
              }}
            >
              <strong>النوع:</strong>{" "}
              {typeLabels[video?.video_type] ||
                video?.video_type ||
                "—"}
              <br />

              <strong>الوضع:</strong>{" "}
              {video?.mode === "simple"
                ? "بسيط"
                : "احترافي"}
              <br />

              <strong>المقاس:</strong>{" "}
              {video?.format || "—"}
              <br />

              <strong>المدة:</strong>{" "}
              {video?.duration_seconds || "—"}{" "}
              ثانية
              <br />

              <strong>النمط:</strong>{" "}
              {video?.style || "—"}
              <br />

              <strong>الخلفية:</strong>{" "}
              {video?.background || "—"}
            </div>
          </section>

          {design && (
            <section
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 20,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                التصميم المستخدم
              </h2>

              {design.image_url && (
                <img
                  src={design.image_url}
                  alt="التصميم"
                  style={{
                    width: "100%",
                    borderRadius: 12,
                  }}
                />
              )}

              <button
                onClick={() =>
                  router.push(
                    `/designs/${design.id}`
                  )
                }
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: 12,
                  border: "none",
                  borderRadius: 10,
                  background: "#f1f5f9",
                  color: "#0f172a",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                فتح التصميم
              </button>
            </section>
          )}
        </div>

        <section
          style={{
            marginTop: 16,
            background: "#fff",
            borderRadius: 18,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            بيانات المحل
          </h2>

          <div
            style={{
              color: "#475569",
              lineHeight: 1.9,
            }}
          >
            <strong>المحل:</strong>{" "}
            {shop?.name || "—"}
            <br />

            <strong>الهاتف:</strong>{" "}
            {shop?.phone || "—"}
            <br />

            <strong>واتساب:</strong>{" "}
            {shop?.whatsapp || "—"}
            <br />

            <strong>Instagram:</strong>{" "}
            {shop?.instagram || "—"}
            <br />

            <strong>TikTok:</strong>{" "}
            {shop?.tiktok || "—"}
          </div>
        </section>

        {video?.error_message && (
          <section
            style={{
              marginTop: 16,
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <strong>سبب الخطأ:</strong>

            <div style={{ marginTop: 8 }}>
              {video.error_message}
            </div>
          </section>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 20,
          }}
        >
          <button
            onClick={() =>
              router.push("/videos/new")
            }
            style={{
              flex: 1,
              minWidth: 180,
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
            onClick={deleteVideo}
            disabled={deleting}
            style={{
              flex: 1,
              minWidth: 180,
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
