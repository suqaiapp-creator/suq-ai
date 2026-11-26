"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const STATUS_FILTERS = [
  { id: "all", label: "الكل" },
  { id: "ready", label: "جاهز" },
  { id: "review", label: "مراجعة" },
  { id: "locked", label: "مقفل" },
  { id: "violation", label: "مخالفة" },
  { id: "processing", label: "قيد المعالجة" },
];

function getProductStatus(product) {
  const safetyStatus = String(product?.safety_status || "").toLowerCase();
  const aiStatus = String(product?.ai_status || "").toLowerCase();
  const verification = String(
    product?.verification_status || ""
  ).toLowerCase();

  if (
    safetyStatus === "locked" ||
    safetyStatus === "violation" ||
    product?.locked_at
  ) {
    return "locked";
  }

  if (
    safetyStatus === "violation" ||
    verification === "violation"
  ) {
    return "violation";
  }

  if (
    aiStatus === "processing" ||
    aiStatus === "pending" ||
    aiStatus === "analyzing"
  ) {
    return "processing";
  }

  if (
    safetyStatus === "review" ||
    verification === "review" ||
    verification === "needs_review"
  ) {
    return "review";
  }

  if (
    verification === "verified" ||
    verification === "approved" ||
    safetyStatus === "clear"
  ) {
    return "ready";
  }

  return "review";
}

const STATUS_META = {
  ready: {
    label: "جاهز",
    color: "#166534",
    bg: "#dcfce7",
    icon: "🟢",
  },
  review: {
    label: "يحتاج مراجعة",
    color: "#92400e",
    bg: "#fef3c7",
    icon: "🟡",
  },
  locked: {
    label: "مقفل",
    color: "#991b1b",
    bg: "#fee2e2",
    icon: "🔒",
  },
  violation: {
    label: "مخالفة",
    color: "#991b1b",
    bg: "#fee2e2",
    icon: "⛔",
  },
  processing: {
    label: "قيد المعالجة",
    color: "#1e40af",
    bg: "#dbeafe",
    icon: "⏳",
  },
};

const LEVEL_META = {
  low: {
    label: "منخفض",
    color: "#166534",
    bg: "#dcfce7",
  },
  medium: {
    label: "متوسط",
    color: "#92400e",
    bg: "#fef3c7",
  },
  high: {
    label: "مرتفع",
    color: "#c2410c",
    bg: "#ffedd5",
  },
  critical: {
    label: "حرج",
    color: "#991b1b",
    bg: "#fee2e2",
  },
};

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("ar-AE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export default function AdminProductsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,is_super_admin,role,account_status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        router.replace("/dashboard");
        return;
      }

      const [
        productsResult,
        shopsResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("shops")
          .select(
            "id,owner_id,name,status,phone,email,emirate,country,created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("profiles")
          .select(
            "id,full_name,phone,role,account_status,is_super_admin"
          ),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (shopsResult.error) throw shopsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setProducts(productsResult.data || []);
      setShops(shopsResult.data || []);
      setProfiles(profilesResult.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || "حدث خطأ أثناء تحميل المنتجات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const shopMap = useMemo(() => {
    const map = {};

    for (const shop of shops) {
      map[shop.id] = shop;
    }

    return map;
  }, [shops]);

  const profileMap = useMemo(() => {
    const map = {};

    for (const profile of profiles) {
      map[profile.id] = profile;
    }

    return map;
  }, [profiles]);

  const enrichedProducts = useMemo(() => {
    return products.map((product) => {
      const shop = product.shop_id
        ? shopMap[product.shop_id]
        : null;

      const owner = shop?.owner_id
        ? profileMap[shop.owner_id]
        : null;

      return {
        ...product,
        adminStatus: getProductStatus(product),
        shop,
        owner,
      };
    });
  }, [products, shopMap, profileMap]);

  const filteredProducts = useMemo(() => {
    const q = normalize(search);

    return enrichedProducts.filter((product) => {
      const matchesStatus =
        statusFilter === "all" ||
        product.adminStatus === statusFilter;

      const matchesLevel =
        levelFilter === "all" ||
        normalize(product.safety_level || "low") === levelFilter;

      if (!q) {
        return matchesStatus && matchesLevel;
      }

      const haystack = [
        product.name,
        product.brand,
        product.category,
        product.model_number,
        product.barcode,
        product.manufacturer,
        product.country_of_origin,
        product.shop?.name,
        product.owner?.full_name,
        product.owner?.phone,
        product.description,
      ]
        .map(normalize)
        .join(" ");

      return (
        matchesStatus &&
        matchesLevel &&
        haystack.includes(q)
      );
    });
  }, [
    enrichedProducts,
    search,
    statusFilter,
    levelFilter,
  ]);

  const stats = useMemo(() => {
    return {
      total: enrichedProducts.length,

      ready: enrichedProducts.filter(
        (p) => p.adminStatus === "ready"
      ).length,

      review: enrichedProducts.filter(
        (p) => p.adminStatus === "review"
      ).length,

      locked: enrichedProducts.filter(
        (p) => p.adminStatus === "locked"
      ).length,

      violation: enrichedProducts.filter(
        (p) => p.adminStatus === "violation"
      ).length,

      processing: enrichedProducts.filter(
        (p) => p.adminStatus === "processing"
      ).length,
    };
  }, [enrichedProducts]);

  async function writeActivity(
    product,
    action,
    description,
    metadata = {}
  ) {
    try {
      await supabase.from("activity_logs").insert({
        user_id: product?.shop?.owner_id || null,
        shop_id: product?.shop_id || null,
        action,
        entity_type: "product",
        entity_id: product?.id || null,
        description,
        metadata,
      });
    } catch (err) {
      console.error("Activity log error:", err);
    }
  }

  async function writeModeration(
    product,
    action,
    status,
    reason,
    level
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("product_moderation").insert({
        product_id: product.id,
        action,
        status,
        reason: reason || null,
        level: level || "low",
        notes: null,
        admin_id: user?.id || null,
      });
    } catch (err) {
      console.error("Moderation log error:", err);
    }
  }

  async function updateProductStatus(
    product,
    nextStatus,
    reason = ""
  ) {
    if (!product?.id) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const currentStatus = product.adminStatus;

      let updatePayload = {
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === "ready") {
        updatePayload = {
          ...updatePayload,
          safety_status: "clear",
          safety_level: "low",
          safety_reason: null,
          verification_status: "verified",
          verification_notes:
            reason || "تم اعتماد المنتج من Super Admin.",
          locked_at: null,
          locked_by: null,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        };
      }

      if (nextStatus === "review") {
        updatePayload = {
          ...updatePayload,
          safety_status: "review",
          safety_level:
            product.safety_level === "critical"
              ? "high"
              : product.safety_level || "medium",
          safety_reason:
            reason || "تم تحويل المنتج للمراجعة من Super Admin.",
          verification_status: "review",
          verification_notes: reason || null,
          locked_at: null,
          locked_by: null,
          approved_by: null,
          approved_at: null,
        };
      }

      if (
        nextStatus === "locked" ||
        nextStatus === "violation"
      ) {
        updatePayload = {
          ...updatePayload,
          safety_status:
            nextStatus === "violation"
              ? "violation"
              : "locked",
          safety_level:
            product.safety_level === "critical"
              ? "critical"
              : product.safety_level === "high"
              ? "high"
              : "high",
          safety_reason:
            reason ||
            (nextStatus === "violation"
              ? "تم تسجيل مخالفة من Super Admin."
              : "تم قفل المنتج من Super Admin."),
          verification_status:
            nextStatus === "violation"
              ? "violation"
              : "review",
          verification_notes: reason || null,
          locked_at: new Date().toISOString(),
          locked_by: user.id,
          approved_by: null,
          approved_at: null,
        };
      }

      const { data, error: updateError } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", product.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      const moderationAction =
        nextStatus === "ready"
          ? "approve"
          : nextStatus === "review"
          ? "review"
          : nextStatus === "violation"
          ? "violation"
          : "lock";

      await writeModeration(
        {
          ...product,
          ...data,
        },
        moderationAction,
        nextStatus,
        reason,
        data?.safety_level || product.safety_level || "low"
      );

      await writeActivity(
        {
          ...product,
          ...data,
        },
        `admin_product_${nextStatus}`,
        `تم تغيير حالة المنتج "${product.name}" من ${currentStatus} إلى ${nextStatus}.`,
        {
          previous_status: currentStatus,
          new_status: nextStatus,
          reason: reason || null,
          admin_id: user.id,
        }
      );

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                ...data,
              }
            : item
        )
      );

      setSelectedProduct((current) =>
        current?.id === product.id
          ? {
              ...current,
              ...data,
            }
          : current
      );

      setMessage(
        nextStatus === "ready"
          ? "تم اعتماد المنتج بنجاح."
          : nextStatus === "review"
          ? "تم تحويل المنتج للمراجعة."
          : nextStatus === "violation"
          ? "تم تسجيل المنتج كمخالفة وقفل المنتج."
          : "تم قفل المنتج بنجاح."
      );
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر تحديث حالة المنتج."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove(product) {
    const reason =
      window.prompt(
        "سبب الاعتماد (اختياري):",
        "تمت مراجعة المنتج واعتماده."
      );

    if (reason === null) return;

    await updateProductStatus(
      product,
      "ready",
      reason.trim()
    );
  }

  async function handleReview(product) {
    const reason =
      window.prompt(
        "سبب تحويل المنتج للمراجعة:",
        product.safety_reason ||
          "المعلومات تحتاج مراجعة إضافية."
      );

    if (reason === null) return;

    await updateProductStatus(
      product,
      "review",
      reason.trim()
    );
  }

  async function handleLock(product) {
    const reason =
      window.prompt(
        "سبب قفل المنتج:",
        product.safety_reason ||
          "تم قفل المنتج للمراجعة الإدارية."
      );

    if (reason === null) return;

    if (!reason.trim()) {
      alert("اكتب سبب القفل أولاً.");
      return;
    }

    await updateProductStatus(
      product,
      "locked",
      reason.trim()
    );
  }

  async function handleViolation(product) {
    const reason =
      window.prompt(
        "سبب تسجيل المخالفة:",
        product.safety_reason ||
          "مخالفة تستوجب تدخل الإدارة."
      );

    if (reason === null) return;

    if (!reason.trim()) {
      alert("اكتب سبب المخالفة أولاً.");
      return;
    }

    await updateProductStatus(
      product,
      "violation",
      reason.trim()
    );
  }

  async function handleOpenProduct(product) {
    if (!product?.id) return;

    setSelectedProduct(product);
    setShowDetails(true);
    setMessage("");
    setError("");
  }

  function closeDetails() {
    if (actionLoading) return;

    setShowDetails(false);
    setSelectedProduct(null);
    setMessage("");
    setError("");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <h2 style={styles.loadingTitle}>
            جاري تحميل إدارة المنتجات...
          </h2>
          <p style={styles.muted}>
            يتم التحقق من صلاحيات Super Admin وتحميل البيانات.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.badge}>SUPER ADMIN</div>

            <h1 style={styles.title}>
              إدارة المنتجات
            </h1>

            <p style={styles.subtitle}>
              إدارة جميع منتجات المتاجر ومراجعة
              حالات التحقق والمخاطر والقفل والاعتماد.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={loadData}
              style={styles.secondaryButton}
              disabled={actionLoading}
            >
              ↻ تحديث
            </button>

            <Link
              href="/admin"
              style={styles.backButton}
            >
              لوحة الإدارة
            </Link>
          </div>
        </header>

        {message && (
          <div style={styles.successAlert}>
            <strong>تم بنجاح</strong>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div style={styles.errorAlert}>
            <strong>تنبيه</strong>
            <span>{error}</span>
          </div>
        )}

        <section style={styles.statsGrid}>
          <StatCard
            icon="📦"
            label="إجمالي المنتجات"
            value={stats.total}
          />

          <StatCard
            icon="🟢"
            label="جاهز"
            value={stats.ready}
            color="#166534"
          />

          <StatCard
            icon="🟡"
            label="مراجعة"
            value={stats.review}
            color="#92400e"
          />

          <StatCard
            icon="🔒"
            label="مقفل"
            value={stats.locked}
            color="#991b1b"
          />

          <StatCard
            icon="⛔"
            label="مخالفات"
            value={stats.violation}
            color="#991b1b"
          />

          <StatCard
            icon="⏳"
            label="قيد المعالجة"
            value={stats.processing}
            color="#1e40af"
          />
        </section>

        <section style={styles.controlCard}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>
              🔎
            </span>

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="ابحث باسم المنتج، العلامة، المتجر، الموديل، الباركود..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filters}>
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() =>
                  setStatusFilter(filter.id)
                }
                style={{
                  ...styles.filterButton,
                  ...(statusFilter === filter.id
                    ? styles.filterButtonActive
                    : {}),
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div style={styles.levelRow}>
            <span style={styles.filterLabel}>
              مستوى الخطورة:
            </span>

            {[
              ["all", "الكل"],
              ["low", "منخفض"],
              ["medium", "متوسط"],
              ["high", "مرتفع"],
              ["critical", "حرج"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  setLevelFilter(id)
                }
                style={{
                  ...styles.smallFilter,
                  ...(levelFilter === id
                    ? styles.smallFilterActive
                    : {}),
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.infoCard}>
          <div style={styles.infoIcon}>🛡️</div>

          <div>
            <strong style={styles.infoTitle}>
              قواعد إدارة المنتجات
            </strong>

            <p style={styles.infoText}>
              المنتج الجاهز يمكن استخدامه في
              التسويق والتصاميم والفيديو.
              المنتج الذي يحتاج مراجعة يظهر
              للتاجر بحالة تنبيه، أما المنتج
              المقفل أو المخالف فلا يمكن استخدامه
              في الخدمات التسويقية حتى يتم اتخاذ
              قرار إداري.
            </p>
          </div>
        </section>

        <section style={styles.resultsHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              المنتجات
            </h2>

            <p style={styles.resultCount}>
              عرض {filteredProducts.length} من{" "}
              {enrichedProducts.length}
            </p>
          </div>
        </section>

        {filteredProducts.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>📦</div>

            <h3 style={styles.emptyTitle}>
              لا توجد منتجات
            </h3>

            <p style={styles.muted}>
              لا توجد نتائج مطابقة للبحث أو
              الفلاتر الحالية.
            </p>
          </div>
        ) : (
          <section style={styles.productsGrid}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={() =>
                  handleOpenProduct(product)
                }
              />
            ))}
          </section>
        )}
      </div>

      {showDetails && selectedProduct && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeDetails();
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalBadge}>
                  PRODUCT MODERATION
                </div>

                <h2 style={styles.modalTitle}>
                  {selectedProduct.name ||
                    "منتج بدون اسم"}
                </h2>

                <p style={styles.muted}>
                  {selectedProduct.shop?.name ||
                    "متجر غير معروف"}
                </p>
              </div>

              <button
                onClick={closeDetails}
                style={styles.closeButton}
                disabled={actionLoading}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.productHero}>
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name || "منتج"}
                    style={styles.productImage}
                  />
                ) : (
                  <div style={styles.imagePlaceholder}>
                    📦
                  </div>
                )}

                <div style={styles.heroInfo}>
                  <div style={styles.statusLine}>
                    <StatusBadge
                      status={getProductStatus(
                        selectedProduct
                      )}
                    />

                    <LevelBadge
                      level={
                        selectedProduct.safety_level ||
                        "low"
                      }
                    />
                  </div>

                  <div style={styles.metaGrid}>
                    <InfoItem
                      label="العلامة"
                      value={
                        selectedProduct.brand || "—"
                      }
                    />

                    <InfoItem
                      label="الفئة"
                      value={
                        selectedProduct.category || "—"
                      }
                    />

                    <InfoItem
                      label="الموديل"
                      value={
                        selectedProduct.model_number ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="الباركود"
                      value={
                        selectedProduct.barcode || "—"
                      }
                    />

                    <InfoItem
                      label="نوع المنتج"
                      value={
                        selectedProduct.product_type ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="حالة التحقق"
                      value={
                        selectedProduct.verification_status ||
                        "—"
                      }
                    />
                  </div>
                </div>
              </div>

              <div style={styles.detailSection}>
                <h3 style={styles.detailTitle}>
                  المتجر وصاحب الحساب
                </h3>

                <div style={styles.detailGrid}>
                  <InfoItem
                    label="المتجر"
                    value={
                      selectedProduct.shop?.name ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="صاحب المتجر"
                    value={
                      selectedProduct.owner
                        ?.full_name || "—"
                    }
                  />

                  <InfoItem
                    label="الهاتف"
                    value={
                      selectedProduct.owner?.phone ||
                      selectedProduct.shop?.phone ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="الإمارة"
                    value={
                      selectedProduct.shop?.emirate ||
                      "—"
                    }
                  />
                </div>
              </div>

              <div style={styles.detailSection}>
                <h3 style={styles.detailTitle}>
                  معلومات الذكاء الاصطناعي والتحقق
                </h3>

                <div style={styles.detailGrid}>
                  <InfoItem
                    label="AI Status"
                    value={
                      selectedProduct.ai_status ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Confidence"
                    value={
                      selectedProduct.confidence != null
                        ? `${selectedProduct.confidence}%`
                        : "—"
                    }
                  />

                  <InfoItem
                    label="آخر فحص"
                    value={formatDate(
                      selectedProduct.last_checked_at ||
                        selectedProduct.verification_checked_at
                    )}
                  />

                  <InfoItem
                    label="تاريخ الإنشاء"
                    value={formatDate(
                      selectedProduct.created_at
                    )}
                  />
                </div>
              </div>

              <div style={styles.reasonBox}>
                <div style={styles.reasonHeader}>
                  <span>سبب الحالة / المراجعة</span>

                  <LevelBadge
                    level={
                      selectedProduct.safety_level ||
                      "low"
                    }
                  />
                </div>

                <p style={styles.reasonText}>
                  {selectedProduct.safety_reason ||
                    selectedProduct.verification_notes ||
                    "لا يوجد سبب مسجل."}
                </p>
              </div>

              {selectedProduct.description && (
                <div style={styles.detailSection}>
                  <h3 style={styles.detailTitle}>
                    الوصف
                  </h3>

                  <p style={styles.longText}>
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {selectedProduct.specifications && (
                <div style={styles.detailSection}>
                  <h3 style={styles.detailTitle}>
                    المواصفات
                  </h3>

                  <p style={styles.longText}>
                    {selectedProduct.specifications}
                  </p>
                </div>
              )}

              <div style={styles.actionSection}>
                <h3 style={styles.detailTitle}>
                  الإجراءات الإدارية
                </h3>

                <div style={styles.actionGrid}>
                  <button
                    onClick={() =>
                      handleApprove(
                        selectedProduct
                      )
                    }
                    style={{
                      ...styles.actionButton,
                      ...styles.approveButton,
                    }}
                    disabled={actionLoading}
                  >
                    🟢 اعتماد المنتج
                  </button>

                  <button
                    onClick={() =>
                      handleReview(
                        selectedProduct
                      )
                    }
                    style={{
                      ...styles.actionButton,
                      ...styles.reviewButton,
                    }}
                    disabled={actionLoading}
                  >
                    🟡 تحويل للمراجعة
                  </button>

                  <button
                    onClick={() =>
                      handleLock(
                        selectedProduct
                      )
                    }
                    style={{
                      ...styles.actionButton,
                      ...styles.lockButton,
                    }}
                    disabled={actionLoading}
                  >
                    🔒 قفل المنتج
                  </button>

                  <button
                    onClick={() =>
                      handleViolation(
                        selectedProduct
                      )
                    }
                    style={{
                      ...styles.actionButton,
                      ...styles.violationButton,
                    }}
                    disabled={actionLoading}
                  >
                    ⛔ تسجيل مخالفة
                  </button>
                </div>

                {actionLoading && (
                  <p style={styles.actionLoading}>
                    جاري تنفيذ الإجراء...
                  </p>
                )}
              </div>

              <div style={styles.modalFooter}>
                <Link
                  href={`/products/${selectedProduct.id}`}
                  style={styles.secondaryButton}
                >
                  فتح صفحة المنتج
                </Link>

                <Link
                  href={`/marketing/${selectedProduct.id}`}
                  style={styles.secondaryButton}
                >
                  مركز التسويق
                </Link>

                <button
                  onClick={closeDetails}
                  style={styles.primaryButton}
                  disabled={actionLoading}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  color = "#14532d",
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>

      <div>
        <div style={styles.statLabel}>
          {label}
        </div>

        <div
          style={{
            ...styles.statValue,
            color,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta =
    STATUS_META[status] ||
    STATUS_META.review;

  return (
    <span
      style={{
        ...styles.statusBadge,
        color: meta.color,
        background: meta.bg,
      }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

function LevelBadge({ level }) {
  const meta =
    LEVEL_META[level] ||
    LEVEL_META.low;

  return (
    <span
      style={{
        ...styles.levelBadge,
        color: meta.color,
        background: meta.bg,
      }}
    >
      {meta.label}
    </span>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoItemLabel}>
        {label}
      </span>

      <strong style={styles.infoItemValue}>
        {value}
      </strong>
    </div>
  );
}

function ProductCard({ product, onOpen }) {
  const status =
    getProductStatus(product);

  return (
    <article style={styles.productCard}>
      <div style={styles.cardTop}>
        <div style={styles.productThumbWrap}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name || "منتج"}
              style={styles.productThumb}
            />
          ) : (
            <div style={styles.thumbPlaceholder}>
              📦
            </div>
          )}
        </div>

        <div style={styles.cardMain}>
          <div style={styles.cardBadges}>
            <StatusBadge status={status} />

            <LevelBadge
              level={
                product.safety_level || "low"
              }
            />
          </div>

          <h3 style={styles.productName}>
            {product.name || "منتج بدون اسم"}
          </h3>

          <p style={styles.productBrand}>
            {product.brand ||
              product.category ||
              "بدون علامة تجارية"}
          </p>

          <div style={styles.cardShop}>
            🏪{" "}
            {product.shop?.name ||
              "متجر غير معروف"}
          </div>
        </div>
      </div>

      <div style={styles.cardDetails}>
        <InfoItem
          label="صاحب المتجر"
          value={
            product.owner?.full_name ||
            "—"
          }
        />

        <InfoItem
          label="الباركود"
          value={
            product.barcode || "—"
          }
        />

        <InfoItem
          label="الموديل"
          value={
            product.model_number || "—"
          }
        />

        <InfoItem
          label="التحقق"
          value={
            product.verification_status ||
            "—"
          }
        />
      </div>

      <div style={styles.cardReason}>
        <span>سبب الحالة:</span>

        <strong>
          {product.safety_reason ||
            product.verification_notes ||
            "لا يوجد"}
        </strong>
      </div>

      <div style={styles.cardFooter}>
        <span style={styles.cardDate}>
          {formatDate(
            product.updated_at ||
              product.created_at
          )}
        </span>

        <button
          onClick={onOpen}
          style={styles.openButton}
        >
          إدارة المنتج
        </button>
      </div>
    </article>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg,#f0fdf4 0%,#ffffff 42%,#f8fafc 100%)",
    color: "#0f172a",
    padding: "32px 18px 60px",
    fontFamily:
      "Arial, Tahoma, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1450px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "28px",
  },

  badge: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.5px",
    marginBottom: "10px",
  },

  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.2,
    fontWeight: "900",
    color: "#14532d",
  },

  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: "15px",
    lineHeight: 1.8,
    maxWidth: "760px",
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  primaryButton: {
    border: 0,
    borderRadius: "12px",
    padding: "12px 18px",
    background: "#15803d",
    color: "#fff",
    fontWeight: "800",
    cursor: "pointer",
    textDecoration: "none",
  },

  secondaryButton: {
    border: "1px solid #bbf7d0",
    borderRadius: "12px",
    padding: "11px 16px",
    background: "#fff",
    color: "#166534",
    fontWeight: "800",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  backButton: {
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#14532d",
    color: "#fff",
    fontWeight: "800",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  },

  successAlert: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: "14px",
    background: "#dcfce7",
    border: "1px solid #86efac",
    color: "#166534",
    marginBottom: "18px",
  },

  errorAlert: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: "14px",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    marginBottom: "18px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap: "14px",
    marginBottom: "18px",
  },

  statCard: {
    background: "#fff",
    border: "1px solid #dcfce7",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,.05)",
  },

  statIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "14px",
    background: "#f0fdf4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
  },

  statLabel: {
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "5px",
  },

  statValue: {
    fontSize: "27px",
    fontWeight: "900",
  },

  controlCard: {
    background: "#fff",
    border: "1px solid #dcfce7",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "18px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,.04)",
  },

  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid #dbe4e0",
    borderRadius: "14px",
    padding: "0 14px",
    background: "#f8fafc",
    marginBottom: "14px",
  },

  searchIcon: {
    fontSize: "18px",
  },

  searchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    padding: "14px 0",
    fontSize: "15px",
    color: "#0f172a",
  },

  filters: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  filterButton: {
    border: "1px solid #dbe4e0",
    background: "#fff",
    color: "#475569",
    padding: "9px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
  },

  filterButtonActive: {
    background: "#15803d",
    color: "#fff",
    borderColor: "#15803d",
  },

  levelRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "14px",
  },

  filterLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "700",
    marginLeft: "4px",
  },

  smallFilter: {
    border: "1px solid #dbe4e0",
    background: "#fff",
    color: "#475569",
    padding: "7px 11px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "12px",
  },

  smallFilterActive: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#86efac",
  },

  infoCard: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "24px",
  },

  infoIcon: {
    fontSize: "24px",
  },

  infoTitle: {
    color: "#14532d",
    display: "block",
    marginBottom: "6px",
  },

  infoText: {
    margin: 0,
    color: "#166534",
    lineHeight: 1.8,
    fontSize: "14px",
  },

  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "900",
    color: "#14532d",
  },

  resultCount: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },

  productsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(330px,1fr))",
    gap: "16px",
  },

  productCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "18px",
    boxShadow:
      "0 8px 28px rgba(15,23,42,.05)",
  },

  cardTop: {
    display: "flex",
    gap: "14px",
  },

  productThumbWrap: {
    width: "92px",
    height: "92px",
    flexShrink: 0,
    borderRadius: "16px",
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
  },

  productThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "30px",
  },

  cardMain: {
    minWidth: 0,
    flex: 1,
  },

  cardBadges: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginBottom: "9px",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: "800",
  },

  levelBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: "800",
  },

  productName: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "900",
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  productBrand: {
    margin: "5px 0",
    color: "#64748b",
    fontSize: "13px",
  },

  cardShop: {
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
  },

  cardDetails: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",
    gap: "8px",
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px solid #f1f5f9",
  },

  infoItem: {
    minWidth: 0,
    padding: "8px",
    borderRadius: "10px",
    background: "#f8fafc",
  },

  infoItemLabel: {
    display: "block",
    color: "#94a3b8",
    fontSize: "10px",
    marginBottom: "3px",
  },

  infoItemValue: {
    display: "block",
    color: "#334155",
    fontSize: "12px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  cardReason: {
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "11px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.7,
  },

  cardReason: {
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "11px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.7,
  },

  cardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "14px",
  },

  cardDate: {
    color: "#94a3b8",
    fontSize: "11px",
  },

  openButton: {
    border: 0,
    borderRadius: "11px",
    padding: "10px 14px",
    background: "#15803d",
    color: "#fff",
    fontWeight: "800",
    cursor: "pointer",
  },

  emptyCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "55px 20px",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "44px",
    marginBottom: "10px",
  },

  emptyTitle: {
    margin: "0 0 7px",
    color: "#14532d",
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.7,
    margin: 0,
  },

  loadingCard: {
    maxWidth: "500px",
    margin: "100px auto",
    background: "#fff",
    borderRadius: "20px",
    padding: "35px",
    textAlign: "center",
    border: "1px solid #dcfce7",
    boxShadow:
      "0 15px 40px rgba(15,23,42,.06)",
  },

  spinner: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    border: "4px solid #dcfce7",
    borderTopColor: "#15803d",
    margin: "0 auto 18px",
    animation: "spin 1s linear infinite",
  },

  loadingTitle: {
    color: "#14532d",
    margin: "0 0 8px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(15,23,42,.58)",
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  modal: {
    width: "100%",
    maxWidth: "900px",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: "24px",
    boxShadow:
      "0 30px 80px rgba(15,23,42,.25)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    padding: "22px",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 2,
  },

  modalBadge: {
    color: "#166534",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.6px",
    marginBottom: "6px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "900",
    color: "#14532d",
  },

  closeButton: {
    width: "38px",
    height: "38px",
    border: 0,
    borderRadius: "11px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: "25px",
    cursor: "pointer",
  },

  modalBody: {
    padding: "22px",
  },

  productHero: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "18px",
  },

  productImage: {
    width: "150px",
    height: "150px",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    background: "#fff",
  },

  imagePlaceholder: {
    width: "150px",
    height: "150px",
    borderRadius: "16px",
    background: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "45px",
  },

  heroInfo: {
    flex: 1,
    minWidth: 0,
  },

  statusLine: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "15px",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",
    gap: "8px",
  },

  detailSection: {
    marginTop: "22px",
  },

  detailTitle: {
    margin: "0 0 10px",
    color: "#14532d",
    fontSize: "16px",
    fontWeight: "900",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",
    gap: "10px",
  },

  reasonBox: {
    marginTop: "22px",
    padding: "16px",
    borderRadius: "16px",
    background: "#fffbeb",
    border: "1px solid #fde68a",
  },

  reasonHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
    color: "#92400e",
    fontWeight: "900",
  },

  reasonText: {
    margin: 0,
    color: "#78350f",
    lineHeight: 1.8,
    fontSize: "14px",
  },

  longText: {
    margin: 0,
    padding: "14px",
    borderRadius: "13px",
    background: "#f8fafc",
    color: "#475569",
    lineHeight: 1.8,
    fontSize: "13px",
    whiteSpace: "pre-wrap",
  },

  actionSection: {
    marginTop: "24px",
    paddingTop: "20px",
    borderTop: "1px solid #e2e8f0",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",
    gap: "10px",
  },

  actionButton: {
    border: 0,
    borderRadius: "13px",
    padding: "13px 15px",
    fontWeight: "900",
    cursor: "pointer",
  },

  approveButton: {
    background: "#dcfce7",
    color: "#166534",
  },

  reviewButton: {
    background: "#fef3c7",
    color: "#92400e",
  },

  lockButton: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  violationButton: {
    background: "#991b1b",
    color: "#fff",
  },

  actionLoading: {
    color: "#166534",
    fontSize: "13px",
    fontWeight: "700",
    marginTop: "10px",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "25px",
    paddingTop: "18px",
    borderTop: "1px solid #e2e8f0",
  },
};
