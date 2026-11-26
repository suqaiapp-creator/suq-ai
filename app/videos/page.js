"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

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
  sale: "خصم وعرض",
  social: "سوشيال ميديا",
};

const MODES = {
  simple: "عادي",
  professional: "احترافي",
};

export default function VideosPage() {
  const router = useRouter();

  const [videos, setVideos] = useState([]);
  const [products, setProducts] = useState([]);

  const [shop, setShop] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadVideos() {
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
        setError(
          "لا يوجد محل مرتبط بهذا الحساب."
        );
        return;
      }

      setShop(shopData);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select(
            "id, name, brand, image_url, price, currency"
          )
          .eq("shop_id", shopData.id);

      if (productError) {
        throw productError;
      }

      setProducts(productData || []);

      const { data: videoData, error: videoError } =
        await supabase
          .from("ad_videos")
          .select("*")
          .eq("shop_id", shopData.id)
          .order("created_at", {
            ascending: false,
          });

      if (videoError) {
        throw videoError;
      }

      setVideos(videoData || []);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل الفيديوهات."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
  }, []);

  function getProduct(productId) {
    return (
      products.find(
        (product) =>
          product.id === productId
      ) || null
    );
  }

  function getStatus(status) {
    return (
      STATUS[status] || {
        title: status || "غير معروف",
        color: "#374151",
        background: "#f3f4f6",
        icon: "•",
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
          maxWidth: 1150,
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
              🎬 فيديوهاتي
            </h1>

            <p
              style={{
                margin:
                  "8px 0 0",
                color: "#666",
              }}
            >
              جميع الفيديوهات الإعلانية
              الخاصة بمحلّك.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/videos/new"
              )
            }
            style={{
              background: "#15803d",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding:
                "13px 18px",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ＋ إنشاء فيديو جديد
          </button>
        </div>

        {/* SHOP */}

        {shop && (
          <div
            style={{
              background: "#fff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 16,
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {shop.logo_url ? (
              <img
                src={shop.logo_url}
                alt={shop.name}
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "cover",
                  borderRadius: 10,
                }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "#dcfce7",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: 23,
                }}
              >
                🏪
              </div>
            )}

            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                {shop.name}
              </div>

              <div
                style={{
                  color: "#777",
                  fontSize: 13,
                  marginTop: 3,
                }}
              >
                {videos.length}{" "}
                فيديو
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}

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

        {/* LOADING */}

        {loading ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 40,
              textAlign: "center",
              border:
                "1px solid #e5e7eb",
              color: "#666",
            }}
          >
            جاري تحميل الفيديوهات...
          </div>
        ) : videos.length === 0 ? (
          /* EMPTY */

          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 45,
              textAlign: "center",
              border:
                "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: 55,
                marginBottom: 12,
              }}
            >
              🎬
            </div>

            <h2
              style={{
                margin:
                  "0 0 8px",
                fontSize: 21,
                fontWeight: 900,
              }}
            >
              ما عندك فيديوهات بعد
            </h2>

            <p
              style={{
                color: "#777",
                margin:
                  "0 auto 20px",
                maxWidth: 450,
                lineHeight: 1.7,
              }}
            >
              أنشئ أول فيديو إعلاني
              لمنتجك، وبعدها ستظهر جميع
              الفيديوهات هنا.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/videos/new"
                )
              }
              style={{
                background: "#15803d",
                color: "#fff",
                border: "none",
                borderRadius: 11,
                padding:
                  "13px 22px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              🎬 إنشاء أول فيديو
            </button>
          </div>
        ) : (
          /* VIDEO GRID */

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            {videos.map((video) => {
              const product =
                getProduct(
                  video.product_id
                );

              const status =
                getStatus(
                  video.status
                );

              return (
                <article
                  key={video.id}
                  style={{
                    background:
                      "#fff",
                    borderRadius: 16,
                    overflow: "hidden",
                    border:
                      "1px solid #e5e7eb",
                    boxShadow:
                      "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* THUMBNAIL */}

                  <div
                    style={{
                      height: 220,
                      background:
                        "#f1f5f9",
                      position:
                        "relative",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      overflow:
                        "hidden",
                    }}
                  >
                    {video.thumbnail_url ? (
                      <img
                        src={
                          video.thumbnail_url
                        }
                        alt={
                          video.title ||
                          "فيديو"
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit:
                            "cover",
                        }}
                      />
                    ) : product?.image_url ? (
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
                          height: "100%",
                          objectFit:
                            "contain",
                          padding: 20,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: 55,
                        }}
                      >
                        🎬
                      </div>
                    )}

                    {/* STATUS */}

                    <div
                      style={{
                        position:
                          "absolute",
                        top: 12,
                        right: 12,
                        background:
                          status.background,
                        color:
                          status.color,
                        borderRadius: 999,
                        padding:
                          "6px 10px",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      {status.icon}{" "}
                      {status.title}
                    </div>

                    {/* DURATION */}

                    <div
                      style={{
                        position:
                          "absolute",
                        bottom: 10,
                        left: 10,
                        background:
                          "rgba(0,0,0,0.72)",
                        color: "#fff",
                        borderRadius: 7,
                        padding:
                          "5px 8px",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {video.duration_seconds ||
                        0}{" "}
                      ث
                    </div>
                  </div>

                  {/* CONTENT */}

                  <div
                    style={{
                      padding: 16,
                    }}
                  >
                    <h2
                      style={{
                        margin:
                          "0 0 7px",
                        fontSize: 17,
                        fontWeight: 900,
                        lineHeight: 1.4,
                      }}
                    >
                      {video.title ||
                        product?.name ||
                        "فيديو إعلاني"}
                    </h2>

                    {product && (
                      <div
                        style={{
                          color: "#666",
                          fontSize: 13,
                          marginBottom: 9,
                        }}
                      >
                        المنتج:{" "}
                        <strong>
                          {
                            product.name
                          }
                        </strong>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        flexWrap:
                          "wrap",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <Tag>
                        {VIDEO_TYPES[
                          video.video_type
                        ] ||
                          video.video_type ||
                          "فيديو"}
                      </Tag>

                      <Tag>
                        {MODES[
                          video.mode
                        ] ||
                          video.mode ||
                          "احترافي"}
                      </Tag>

                      <Tag>
                        {video.format ||
                          "9:16"}
                      </Tag>
                    </div>

                    <div
                      style={{
                        color: "#888",
                        fontSize: 12,
                        marginBottom: 14,
                      }}
                    >
                      {formatDate(
                        video.created_at
                      )}
                    </div>

                    {/* ACTIONS */}

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/videos/${video.id}`
                        )
                      }
                      style={{
                        width: "100%",
                        background:
                          "#15803d",
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        padding:
                          "11px 14px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      👁️ عرض الفيديو
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Tag({ children }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#f3f4f6",
        color: "#4b5563",
        borderRadius: 7,
        padding:
          "5px 8px",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}
