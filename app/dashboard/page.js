"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);

  const [products, setProducts] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [videos, setVideos] = useState([]);
  const [marketingContents, setMarketingContents] = useState([]);
  const [activities, setActivities] = useState([]);

  const [stats, setStats] = useState({
    products: 0,
    verifiedProducts: 0,
    reviewProducts: 0,
    lockedProducts: 0,
    designs: 0,
    videos: 0,
    completedVideos: 0,
    processingVideos: 0,
    marketingContents: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      const { data: currentShop, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", currentUser.id)
        .maybeSingle();

      if (shopError) {
        console.error("Shop error:", shopError);
      }

      if (!currentShop) {
        router.replace("/setup-shop");
        return;
      }

      setShop(currentShop);

      /*
       * PRODUCTS
       */
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false });

      if (productError) {
        console.error("Products error:", productError);
      }

      const productList = productData || [];

      setProducts(productList.slice(0, 5));

      /*
       * DESIGNS
       */
      const { data: designData, error: designError } = await supabase
        .from("ad_images")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false });

      if (designError) {
        console.error("Designs error:", designError);
      }

      const designList = designData || [];

      setDesigns(designList.slice(0, 5));

      /*
       * VIDEOS
       */
      const { data: videoData, error: videoError } = await supabase
        .from("ad_videos")
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false });

      if (videoError) {
        console.error("Videos error:", videoError);
      }

      const videoList = videoData || [];

      setVideos(videoList.slice(0, 5));

      /*
       * MARKETING CONTENT
       */
      const { data: marketingData, error: marketingError } =
        await supabase
          .from("marketing_contents")
          .select("*")
          .eq("shop_id", currentShop.id)
          .order("created_at", { ascending: false });

      if (marketingError) {
        console.error("Marketing content error:", marketingError);
      }

      const marketingList = marketingData || [];

      setMarketingContents(marketingList);

      /*
       * ACTIVITY LOG
       */
      const { data: activityData, error: activityError } =
        await supabase
          .from("activity_logs")
          .select("*")
          .eq("shop_id", currentShop.id)
          .order("created_at", { ascending: false })
          .limit(8);

      if (activityError) {
        console.error("Activity error:", activityError);
      }

      setActivities(activityData || []);

      /*
       * PRODUCT STATS
       */
      const verifiedProducts = productList.filter(
        (product) =>
          product.verification_status === "verified" ||
          product.ai_status === "completed"
      ).length;

      const reviewProducts = productList.filter(
        (product) =>
          product.safety_status === "review" ||
          product.safety_level === "medium" ||
          product.safety_level === "high"
      ).length;

      const lockedProducts = productList.filter(
        (product) =>
          product.safety_status === "locked" ||
          product.safety_status === "violation" ||
          product.verification_status === "locked"
      ).length;

      /*
       * VIDEO STATS
       */
      const completedVideos = videoList.filter(
        (video) => video.status === "completed"
      ).length;

      const processingVideos = videoList.filter(
        (video) =>
          video.status === "pending" ||
          video.status === "processing"
      ).length;

      setStats({
        products: productList.length,
        verifiedProducts,
        reviewProducts,
        lockedProducts,
        designs: designList.length,
        videos: videoList.length,
        completedVideos,
        processingVideos,
        marketingContents: marketingList.length,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function formatDate(date) {
    if (!date) return "";

    try {
      return new Intl.DateTimeFormat("ar-AE", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(date));
    } catch {
      return "";
    }
  }

  function getProductStatus(product) {
    if (
      product.safety_status === "locked" ||
      product.safety_status === "violation" ||
      product.verification_status === "locked"
    ) {
      return {
        text: "مقفول",
        background: "#fef2f2",
        color: "#b91c1c",
      };
    }

    if (
      product.safety_status === "review" ||
      product.safety_level === "medium" ||
      product.safety_level === "high"
    ) {
      return {
        text: "يحتاج مراجعة",
        background: "#fffbeb",
        color: "#b45309",
      };
    }

    if (
      product.ai_status === "completed" ||
      product.verification_status === "verified"
    ) {
      return {
        text: "جاهز",
        background: "#ecfdf5",
        color: "#047857",
      };
    }

    return {
      text: "قيد المعالجة",
      background: "#f3f4f6",
      color: "#4b5563",
    };
  }

  function getVideoStatus(status) {
    switch (status) {
      case "completed":
        return {
          text: "مكتمل",
          background: "#ecfdf5",
          color: "#047857",
        };

      case "processing":
        return {
          text: "قيد التوليد",
          background: "#eff6ff",
          color: "#1d4ed8",
        };

      case "pending":
        return {
          text: "بانتظار التوليد",
          background: "#fffbeb",
          color: "#b45309",
        };

      case "failed":
        return {
          text: "فشل",
          background: "#fef2f2",
          color: "#b91c1c",
        };

      default:
        return {
          text: status || "غير معروف",
          background: "#f3f4f6",
          color: "#4b5563",
        };
    }
  }

  function getActivityIcon(action) {
    const value = String(action || "").toLowerCase();

    if (value.includes("product")) return "📦";
    if (value.includes("design")) return "🎨";
    if (value.includes("video")) return "🎬";
    if (value.includes("marketing")) return "📝";
    if (value.includes("shop")) return "🏪";
    if (value.includes("login")) return "🔐";

    return "⚡";
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f8fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          color: "#374151",
        }}
      >
        جاري تحميل لوحة التحكم...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        fontFamily: "Arial, sans-serif",
        paddingBottom: "50px",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 20px",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: "1150px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "#111827",
              }}
            >
              سوق AI
            </div>

            <div
              style={{
                marginTop: "3px",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              لوحة التحكم
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <button
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              style={{
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                borderRadius: "10px",
                padding: "9px 12px",
                cursor: refreshing ? "default" : "pointer",
                fontSize: "13px",
              }}
            >
              {refreshing ? "تحديث..." : "↻ تحديث"}
            </button>

            <button
              onClick={handleLogout}
              style={{
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                borderRadius: "10px",
                padding: "9px 14px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: "1150px",
          margin: "0 auto",
          padding: "24px 20px",
        }}
      >
        {/* WELCOME */}
        <section
          style={{
            background: "#111827",
            color: "#ffffff",
            borderRadius: "22px",
            padding: "28px",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              opacity: 0.75,
              marginBottom: "7px",
            }}
          >
            أهلاً بك 👋
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            {shop?.name || "متجرك"}
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#d1d5db",
              lineHeight: "1.7",
              maxWidth: "700px",
            }}
          >
            من هنا تدير منتجاتك وتسويقك وتصاميمك وفيديوهاتك بالذكاء
            الاصطناعي.
          </p>

          {user?.email && (
            <div
              style={{
                marginTop: "12px",
                fontSize: "13px",
                color: "#9ca3af",
              }}
            >
              {user.email}
            </div>
          )}
        </section>

        {/* MAIN STATS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          <StatCard
            icon="📦"
            title="المنتجات"
            value={stats.products}
          />

          <StatCard
            icon="🎨"
            title="التصاميم"
            value={stats.designs}
          />

          <StatCard
            icon="🎬"
            title="الفيديوهات"
            value={stats.videos}
          />

          <StatCard
            icon="📝"
            title="المحتوى التسويقي"
            value={stats.marketingContents}
          />
        </section>

        {/* QUICK ACTIONS */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "22px",
            marginBottom: "24px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: "20px",
              color: "#111827",
            }}
          >
            الوصول السريع
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
            }}
          >
            <ActionLink
              href="/add-product"
              icon="➕"
              title="إضافة منتج"
              description="أضف منتجاً جديداً"
            />

            <ActionLink
              href="/products"
              icon="📦"
              title="المنتجات"
              description="إدارة منتجات متجرك"
            />

            <ActionLink
              href="/marketing"
              icon="📝"
              title="التسويق"
              description="إنشاء المحتوى التسويقي"
            />

            <ActionLink
              href="/designs"
              icon="🎨"
              title="التصاميم"
              description="إدارة تصاميم الإعلانات"
            />

            <ActionLink
              href="/videos"
              icon="🎬"
              title="الفيديوهات"
              description="إدارة فيديوهات الإعلانات"
            />

            <ActionLink
              href="/setup-shop"
              icon="🏪"
              title="بيانات المتجر"
              description="تعديل معلومات متجرك"
            />
          </div>
        </section>

        {/* PRODUCT OVERVIEW */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "22px",
            marginBottom: "24px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  color: "#111827",
                }}
              >
                حالة المنتجات
              </h2>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                نظرة سريعة على حالة منتجات متجرك
              </div>
            </div>

            <Link
              href="/products"
              style={{
                color: "#374151",
                fontSize: "14px",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              عرض الكل
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
            }}
          >
            <MiniStat
              title="جاهزة"
              value={stats.verifiedProducts}
              icon="✅"
            />

            <MiniStat
              title="تحتاج مراجعة"
              value={stats.reviewProducts}
              icon="⚠️"
            />

            <MiniStat
              title="مقفلة"
              value={stats.lockedProducts}
              icon="🔒"
            />
          </div>
        </section>

        {/* LATEST PRODUCTS */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "22px",
            marginBottom: "24px",
            border: "1px solid #e5e7eb",
          }}
        >
          <SectionHeader
            title="آخر المنتجات"
            subtitle="آخر المنتجات التي تمت إضافتها إلى متجرك"
            href="/products"
            linkText="عرض الكل"
          />

          {products.length === 0 ? (
            <EmptyState
              icon="📦"
              title="لا توجد منتجات حتى الآن"
              description="ابدأ بإضافة أول منتج لمتجرك."
              href="/add-product"
              buttonText="إضافة أول منتج"
            />
          ) : (
            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              {products.map((product) => {
                const status = getProductStatus(product);

                return (
                  <div
                    key={product.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name || "منتج"}
                        style={{
                          width: "68px",
                          height: "68px",
                          objectFit: "cover",
                          borderRadius: "12px",
                          background: "#f3f4f6",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "68px",
                          height: "68px",
                          borderRadius: "12px",
                          background: "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "25px",
                        }}
                      >
                        📦
                      </div>
                    )}

                    <div
                      style={{
                        flex: 1,
                        minWidth: "180px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#111827",
                          marginBottom: "5px",
                        }}
                      >
                        {product.name || "منتج بدون اسم"}
                      </div>

                      {product.brand && (
                        <div
                          style={{
                            color: "#6b7280",
                            fontSize: "13px",
                          }}
                        >
                          {product.brand}
                        </div>
                      )}

                      <div
                        style={{
                          display: "inline-block",
                          marginTop: "7px",
                          padding: "4px 8px",
                          borderRadius: "999px",
                          background: status.background,
                          color: status.color,
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        {status.text}
                      </div>
                    </div>

                    <Link
                      href={`/marketing/${product.id}`}
                      style={{
                        textDecoration: "none",
                        background: "#111827",
                        color: "#ffffff",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🚀 سوّق
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* DESIGNS + VIDEOS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          {/* DESIGNS */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "22px",
              border: "1px solid #e5e7eb",
            }}
          >
            <SectionHeader
              title="آخر التصاميم"
              subtitle={`${stats.designs} تصميم`}
              href="/designs"
              linkText="عرض الكل"
            />

            {designs.length === 0 ? (
              <EmptyState
                icon="🎨"
                title="لا توجد تصاميم"
                description="أنشئ أول تصميم إعلاني لمنتجاتك."
                href="/designs"
                buttonText="فتح التصاميم"
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "10px",
                }}
              >
                {designs.slice(0, 4).map((design) => (
                  <Link
                    key={design.id}
                    href={`/designs/${design.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "14px",
                        overflow: "hidden",
                        background: "#f9fafb",
                      }}
                    >
                      {design.image_url ? (
                        <img
                          src={design.image_url}
                          alt={design.title || "تصميم"}
                          style={{
                            width: "100%",
                            aspectRatio: "1 / 1",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "1 / 1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "30px",
                          }}
                        >
                          🎨
                        </div>
                      )}

                      <div
                        style={{
                          padding: "9px",
                          fontSize: "12px",
                          color: "#374151",
                          fontWeight: "bold",
                        }}
                      >
                        {design.title || "تصميم إعلاني"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* VIDEOS */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "22px",
              border: "1px solid #e5e7eb",
            }}
          >
            <SectionHeader
              title="آخر الفيديوهات"
              subtitle={`${stats.videos} فيديو`}
              href="/videos"
              linkText="عرض الكل"
            />

            {videos.length === 0 ? (
              <EmptyState
                icon="🎬"
                title="لا توجد فيديوهات"
                description="أنشئ أول فيديو إعلاني."
                href="/videos/new"
                buttonText="إنشاء فيديو"
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {videos.slice(0, 4).map((video) => {
                  const status = getVideoStatus(video.status);

                  return (
                    <Link
                      key={video.id}
                      href={`/videos/${video.id}`}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px",
                          border: "1px solid #e5e7eb",
                          borderRadius: "14px",
                        }}
                      >
                        <div
                          style={{
                            width: "58px",
                            height: "58px",
                            borderRadius: "10px",
                            background: "#f3f4f6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.title || "فيديو"}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: "24px" }}>
                              🎬
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              color: "#111827",
                              fontSize: "14px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {video.title || "فيديو إعلاني"}
                          </div>

                          <div
                            style={{
                              marginTop: "6px",
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: status.background,
                              color: status.color,
                              fontSize: "11px",
                              fontWeight: "bold",
                            }}
                          >
                            {status.text}
                          </div>
                        </div>

                        <span
                          style={{
                            color: "#9ca3af",
                            fontSize: "18px",
                          }}
                        >
                          ‹
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* VIDEO STATUS SUMMARY */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "22px",
            marginBottom: "24px",
            border: "1px solid #e5e7eb",
          }}
        >
          <SectionHeader
            title="حالة الفيديوهات"
            subtitle="متابعة عمليات التوليد"
            href="/videos"
            linkText="إدارة الفيديوهات"
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            <MiniStat
              title="مكتملة"
              value={stats.completedVideos}
              icon="✅"
            />

            <MiniStat
              title="قيد التوليد"
              value={stats.processingVideos}
              icon="⏳"
            />

            <MiniStat
              title="إجمالي"
              value={stats.videos}
              icon="🎬"
            />
          </div>
        </section>

        {/* ACTIVITY */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "22px",
            border: "1px solid #e5e7eb",
          }}
        >
          <SectionHeader
            title="آخر النشاطات"
            subtitle="آخر العمليات على متجرك"
            href="/activity"
            linkText="عرض النشاطات"
          />

          {activities.length === 0 ? (
            <div
              style={{
                padding: "24px 10px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              لا توجد نشاطات مسجلة حتى الآن.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "10px",
              }}
            >
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "#f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getActivityIcon(activity.action)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#374151",
                        fontSize: "14px",
                      }}
                    >
                      {activity.description ||
                        activity.action ||
                        "نشاط جديد"}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "#9ca3af",
                        fontSize: "12px",
                      }}
                    >
                      {formatDate(activity.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "20px",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: "26px",
          marginBottom: "10px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#6b7280",
          fontSize: "14px",
          marginBottom: "5px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({ title, value, icon }) {
  return (
    <div
      style={{
        background: "#f9fafb",
        borderRadius: "16px",
        padding: "16px",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: "20px",
          marginBottom: "7px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#6b7280",
          fontSize: "13px",
          marginBottom: "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "23px",
          fontWeight: "bold",
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkText,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            color: "#111827",
          }}
        >
          {title}
        </h2>

        {subtitle && (
          <div
            style={{
              marginTop: "5px",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {href && (
        <Link
          href={href}
          style={{
            color: "#374151",
            fontSize: "13px",
            textDecoration: "none",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          {linkText || "عرض الكل"}
        </Link>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  href,
  buttonText,
}) {
  return (
    <div
      style={{
        padding: "26px 10px",
        textAlign: "center",
        color: "#6b7280",
      }}
    >
      <div
        style={{
          fontSize: "34px",
          marginBottom: "8px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontWeight: "bold",
          color: "#374151",
          marginBottom: "5px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "13px",
          lineHeight: "1.7",
          marginBottom: "14px",
        }}
      >
        {description}
      </div>

      {href && (
        <Link
          href={href}
          style={{
            display: "inline-block",
            textDecoration: "none",
            background: "#111827",
            color: "#ffffff",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "bold",
          }}
        >
          {buttonText}
        </Link>
      )}
    </div>
  );
}

function ActionLink({
  href,
  icon,
  title,
  description,
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "25px",
          marginBottom: "8px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontWeight: "bold",
          color: "#111827",
          marginBottom: "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "13px",
          color: "#6b7280",
        }}
      >
        {description}
      </div>
    </Link>
  );
}
