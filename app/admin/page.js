"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function AdminPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  const [profiles, setProfiles] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [videos, setVideos] = useState([]);
  const [marketing, setMarketing] = useState([]);
  const [moderation, setModeration] = useState([]);
  const [activity, setActivity] = useState([]);
  const [aiUsage, setAiUsage] = useState([]);

  const loadAdminData = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("يجب تسجيل الدخول أولاً.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role, account_status, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile?.is_super_admin) {
        setError("هذه الصفحة مخصصة لـ Super Admin فقط.");
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const [
        profilesResult,
        shopsResult,
        productsResult,
        designsResult,
        videosResult,
        marketingResult,
        moderationResult,
        activityResult,
        aiUsageResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, phone, role, account_status, is_super_admin, last_login_at, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("shops")
          .select(
            "id, owner_id, name, status, emirate, country, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("products")
          .select(
            "id, shop_id, name, brand, category, product_type, verification_status, ai_status, safety_status, safety_level, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("ad_images")
          .select(
            "id, shop_id, product_id, status, created_at, generated_at, error_message"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("ad_videos")
          .select(
            "id, shop_id, product_id, design_id, title, status, provider, created_at, generated_at, completed_at, error_message"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("marketing_contents")
          .select(
            "id, shop_id, product_id, status, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("product_moderation")
          .select(
            "id, product_id, action, status, reason, level, notes, admin_id, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("activity_logs")
          .select(
            "id, user_id, shop_id, action, entity_type, entity_id, description, metadata, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("ai_usage")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (shopsResult.error) throw shopsResult.error;
      if (productsResult.error) throw productsResult.error;
      if (designsResult.error) throw designsResult.error;
      if (videosResult.error) throw videosResult.error;
      if (marketingResult.error) throw marketingResult.error;
      if (moderationResult.error) throw moderationResult.error;
      if (activityResult.error) throw activityResult.error;
      if (aiUsageResult.error) throw aiUsageResult.error;

      setProfiles(profilesResult.data || []);
      setShops(shopsResult.data || []);
      setProducts(productsResult.data || []);
      setDesigns(designsResult.data || []);
      setVideos(videosResult.data || []);
      setMarketing(marketingResult.data || []);
      setModeration(moderationResult.data || []);
      setActivity(activityResult.data || []);
      setAiUsage(aiUsageResult.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || "حدث خطأ أثناء تحميل لوحة التحكم.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const stats = useMemo(() => {
    const activeUsers = profiles.filter(
      (item) => item.account_status === "active"
    ).length;

    const suspendedUsers = profiles.filter(
      (item) => item.account_status === "suspended"
    ).length;

    const blockedUsers = profiles.filter(
      (item) => item.account_status === "blocked"
    ).length;

    const readyProducts = products.filter(
      (item) =>
        item.safety_status === "clear" &&
        item.verification_status !== "review"
    ).length;

    const reviewProducts = products.filter(
      (item) =>
        item.verification_status === "review" ||
        item.safety_status === "review"
    ).length;

    const lockedProducts = products.filter(
      (item) =>
        item.safety_status === "locked" ||
        item.safety_status === "violation"
    ).length;

    const completedVideos = videos.filter(
      (item) => item.status === "completed"
    ).length;

    const processingVideos = videos.filter(
      (item) =>
        item.status === "processing" ||
        item.status === "pending"
    ).length;

    const failedVideos = videos.filter(
      (item) => item.status === "failed"
    ).length;

    const completedDesigns = designs.filter(
      (item) =>
        item.status === "completed" ||
        item.status === "generated"
    ).length;

    const completedMarketing = marketing.filter(
      (item) => item.status === "completed"
    ).length;

    return {
      users: profiles.length,
      activeUsers,
      suspendedUsers,
      blockedUsers,
      shops: shops.length,
      products: products.length,
      readyProducts,
      reviewProducts,
      lockedProducts,
      designs: designs.length,
      completedDesigns,
      videos: videos.length,
      completedVideos,
      processingVideos,
      failedVideos,
      marketing: marketing.length,
      completedMarketing,
      moderation: moderation.length,
      activity: activity.length,
      aiUsage: aiUsage.length,
    };
  }, [
    profiles,
    shops,
    products,
    designs,
    videos,
    marketing,
    moderation,
    activity,
    aiUsage,
  ]);

  const recentUsers = profiles.slice(0, 8);
  const recentProducts = products.slice(0, 8);
  const recentVideos = videos.slice(0, 6);
  const recentActivity = activity.slice(0, 10);

  const getStatusLabel = (status) => {
    const map = {
      active: "نشط",
      suspended: "موقوف",
      blocked: "محظور",
      pending: "بانتظار",
      processing: "قيد المعالجة",
      completed: "مكتمل",
      failed: "فشل",
      review: "مراجعة",
      clear: "سليم",
      locked: "مقفل",
      violation: "مخالفة",
    };

    return map[status] || status || "غير محدد";
  };

  const getStatusStyle = (status) => {
    if (
      [
        "active",
        "completed",
        "clear",
        "approved",
      ].includes(status)
    ) {
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (
      [
        "processing",
        "pending",
        "review",
        "suspended",
      ].includes(status)
    ) {
      return {
        background: "#fef3c7",
        color: "#92400e",
      };
    }

    if (
      [
        "failed",
        "blocked",
        "locked",
        "violation",
      ].includes(status)
    ) {
      return {
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    return {
      background: "#f3f4f6",
      color: "#374151",
    };
  };

  const formatDate = (date) => {
    if (!date) return "—";

    try {
      return new Date(date).toLocaleString("ar-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "—";
    }
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}>⟳</div>
          <h2>جاري تحميل لوحة Super Admin</h2>
          <p>يتم جمع الإحصائيات والبيانات...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <div style={styles.deniedBox}>
          <div style={styles.deniedIcon}>🔒</div>
          <h1>غير مصرح</h1>
          <p>{error || "ليس لديك صلاحية الدخول لهذه الصفحة."}</p>

          <Link href="/dashboard" style={styles.primaryButton}>
            العودة للوحة التحكم
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <section style={styles.header}>
          <div>
            <div style={styles.eyebrow}>SUQ AI · CONTROL CENTER</div>

            <h1 style={styles.title}>لوحة Super Admin</h1>

            <p style={styles.subtitle}>
              التحكم الكامل في المستخدمين والمتاجر والمنتجات والمحتوى
              والعمليات الذكية.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={loadAdminData}
              style={styles.secondaryButton}
            >
              ↻ تحديث البيانات
            </button>

            <Link href="/dashboard" style={styles.primaryButton}>
              لوحة التاجر
            </Link>
          </div>
        </section>

        {/* Main stats */}
        <section style={styles.statsGrid}>
          <StatCard
            icon="👥"
            title="المستخدمون"
            value={stats.users}
            subtitle={`${stats.activeUsers} نشط`}
          />

          <StatCard
            icon="🏪"
            title="المتاجر"
            value={stats.shops}
            subtitle="إجمالي المتاجر"
          />

          <StatCard
            icon="📦"
            title="المنتجات"
            value={stats.products}
            subtitle={`${stats.readyProducts} جاهز`}
          />

          <StatCard
            icon="🎨"
            title="التصاميم"
            value={stats.designs}
            subtitle={`${stats.completedDesigns} مكتمل`}
          />

          <StatCard
            icon="🎬"
            title="الفيديوهات"
            value={stats.videos}
            subtitle={`${stats.completedVideos} مكتمل`}
          />

          <StatCard
            icon="📣"
            title="التسويق"
            value={stats.marketing}
            subtitle={`${stats.completedMarketing} مكتمل`}
          />

          <StatCard
            icon="⚠️"
            title="تحتاج مراجعة"
            value={stats.reviewProducts}
            subtitle="منتجات"
            warning
          />

          <StatCard
            icon="🔒"
            title="منتجات مقفلة"
            value={stats.lockedProducts}
            subtitle="تحتاج تدخل إداري"
            danger
          />
        </section>

        {/* Control cards */}
        <section style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>مركز التحكم</h2>
              <p style={styles.sectionSubtitle}>
                الوصول السريع إلى أهم أجزاء الإدارة.
              </p>
            </div>
          </div>

          <div style={styles.controlGrid}>
            <AdminLink
              href="/admin/users"
              icon="👥"
              title="المستخدمون"
              description="الحسابات والحالات والصلاحيات"
              count={stats.users}
            />

            <AdminLink
              href="/admin/shops"
              icon="🏪"
              title="المتاجر"
              description="إدارة المتاجر والحالات"
              count={stats.shops}
            />

            <AdminLink
              href="/admin/products"
              icon="📦"
              title="المنتجات"
              description="المراجعة والقفل والاعتماد"
              count={stats.products}
            />

            <AdminLink
              href="/admin/moderation"
              icon="🛡️"
              title="المراجعة"
              description="المنتجات التي تحتاج تدخل"
              count={stats.reviewProducts}
              danger={stats.reviewProducts > 0}
            />

            <AdminLink
              href="/admin/activity"
              icon="📝"
              title="سجل النشاط"
              description="آخر العمليات داخل النظام"
              count={stats.activity}
            />

            <AdminLink
              href="/admin/ai-usage"
              icon="🤖"
              title="استخدام AI"
              description="العمليات والاستهلاك والتكلفة"
              count={stats.aiUsage}
            />
          </div>
        </section>

        {/* System status */}
        <section style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>حالة النظام</h2>
              <p style={styles.sectionSubtitle}>
                نظرة سريعة على العمليات الحالية.
              </p>
            </div>
          </div>

          <div style={styles.systemGrid}>
            <SystemItem
              icon="🎬"
              title="فيديوهات قيد المعالجة"
              value={stats.processingVideos}
              status={stats.processingVideos > 0 ? "processing" : "clear"}
            />

            <SystemItem
              icon="❌"
              title="فيديوهات فاشلة"
              value={stats.failedVideos}
              status={stats.failedVideos > 0 ? "failed" : "clear"}
            />

            <SystemItem
              icon="⚠️"
              title="منتجات تحتاج مراجعة"
              value={stats.reviewProducts}
              status={stats.reviewProducts > 0 ? "review" : "clear"}
            />

            <SystemItem
              icon="🔒"
              title="منتجات مقفلة"
              value={stats.lockedProducts}
              status={stats.lockedProducts > 0 ? "locked" : "clear"}
            />
          </div>
        </section>

        {/* Recent users */}
        <section style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>آخر المستخدمين</h2>
              <p style={styles.sectionSubtitle}>
                أحدث الحسابات المسجلة في النظام.
              </p>
            </div>

            <Link href="/admin/users" style={styles.smallLink}>
              عرض الكل ←
            </Link>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>المستخدم</th>
                  <th style={styles.th}>الدور</th>
                  <th style={styles.th}>الحالة</th>
                  <th style={styles.th}>آخر دخول</th>
                  <th style={styles.th}>تاريخ التسجيل</th>
                </tr>
              </thead>

              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.id}>
                    <td style={styles.td}>
                      <div style={styles.userCell}>
                        <div style={styles.avatar}>
                          {(user.full_name || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {user.full_name || "بدون اسم"}
                          </strong>

                          <div style={styles.muted}>
                            {user.phone || "لا يوجد رقم"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={styles.td}>
                      {user.is_super_admin
                        ? "Super Admin"
                        : user.role || "owner"}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...getStatusStyle(user.account_status),
                        }}
                      >
                        {getStatusLabel(user.account_status)}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {formatDate(user.last_login_at)}
                    </td>

                    <td style={styles.td}>
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))}

                {recentUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      لا يوجد مستخدمون.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Products */}
        <section style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>آخر المنتجات</h2>
              <p style={styles.sectionSubtitle}>
                مراقبة حالة المنتجات والتحقق والسلامة.
              </p>
            </div>

            <Link href="/admin/products" style={styles.smallLink}>
              إدارة المنتجات ←
            </Link>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>المنتج</th>
                  <th style={styles.th}>العلامة</th>
                  <th style={styles.th}>النوع</th>
                  <th style={styles.th}>التحقق</th>
                  <th style={styles.th}>السلامة</th>
                  <th style={styles.th}>التاريخ</th>
                </tr>
              </thead>

              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product.id}>
                    <td style={styles.td}>
                      <strong>{product.name || "بدون اسم"}</strong>

                      {product.category && (
                        <div style={styles.muted}>
                          {product.category}
                        </div>
                      )}
                    </td>

                    <td style={styles.td}>
                      {product.brand || "—"}
                    </td>

                    <td style={styles.td}>
                      {product.product_type === "imported"
                        ? "مستورد"
                        : "محلي"}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...getStatusStyle(
                            product.verification_status
                          ),
                        }}
                      >
                        {getStatusLabel(
                          product.verification_status
                        )}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...getStatusStyle(
                            product.safety_status
                          ),
                        }}
                      >
                        {getStatusLabel(product.safety_status)}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {formatDate(product.created_at)}
                    </td>
                  </tr>
                ))}

                {recentProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={styles.emptyCell}>
                      لا توجد منتجات.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Videos */}
        <section style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>آخر الفيديوهات</h2>
              <p style={styles.sectionSubtitle}>
                متابعة عمليات إنشاء الفيديوهات.
              </p>
            </div>

            <Link href="/videos" style={styles.smallLink}>
              مركز الفيديو ←
            </Link>
          </div>

          <div style={styles.cardsGrid}>
            {recentVideos.map((video) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                style={styles.videoCard}
              >
                <div style={styles.videoIcon}>🎬</div>

                <div style={{ flex: 1 }}>
                  <strong>
                    {video.title || "فيديو إعلاني"}
                  </strong>

                  <div style={styles.videoMeta}>
                    {video.provider || "غير محدد"} ·{" "}
                    {formatDate(video.created_at)}
                  </div>
                </div>

                <span
                  style={{
                    ...styles.badge,
                    ...getStatusStyle(video.status),
                  }}
                >
                  {getStatusLabel(video.status)}
                </span>
              </Link>
            ))}

            {recentVideos.length === 0 && (
              <div style={styles.emptyBox}>
                لا توجد فيديوهات حتى الآن.
              </div>
            )}
          </div>
        </section>

        {/* Activity */}
        <section style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>آخر النشاطات</h2>
              <p style={styles.sectionSubtitle}>
                آخر العمليات المسجلة في النظام.
              </p>
            </div>

            <Link href="/admin/activity" style={styles.smallLink}>
              سجل النشاط ←
            </Link>
          </div>

          <div style={styles.activityList}>
            {recentActivity.map((item) => (
              <div key={item.id} style={styles.activityItem}>
                <div style={styles.activityIcon}>•</div>

                <div style={{ flex: 1 }}>
                  <strong>
                    {item.description ||
                      item.action ||
                      "عملية"}
                  </strong>

                  <div style={styles.muted}>
                    {item.entity_type || "system"}
                    {item.entity_id
                      ? ` · ${item.entity_id}`
                      : ""}
                  </div>
                </div>

                <div style={styles.activityDate}>
                  {formatDate(item.created_at)}
                </div>
              </div>
            ))}

            {recentActivity.length === 0 && (
              <div style={styles.emptyBox}>
                لا توجد نشاطات مسجلة.
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer style={styles.footer}>
          <div>
            <strong>SUQ AI</strong>
            <span> · Super Admin Control Center</span>
          </div>

          <div>
            المستخدمون: {stats.users} · المتاجر: {stats.shops} ·
            المنتجات: {stats.products}
          </div>
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  warning,
  danger,
}) {
  return (
    <div
      style={{
        ...styles.statCard,
        ...(warning ? styles.warningCard : {}),
        ...(danger ? styles.dangerCard : {}),
      }}
    >
      <div style={styles.statIcon}>{icon}</div>

      <div style={styles.statContent}>
        <div style={styles.statTitle}>{title}</div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statSubtitle}>{subtitle}</div>
      </div>
    </div>
  );
}

function AdminLink({
  href,
  icon,
  title,
  description,
  count,
  danger,
}) {
  return (
    <Link
      href={href}
      style={{
        ...styles.adminLink,
        ...(danger ? styles.adminLinkDanger : {}),
      }}
    >
      <div style={styles.adminLinkIcon}>{icon}</div>

      <div style={{ flex: 1 }}>
        <div style={styles.adminLinkTitle}>{title}</div>

        <div style={styles.adminLinkDescription}>
          {description}
        </div>
      </div>

      <div style={styles.adminLinkCount}>{count}</div>
    </Link>
  );
}

function SystemItem({
  icon,
  title,
  value,
  status,
}) {
  return (
    <div style={styles.systemItem}>
      <div style={styles.systemIcon}>{icon}</div>

      <div style={{ flex: 1 }}>
        <div style={styles.systemTitle}>{title}</div>

        <div style={styles.systemValue}>{value}</div>
      </div>

      <span
        style={{
          ...styles.statusDot,
          ...getDotStyle(status),
        }}
      />
    </div>
  );
}

function getDotStyle(status) {
  if (status === "failed" || status === "locked") {
    return {
      background: "#dc2626",
    };
  }

  if (status === "processing" || status === "review") {
    return {
      background: "#f59e0b",
    };
  }

  return {
    background: "#16a34a",
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 38%, #ffffff 100%)",
    direction: "rtl",
    color: "#17211b",
    fontFamily:
      "Arial, Tahoma, sans-serif",
  },

  container: {
    maxWidth: "1450px",
    margin: "0 auto",
    padding: "28px 18px 60px",
  },

  loadingBox: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "20px",
  },

  spinner: {
    fontSize: "42px",
    color: "#16a34a",
    marginBottom: "12px",
  },

  deniedBox: {
    maxWidth: "520px",
    margin: "100px auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "36px",
    textAlign: "center",
    boxShadow: "0 15px 50px rgba(0,0,0,0.08)",
    border: "1px solid #dcfce7",
  },

  deniedIcon: {
    fontSize: "52px",
    marginBottom: "14px",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "28px",
    flexWrap: "wrap",
  },

  eyebrow: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#16a34a",
    letterSpacing: "1.5px",
    marginBottom: "8px",
    direction: "ltr",
    textAlign: "right",
  },

  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: "900",
    color: "#14532d",
  },

  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: "15px",
    lineHeight: 1.8,
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#16a34a",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "12px",
    padding: "11px 17px",
    fontWeight: "800",
    border: "none",
    cursor: "pointer",
  },

  secondaryButton: {
    background: "#ffffff",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "12px",
    padding: "11px 17px",
    fontWeight: "800",
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    marginBottom: "30px",
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #dcfce7",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    gap: "14px",
    alignItems: "center",
    boxShadow: "0 8px 30px rgba(22,101,52,0.05)",
  },

  warningCard: {
    borderColor: "#fde68a",
    background: "#fffbeb",
  },

  dangerCard: {
    borderColor: "#fecaca",
    background: "#fff7f7",
  },

  statIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dcfce7",
    fontSize: "24px",
    flexShrink: 0,
  },

  statContent: {
    minWidth: 0,
  },

  statTitle: {
    fontSize: "13px",
    color: "#64748b",
    marginBottom: "4px",
  },

  statValue: {
    fontSize: "28px",
    fontWeight: "900",
    color: "#14532d",
    lineHeight: 1,
  },

  statSubtitle: {
    marginTop: "5px",
    fontSize: "12px",
    color: "#94a3b8",
  },

  section: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "20px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
  },

  sectionTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    marginBottom: "18px",
    flexWrap: "wrap",
  },

  sectionTitle: {
    margin: 0,
    color: "#14532d",
    fontSize: "21px",
    fontWeight: "900",
  },

  sectionSubtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },

  smallLink: {
    color: "#16a34a",
    textDecoration: "none",
    fontWeight: "800",
    fontSize: "13px",
  },

  controlGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
  },

  adminLink: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #dcfce7",
    background: "#f8fff9",
    textDecoration: "none",
    color: "#17211b",
    transition: "0.2s",
  },

  adminLinkDanger: {
    borderColor: "#fde68a",
    background: "#fffbeb",
  },

  adminLinkIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dcfce7",
    fontSize: "22px",
    flexShrink: 0,
  },

  adminLinkTitle: {
    fontWeight: "900",
    color: "#14532d",
    marginBottom: "4px",
  },

  adminLinkDescription: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  adminLinkCount: {
    minWidth: "34px",
    height: "34px",
    padding: "0 9px",
    borderRadius: "10px",
    background: "#ffffff",
    border: "1px solid #bbf7d0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    color: "#166534",
  },

  systemGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },

  systemItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  systemIcon: {
    fontSize: "23px",
  },

  systemTitle: {
    fontSize: "13px",
    color: "#64748b",
  },

  systemValue: {
    marginTop: "3px",
    fontSize: "23px",
    fontWeight: "900",
    color: "#0f172a",
  },

  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: "15px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
  },

  th: {
    padding: "13px 14px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "900",
    textAlign: "right",
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "14px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
    color: "#334155",
    verticalAlign: "middle",
  },

  userCell: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  avatar: {
    width: "38px",
    height: "38px",
    borderRadius: "11px",
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
  },

  muted: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "4px",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: "900",
    whiteSpace: "nowrap",
  },

  emptyCell: {
    textAlign: "center",
    padding: "30px",
    color: "#94a3b8",
  },

  cardsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "10px",
  },

  videoCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "15px",
    borderRadius: "15px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#17211b",
    textDecoration: "none",
  },

  videoIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
    flexShrink: 0,
  },

  videoMeta: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "5px",
  },

  emptyBox: {
    padding: "25px",
    borderRadius: "15px",
    background: "#f8fafc",
    color: "#94a3b8",
    textAlign: "center",
  },

  activityList: {
    display: "flex",
    flexDirection: "column",
  },

  activityItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 4px",
    borderBottom: "1px solid #f1f5f9",
  },

  activityIcon: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "#dcfce7",
    color: "#16a34a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  activityDate: {
    color: "#94a3b8",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    flexWrap: "wrap",
    padding: "18px 4px",
    color: "#94a3b8",
    fontSize: "12px",
  },
};
