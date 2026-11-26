"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadVideos(options = {}) {
    const silent = options.silent === true;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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

      // -----------------------------------------
      // المحل المرتبط بالحساب
      // -----------------------------------------

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
        setShop(null);
        setProducts([]);
        setVideos([]);
        setError("لا يوجد محل مرتبط بهذا الحساب.");
        return;
      }

      setShop(shopData);

      // -----------------------------------------
      // منتجات المحل
      // -----------------------------------------

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select(
          "id, name, brand, image_url, price, currency, safety_status, safety_level"
        )
        .eq("shop_id", shopData.id)
        .order("created_at", {
          ascending: false,
        });

      if (productError) {
        throw productError;
      }

      setProducts(productData || []);

      // -----------------------------------------
      // فيديوهات المحل
      //
      // مهم:
      // لا يوجد user_id في ad_videos.
      // الربط يكون عن طريق shop_id.
      // -----------------------------------------

      const {
        data: videoData,
        error: videoError,
      } = await supabase
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
      console.error("LOAD VIDEOS ERROR:", err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل الفيديوهات."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadVideos();
  }, []);

  // -----------------------------------------
  // تحديث تلقائي للحالات قيد التوليد
  // -----------------------------------------

  useEffect(() => {
    const hasActiveVideos = videos.some(
      (video) =>
        video.status === "pending" ||
        video.status === "processing"
    );

    if (!hasActiveVideos) {
      return;
    }

    const interval = setInterval(() => {
      loadVideos({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [videos]);

  // -----------------------------------------
  // المنتج المرتبط بالفيديو
  // -----------------------------------------

  function getProduct(productId) {
    return (
      products.find(
        (product) => product.id === productId
      ) || null
    );
  }

  // -----------------------------------------
  // حالة الفيديو
  // -----------------------------------------

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

  // -----------------------------------------
  // التاريخ
  // -----------------------------------------

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat("ar-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  // -----------------------------------------
  // الإحصائيات
  // -----------------------------------------

  const stats = useMemo(() => {
    return {
      total: videos.length,

      completed: videos.filter(
        (video) => video.status === "completed"
      ).length,

      processing: videos.filter(
        (video) => video.status === "processing"
      ).length,

      pending: videos.filter(
        (video) => video.status === "pending"
      ).length,

      failed: videos.filter(
        (video) => video.status === "failed"
      ).length,
    };
  }, [videos]);

  // -----------------------------------------
  // الفيديوهات بعد البحث والفلترة
  // -----------------------------------------

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();

    return videos.filter((video) => {
      const product = getProduct(video.product_id);

      const matchesStatus =
        statusFilter === "all" ||
        video.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const values = [
        video.title,
        video.video_type,
        video.mode,
        video.format,
        product?.name,
        product?.brand,
      ];

      return values.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [
    videos,
    products,
    search,
    statusFilter,
  ]);

  async function handleRefresh() {
    await loadVideos({ silent: true });
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
          maxWidth: 1150,
          margin: "0 auto",
        }}
      >
        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

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
              🎬 مركز الفيديوهات
            </h1>

            <p
              style={{
                margin: "8px 0 0",
                color: "#666",
                lineHeight: 1.7,
              }}
            >
              أنشئ وأدر جميع الفيديوهات
              الإعلانية الخاصة بمحلّك.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                background: "#fff",
                color: "#166534",
                border: "1px solid #bbf7d0",
                borderRadius: 12,
                padding: "13px 16px",
                fontSize: 14,
                fontWeight: 900,
                cursor: refreshing
                  ? "default"
                  : "pointer",
                opacity: refreshing ? 0.7 : 1,
              }}
            >
              {refreshing
                ? "⟳ تحديث..."
                : "↻ تحديث"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/videos/new")
              }
              style={{
                background: "#15803d",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "13px 18px",
                fontSize: 15,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ＋ إنشاء فيديو جديد
            </button>
          </div>
        </div>

        {/* ================================= */}
        {/* SHOP */}
        {/* ================================= */}

        {shop && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
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
                  alignItems: "center",
                  justifyContent: "center",
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
                مركز فيديوهات محلّك
              </div>
            </div>
          </div>
        )}

        {/* ================================= */}
        {/* STATS */}
        {/* ================================= */}

        {!loading && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <StatCard
              icon="🎬"
              title="إجمالي الفيديوهات"
              value={stats.total}
            />

            <StatCard
              icon="✓"
              title="مكتملة"
              value={stats.completed}
              accent="#166534"
            />

            <StatCard
              icon="⚙️"
              title="جاري التوليد"
              value={stats.processing}
              accent="#1d4ed8"
            />

            <StatCard
              icon="⏳"
              title="بانتظار التوليد"
              value={stats.pending}
              accent="#92400e"
            />

            <StatCard
              icon="✕"
              title="فاشلة"
              value={stats.failed}
              accent="#991b1b"
            />
          </div>
        )}

        {/* ================================= */}
        {/* ERROR */}
        {/* ================================= */}

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 14,
              marginBottom: 18,
              fontWeight: 700,
              lineHeight: 1.7,
            }}
          >
            {error}
          </div>
        )}

        {/* ================================= */}
        {/* LOADING */}
        {/* ================================= */}

        {loading ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 40,
              textAlign: "center",
              border: "1px solid #e5e7eb",
              color: "#666",
            }}
          >
            جاري تحميل الفيديوهات...
          </div>
        ) : videos.length === 0 ? (
          /* ================================= */
          /* EMPTY */
          /* ================================= */

          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 45,
              textAlign: "center",
              border: "1px solid #e5e7eb",
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
                margin: "0 0 8px",
                fontSize: 21,
                fontWeight: 900,
              }}
            >
              ما عندك فيديوهات بعد
            </h2>

            <p
              style={{
                color: "#777",
                margin: "0 auto 20px",
                maxWidth: 450,
                lineHeight: 1.7,
              }}
            >
              أنشئ أول فيديو إعلاني لمنتجك،
              وبعدها ستظهر جميع الفيديوهات
              هنا.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/videos/new")
              }
              style={{
                background: "#15803d",
                color: "#fff",
                border: "none",
                borderRadius: 11,
                padding: "13px 22px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              🎬 إنشاء أول فيديو
            </button>
          </div>
        ) : (
          <>
            {/* ================================= */}
            {/* SEARCH + FILTER */}
            {/* ================================= */}

            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(220px, 1fr) minmax(180px, 230px)",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 7,
                      fontSize: 13,
                      fontWeight: 900,
                      color: "#374151",
                    }}
                  >
                    البحث
                  </label>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="ابحث باسم الفيديو أو المنتج أو العلامة..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border:
                        "1px solid #d1d5db",
                      borderRadius: 10,
                      padding:
                        "12px 13px",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 7,
                      fontSize: 13,
                      fontWeight: 900,
                      color: "#374151",
                    }}
                  >
                    الحالة
                  </label>

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value
                      )
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border:
                        "1px solid #d1d5db",
                      borderRadius: 10,
                      padding:
                        "12px 13px",
                      fontSize: 14,
                      background: "#fff",
                      outline: "none",
                    }}
                  >
                    <option value="all">
                      جميع الحالات
                    </option>
                    <option value="completed">
                      مكتمل
                    </option>
                    <option value="processing">
                      جاري التوليد
                    </option>
                    <option value="pending">
                      بانتظار التوليد
                    </option>
                    <option value="failed">
                      فشل
                    </option>
                    <option value="cancelled">
                      ملغي
                    </option>
                  </select>
                </div>
              </div>

              {(search ||
                statusFilter !== "all") && (
                <div
                  style={{
                    marginTop: 12,
                    color: "#666",
                    fontSize: 13,
                  }}
                >
                  عرض{" "}
                  <strong>
                    {filteredVideos.length}
                  </strong>{" "}
                  من أصل{" "}
                  <strong>
                    {videos.length}
                  </strong>{" "}
                  فيديو
                </div>
              )}
            </div>

            {/* ================================= */}
            {/* NO FILTER RESULTS */}
            {/* ================================= */}

            {filteredVideos.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 40,
                  textAlign: "center",
                  border:
                    "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontSize: 45,
                    marginBottom: 10,
                  }}
                >
                  🔎
                </div>

                <h2
                  style={{
                    margin:
                      "0 0 8px",
                    fontSize: 20,
                    fontWeight: 900,
                  }}
                >
                  لا توجد نتائج
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#777",
                  }}
                >
                  جرّب تغيير البحث أو
                  الفلتر.
                </p>
              </div>
            ) : (
              /* ================================= */
              /* VIDEO GRID */
              /* ================================= */

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 18,
                }}
              >
                {filteredVideos.map(
                  (video) => {
                    const product =
                      getProduct(
                        video.product_id
                      );

                    const status =
                      getStatus(
                        video.status
                      );

                    const isProcessing =
                      video.status ===
                      "processing";

                    const isPending =
                      video.status ===
                      "pending";

                    const isCompleted =
                      video.status ===
                      "completed";

                    return (
                      <article
                        key={video.id}
                        style={{
                          background: "#fff",
                          borderRadius: 16,
                          overflow:
                            "hidden",
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
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            overflow:
                              "hidden",
                          }}
                        >
                          {isCompleted &&
                          video.video_url ? (
                            <video
                              src={
                                video.video_url
                              }
                              muted
                              playsInline
                              preload="metadata"
                              style={{
                                width:
                                  "100%",
                                height:
                                  "100%",
                                objectFit:
                                  "cover",
                              }}
                            />
                          ) : video.thumbnail_url ? (
                            <img
                              src={
                                video.thumbnail_url
                              }
                              alt={
                                video.title ||
                                "فيديو"
                              }
                              style={{
                                width:
                                  "100%",
                                height:
                                  "100%",
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
                                width:
                                  "100%",
                                height:
                                  "100%",
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
                              borderRadius:
                                999,
                              padding:
                                "6px 10px",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            {
                              status.icon
                            }{" "}
                            {
                              status.title
                            }
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

                          {/* PROCESSING */}

                          {(isProcessing ||
                            isPending) && (
                            <div
                              style={{
                                position:
                                  "absolute",
                                inset: 0,
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                background:
                                  "rgba(255,255,255,0.18)",
                                backdropFilter:
                                  "blur(2px)",
                                fontSize: 38,
                              }}
                            >
                              {isProcessing
                                ? "⚙️"
                                : "⏳"}
                            </div>
                          )}
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
                              lineHeight:
                                1.4,
                            }}
                          >
                            {video.title ||
                              product?.name ||
                              "فيديو إعلاني"}
                          </h2>

                          {product && (
                            <div
                              style={{
                                color:
                                  "#666",
                                fontSize: 13,
                                marginBottom:
                                  9,
                              }}
                            >
                              المنتج:{" "}
                              <strong>
                                {
                                  product.name
                                }
                              </strong>

                              {product.brand && (
                                <>
                                  {" "}
                                  ·{" "}
                                  {
                                    product.brand
                                  }
                                </>
                              )}
                            </div>
                          )}

                          <div
                            style={{
                              display:
                                "flex",
                              flexWrap:
                                "wrap",
                              gap: 6,
                              marginBottom:
                                10,
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

                            {video.provider && (
                              <Tag>
                                {video.provider}
                              </Tag>
                            )}
                          </div>

                          <div
                            style={{
                              color:
                                "#888",
                              fontSize: 12,
                              marginBottom:
                                14,
                            }}
                          >
                            {formatDate(
                              video.created_at
                            )}
                          </div>

                          {/* ERROR */}

                          {video.error_message && (
                            <div
                              style={{
                                background:
                                  "#fef2f2",
                                color:
                                  "#991b1b",
                                border:
                                  "1px solid #fecaca",
                                borderRadius:
                                  9,
                                padding:
                                  "9px 10px",
                                fontSize:
                                  12,
                                lineHeight:
                                  1.6,
                                marginBottom:
                                  12,
                              }}
                            >
                              {video.error_message}
                            </div>
                          )}

                          {/* ACTION */}

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
                              border:
                                "none",
                              borderRadius:
                                10,
                              padding:
                                "11px 14px",
                              fontWeight: 900,
                              cursor:
                                "pointer",
                            }}
                          >
                            {isCompleted
                              ? "▶️ مشاهدة الفيديو"
                              : "👁️ عرض الفيديو"}
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  icon,
  title,
  value,
  accent = "#15803d",
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 20,
          }}
        >
          {icon}
        </span>

        <span
          style={{
            fontSize: 12,
            color: "#777",
            fontWeight: 800,
          }}
        >
          {title}
        </span>
      </div>

      <div
        style={{
          fontSize: 27,
          fontWeight: 900,
          color: accent,
        }}
      >
        {value}
      </div>
    </div>
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
        padding: "5px 8px",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}
