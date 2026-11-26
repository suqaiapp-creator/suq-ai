"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function VideoDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const videoId = params?.id;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [video, setVideo] = useState(null);
  const [product, setProduct] = useState(null);
  const [design, setDesign] = useState(null);
  const [shop, setShop] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  async function loadVideo() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
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

      if (videoError) {
        throw videoError;
      }

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
      } else {
        setDesign(null);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل الفيديو."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startGeneration() {
    if (!video?.id) return;

    try {
      setGenerating(true);
      setMessage("");
      setError("");

      if (
        product?.safety_status === "locked" ||
        product?.safety_status === "violation"
      ) {
        setError(
          "هذا المنتج مقفل ولا يمكن إنشاء فيديو له."
        );
        return;
      }

      if (
        product?.safety_status === "review"
      ) {
        setError(
          "هذا المنتج يحتاج إلى مراجعة قبل إنشاء الفيديو."
        );
        return;
      }

      const response = await fetch(
        "/api/generate-video",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            video_id: video.id,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error ||
            "تعذر تجهيز الفيديو."
        );
      }

      setVideo((current) => ({
        ...current,
        status:
          result?.video?.status ||
          "processing",
        generation_started_at:
          new Date().toISOString(),
      }));

      setMessage(
        "تم تجهيز الفيديو بنجاح. وهو الآن بانتظار محرك التوليد."
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تجهيز الفيديو."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function deleteVideo() {
    if (!video?.id) return;

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
          .eq("id", video.id)
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

  async function shareVideo() {
    if (!video?.video_url) return;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            video.title ||
            product?.name ||
            "فيديو إعلاني",
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

  function statusText(status) {
    switch (status) {
      case "pending":
        return "بانتظار الإنشاء";

      case "processing":
        return "جارٍ المعالجة";

      case "completed":
        return "مكتمل";

      case "failed":
        return "فشل الإنشاء";

      case "cancelled":
        return "ملغي";

      default:
        return status || "غير محدد";
    }
  }

  function statusColor(status) {
    switch (status) {
      case "completed":
        return "#15803d";

      case "processing":
        return "#b45309";

      case "failed":
        return "#b91c1c";

      case "cancelled":
        return "#6b7280";

      default:
        return "#475569";
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            textAlign: "center",
            padding: 60,
          }}
        >
          جاري تحميل الفيديو...
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
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "60px auto",
            background: "#fff",
            borderRadius: 20,
            padding: 30,
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              fontSize: 40,
              marginBottom: 15,
            }}
          >
            ⚠️
          </div>

          <h2>
            تعذر تحميل الفيديو
          </h2>

          <p
            style={{
              color: "#b91c1c",
            }}
          >
            {error}
          </p>

          <Link
            href="/videos"
            style={{
              display: "inline-block",
              marginTop: 15,
              background: "#15803d",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            العودة للفيديوهات
          </Link>
        </div>
      </main>
    );
  }

  const canGenerate =
    video &&
    product &&
    video.status !== "processing" &&
    video.status !== "completed" &&
    product.safety_status !== "locked" &&
    product.safety_status !== "violation" &&
    product.safety_status !== "review";

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 20,
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
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Link
              href="/videos"
              style={{
                color: "#15803d",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              ← الفيديوهات
            </Link>

            <h1
              style={{
                margin:
                  "10px 0 5px",
                fontSize: 28,
              }}
            >
              {video?.title ||
                product?.name ||
                "فيديو إعلاني"}
            </h1>

            <div
              style={{
                color: "#64748b",
              }}
            >
              إنشاء فيديو إعلاني بالذكاء الاصطناعي
            </div>
          </div>

          <div
            style={{
              background:
                statusColor(video?.status),
              color: "#fff",
              padding:
                "9px 15px",
              borderRadius: 999,
              fontWeight: 900,
            }}
          >
            {statusText(
              video?.status
            )}
          </div>
        </div>

        {/* Messages */}

        {message && (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              border:
                "1px solid #86efac",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border:
                "1px solid #fca5a5",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {/* Main */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
            gap: 20,
          }}
        >
          {/* Preview */}

          <section
            style={{
              background: "#fff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 20,
              padding: 20,
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              🎬 معاينة الفيديو
            </h2>

            <div
              style={{
                background: "#111827",
                borderRadius: 16,
                minHeight: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {video?.video_url ? (
                <video
                  src={video.video_url}
                  controls
                  playsInline
                  style={{
                    maxWidth: "100%",
                    maxHeight: 650,
                    width: "100%",
                    objectFit:
                      "contain",
                  }}
                />
              ) : product?.image_url ? (
                <div
                  style={{
                    width: "100%",
                    textAlign: "center",
                  }}
                >
                  <img
                    src={
                      product.image_url
                    }
                    alt={
                      product.name
                    }
                    style={{
                      maxWidth:
                        "90%",
                      maxHeight: 450,
                      objectFit:
                        "contain",
                      borderRadius: 12,
                    }}
                  />

                  <div
                    style={{
                      color: "#fff",
                      padding: 20,
                      fontWeight: 700,
                    }}
                  >
                    {video?.status ===
                    "processing"
                      ? "🎬 جارٍ تجهيز الفيديو..."
                      : "الفيديو لم يتم توليده بعد"}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    color: "#fff",
                    padding: 40,
                  }}
                >
                  لا توجد معاينة حالياً
                </div>
              )}
            </div>

            {/* Actions */}

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              {canGenerate && (
                <button
                  onClick={
                    startGeneration
                  }
                  disabled={
                    generating
                  }
                  style={{
                    flex: 1,
                    minWidth: 180,
                    background:
                      "#15803d",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding:
                      "14px 18px",
                    fontWeight: 900,
                    cursor:
                      generating
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      generating
                        ? 0.7
                        : 1,
                  }}
                >
                  {generating
                    ? "جاري التجهيز..."
                    : "🎬 بدء إنشاء الفيديو"}
                </button>
              )}

              {video?.video_url && (
                <>
                  <a
                    href={
                      video.video_url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      minWidth: 130,
                      textAlign:
                        "center",
                      background:
                        "#0f172a",
                      color: "#fff",
                      borderRadius: 12,
                      padding:
                        "14px 18px",
                      textDecoration:
                        "none",
                      fontWeight: 800,
                    }}
                  >
                    👁️ فتح
                  </a>

                  <a
                    href={
                      video.video_url
                    }
                    download
                    style={{
                      flex: 1,
                      minWidth: 130,
                      textAlign:
                        "center",
                      background:
                        "#e2e8f0",
                      color: "#0f172a",
                      borderRadius: 12,
                      padding:
                        "14px 18px",
                      textDecoration:
                        "none",
                      fontWeight: 800,
                    }}
                  >
                    تحميل
                  </a>

                  <button
                    onClick={
                      shareVideo
                    }
                    style={{
                      flex: 1,
                      minWidth: 130,
                      background:
                        "#e2e8f0",
                      color: "#0f172a",
                      border: "none",
                      borderRadius: 12,
                      padding:
                        "14px 18px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    مشاركة
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Settings */}

          <aside
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: 16,
            }}
          >
            <section
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 20,
                padding: 20,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                ⚙️ إعدادات الفيديو
              </h2>

              <InfoRow
                label="النوع"
                value={
                  video?.video_type
                }
              />

              <InfoRow
                label="النمط"
                value={
                  video?.mode
                }
              />

              <InfoRow
                label="المقاس"
                value={
                  video?.format
                }
              />

              <InfoRow
                label="المدة"
                value={`${video?.duration_seconds || 0} ثانية`}
              />

              <InfoRow
                label="الأسلوب"
                value={
                  video?.style ||
                  "تلقائي"
                }
              />

              <InfoRow
                label="الخلفية"
                value={
                  video?.background ||
                  "تلقائي"
                }
              />
            </section>

            {/* Product */}

            <section
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 20,
                padding: 20,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                📦 المنتج
              </h2>

              {product?.image_url && (
                <img
                  src={
                    product.image_url
                  }
                  alt={
                    product.name
                  }
                  style={{
                    width: "100%",
                    height: 180,
                    objectFit:
                      "contain",
                    background:
                      "#f8fafc",
                    borderRadius: 12,
                    marginBottom: 12,
                  }}
                />
              )}

              <strong>
                {product?.name ||
                  "غير محدد"}
              </strong>

              {product?.brand && (
                <div
                  style={{
                    marginTop: 6,
                    color: "#64748b",
                  }}
                >
                  {product.brand}
                </div>
              )}

              {product?.price != null && (
                <div
                  style={{
                    marginTop: 10,
                    fontWeight: 900,
                  }}
                >
                  {product.price}{" "}
                  {product.currency ||
                    "AED"}
                </div>
              )}
            </section>

            {/* Design */}

            {design && (
              <section
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 20,
                  padding: 20,
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                  }}
                >
                  🎨 التصميم المستخدم
                </h2>

                {design.image_url && (
                  <img
                    src={
                      design.image_url
                    }
                    alt="التصميم"
                    style={{
                      width: "100%",
                      borderRadius: 12,
                    }}
                  />
                )}

                <Link
                  href={`/designs/${design.id}`}
                  style={{
                    display:
                      "block",
                    marginTop: 12,
                    textAlign:
                      "center",
                    background:
                      "#f1f5f9",
                    color:
                      "#0f172a",
                    padding:
                      "11px",
                    borderRadius: 10,
                    textDecoration:
                      "none",
                    fontWeight: 800,
                  }}
                >
                  عرض التصميم
                </Link>
              </section>
            )}

            {/* Shop */}

            {shop && (
              <section
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 20,
                  padding: 20,
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                  }}
                >
                  🏪 بيانات المحل
                </h2>

                <InfoRow
                  label="المحل"
                  value={
                    shop.name
                  }
                />

                {shop.phone && (
                  <InfoRow
                    label="الهاتف"
                    value={
                      shop.phone
                    }
                  />
                )}

                {shop.whatsapp && (
                  <InfoRow
                    label="واتساب"
                    value={
                      shop.whatsapp
                    }
                  />
                )}
              </section>
            )}
          </aside>
        </div>

        {/* Description */}

        {video?.prompt && (
          <section
            style={{
              marginTop: 20,
              background: "#fff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 20,
              padding: 20,
            }}
          >
            <h2>
              📝 وصف الفيديو
            </h2>

            <p
              style={{
                color: "#475569",
                whiteSpace:
                  "pre-wrap",
                lineHeight: 1.8,
              }}
            >
              {video.prompt}
            </p>
          </section>
        )}

        {/* Delete */}

        <section
          style={{
            marginTop: 20,
            background: "#fff",
            border:
              "1px solid #fee2e2",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <button
            onClick={deleteVideo}
            disabled={deleting}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding:
                "12px 18px",
              fontWeight: 800,
              cursor:
                deleting
                  ? "not-allowed"
                  : "pointer",
              opacity:
                deleting
                  ? 0.7
                  : 1,
            }}
          >
            {deleting
              ? "جاري الحذف..."
              : "🗑️ حذف الفيديو"}
          </button>
        </section>

        {/* New video */}

        <div
          style={{
            textAlign: "center",
            marginTop: 25,
            paddingBottom: 30,
          }}
        >
          <Link
            href="/videos/new"
            style={{
              display:
                "inline-block",
              background:
                "#15803d",
              color: "#fff",
              padding:
                "13px 22px",
              borderRadius: 12,
              textDecoration:
                "none",
              fontWeight: 900,
            }}
          >
            + إنشاء فيديو جديد
          </Link>
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
        gap: 15,
        padding:
          "10px 0",
        borderBottom:
          "1px solid #f1f5f9",
      }}
    >
      <span
        style={{
          color: "#64748b",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          textAlign: "left",
        }}
      >
        {value || "-"}
      </strong>
    </div>
  );
}
