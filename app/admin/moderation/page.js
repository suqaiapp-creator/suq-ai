"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const STATUS_FILTERS = [
  { id: "all", label: "الكل" },
  { id: "review", label: "مراجعة" },
  { id: "violation", label: "مخالفة" },
  { id: "locked", label: "مقفل" },
];

const LEVEL_FILTERS = [
  { id: "all", label: "كل الخطورة" },
  { id: "low", label: "منخفض" },
  { id: "medium", label: "متوسط" },
  { id: "high", label: "مرتفع" },
  { id: "critical", label: "حرج" },
];

const STATUS_META = {
  review: {
    label: "يحتاج مراجعة",
    icon: "🟡",
    color: "#92400e",
    bg: "#fef3c7",
  },
  violation: {
    label: "مخالفة",
    icon: "⛔",
    color: "#991b1b",
    bg: "#fee2e2",
  },
  locked: {
    label: "مقفل",
    icon: "🔒",
    color: "#991b1b",
    bg: "#fee2e2",
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

function getModerationStatus(item) {
  const status = normalize(item?.status);

  if (
    status === "violation" ||
    status === "locked" ||
    status === "review"
  ) {
    return status;
  }

  const action = normalize(item?.action);

  if (
    action === "violation" ||
    action === "lock"
  ) {
    return action === "lock"
      ? "locked"
      : "violation";
  }

  return "review";
}

export default function AdminModerationPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [moderationItems, setModerationItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const [selectedItem, setSelectedItem] = useState(null);
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

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            "id,is_super_admin,role,account_status"
          )
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        router.replace("/dashboard");
        return;
      }

      const [
        moderationResult,
        productsResult,
        shopsResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("product_moderation")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("products")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("shops")
          .select(
            "id,owner_id,name,status,phone,email,emirate,country"
          ),

        supabase
          .from("profiles")
          .select(
            "id,full_name,phone,role,account_status,is_super_admin"
          ),
      ]);

      if (moderationResult.error) {
        throw moderationResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (shopsResult.error) {
        throw shopsResult.error;
      }

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      setModerationItems(
        moderationResult.data || []
      );

      setProducts(productsResult.data || []);
      setShops(shopsResult.data || []);
      setProfiles(profilesResult.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل مركز المراجعة."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const productMap = useMemo(() => {
    const map = {};

    for (const product of products) {
      map[product.id] = product;
    }

    return map;
  }, [products]);

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

  const enrichedItems = useMemo(() => {
    return moderationItems.map((item) => {
      const product = productMap[item.product_id];
      const shop = product?.shop_id
        ? shopMap[product.shop_id]
        : null;

      const owner = shop?.owner_id
        ? profileMap[shop.owner_id]
        : null;

      const admin = item.admin_id
        ? profileMap[item.admin_id]
        : null;

      return {
        ...item,
        moderationStatus:
          getModerationStatus(item),
        product,
        shop,
        owner,
        admin,
      };
    });
  }, [
    moderationItems,
    productMap,
    shopMap,
    profileMap,
  ]);

  const currentQueue = useMemo(() => {
    const latestByProduct = {};

    for (const item of enrichedItems) {
      const productId = item.product_id;

      if (!productId) continue;

      if (!latestByProduct[productId]) {
        latestByProduct[productId] = item;
      }
    }

    return Object.values(latestByProduct);
  }, [enrichedItems]);

  const filteredItems = useMemo(() => {
    const q = normalize(search);

    return currentQueue.filter((item) => {
      const matchesStatus =
        statusFilter === "all" ||
        item.moderationStatus === statusFilter;

      const matchesLevel =
        levelFilter === "all" ||
        normalize(item.level || "low") ===
          levelFilter;

      if (!q) {
        return (
          matchesStatus &&
          matchesLevel
        );
      }

      const haystack = [
        item.product?.name,
        item.product?.brand,
        item.product?.category,
        item.product?.model_number,
        item.product?.barcode,
        item.shop?.name,
        item.owner?.full_name,
        item.owner?.phone,
        item.reason,
        item.notes,
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
    currentQueue,
    search,
    statusFilter,
    levelFilter,
  ]);

  const stats = useMemo(() => {
    return {
      total: currentQueue.length,

      review: currentQueue.filter(
        (item) =>
          item.moderationStatus === "review"
      ).length,

      violation: currentQueue.filter(
        (item) =>
          item.moderationStatus === "violation"
      ).length,

      locked: currentQueue.filter(
        (item) =>
          item.moderationStatus === "locked"
      ).length,

      critical: currentQueue.filter(
        (item) =>
          normalize(item.level) === "critical"
      ).length,

      high: currentQueue.filter(
        (item) =>
          normalize(item.level) === "high"
      ).length,
    };
  }, [currentQueue]);

  async function writeActivity(
    item,
    action,
    description,
    metadata = {}
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase
        .from("activity_logs")
        .insert({
          user_id:
            item?.shop?.owner_id || null,
          shop_id:
            item?.product?.shop_id || null,
          action,
          entity_type: "product",
          entity_id:
            item?.product_id || null,
          description,
          metadata: {
            ...metadata,
            actor_id: user?.id || null,
          },
        });
    } catch (err) {
      console.error(
        "Activity log error:",
        err
      );
    }
  }

  async function applyDecision(
    item,
    decision,
    reason
  ) {
    if (!item?.product?.id) {
      setError(
        "تعذر العثور على المنتج المرتبط."
      );
      return;
    }

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

      const product = item.product;

      let productUpdate = {
        updated_at:
          new Date().toISOString(),
      };

      let moderationStatus = "review";
      let moderationAction = "review";

      if (decision === "approve") {
        productUpdate = {
          ...productUpdate,

          safety_status: "clear",
          safety_level: "low",
          safety_reason: null,

          verification_status: "verified",
          verification_notes:
            reason ||
            "تم اعتماد المنتج من Super Admin.",

          locked_at: null,
          locked_by: null,

          approved_by: user.id,
          approved_at:
            new Date().toISOString(),
        };

        moderationStatus = "approved";
        moderationAction = "approve";
      }

      if (decision === "review") {
        productUpdate = {
          ...productUpdate,

          safety_status: "review",
          safety_level:
            product.safety_level ===
            "critical"
              ? "high"
              : product.safety_level ||
                "medium",

          safety_reason:
            reason ||
            "تم تحويل المنتج للمراجعة.",

          verification_status: "review",

          verification_notes:
            reason || null,

          locked_at: null,
          locked_by: null,

          approved_by: null,
          approved_at: null,
        };

        moderationStatus = "review";
        moderationAction = "review";
      }

      if (decision === "lock") {
        productUpdate = {
          ...productUpdate,

          safety_status: "locked",

          safety_level:
            product.safety_level ===
            "critical"
              ? "critical"
              : product.safety_level ===
                "high"
              ? "high"
              : "high",

          safety_reason:
            reason ||
            "تم قفل المنتج من Super Admin.",

          verification_status:
            "review",

          verification_notes:
            reason || null,

          locked_at:
            new Date().toISOString(),

          locked_by: user.id,

          approved_by: null,
          approved_at: null,
        };

        moderationStatus = "locked";
        moderationAction = "lock";
      }

      if (decision === "violation") {
        productUpdate = {
          ...productUpdate,

          safety_status: "violation",

          safety_level:
            product.safety_level ===
            "critical"
              ? "critical"
              : "high",

          safety_reason:
            reason ||
            "تم تسجيل مخالفة على المنتج.",

          verification_status:
            "violation",

          verification_notes:
            reason || null,

          locked_at:
            new Date().toISOString(),

          locked_by: user.id,

          approved_by: null,
          approved_at: null,
        };

        moderationStatus =
          "violation";

        moderationAction =
          "violation";
      }

      const { data: updatedProduct, error: productError } =
        await supabase
          .from("products")
          .update(productUpdate)
          .eq("id", product.id)
          .select("*")
          .single();

      if (productError) {
        throw productError;
      }

      const { error: moderationError } =
        await supabase
          .from("product_moderation")
          .insert({
            product_id: product.id,
            action: moderationAction,
            status: moderationStatus,
            reason:
              reason ||
              null,
            level:
              updatedProduct?.safety_level ||
              product.safety_level ||
              "low",
            notes: null,
            admin_id: user.id,
          });

      if (moderationError) {
        throw moderationError;
      }

      await writeActivity(
        {
          ...item,
          product: {
            ...product,
            ...updatedProduct,
          },
        },
        `moderation_${decision}`,
        `تم اتخاذ إجراء ${decision} على المنتج "${product.name}".`,
        {
          decision,
          reason:
            reason || null,
          previous_status:
            item.moderationStatus,
          new_status:
            moderationStatus,
        }
      );

      setProducts((current) =>
        current.map((p) =>
          p.id === product.id
            ? {
                ...p,
                ...updatedProduct,
              }
            : p
        )
      );

      await loadData();

      setMessage(
        decision === "approve"
          ? "تم اعتماد المنتج بنجاح."
          : decision === "review"
          ? "تم تحويل المنتج للمراجعة."
          : decision === "lock"
          ? "تم قفل المنتج بنجاح."
          : "تم تسجيل المخالفة وقفل المنتج."
      );

      setShowDetails(false);
      setSelectedItem(null);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر تنفيذ القرار الإداري."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove(item) {
    const reason = window.prompt(
      "سبب الاعتماد (اختياري):",
      "تمت مراجعة المنتج واعتماده."
    );

    if (reason === null) return;

    await applyDecision(
      item,
      "approve",
      reason.trim()
    );
  }

  async function handleReview(item) {
    const reason = window.prompt(
      "سبب تحويل المنتج للمراجعة:",
      item.reason ||
        "المعلومات تحتاج مراجعة إضافية."
    );

    if (reason === null) return;

    await applyDecision(
      item,
      "review",
      reason.trim()
    );
  }

  async function handleLock(item) {
    const reason = window.prompt(
      "سبب قفل المنتج:",
      item.reason ||
        "تم قفل المنتج للمراجعة الإدارية."
    );

    if (reason === null) return;

    if (!reason.trim()) {
      alert("اكتب سبب القفل أولاً.");
      return;
    }

    await applyDecision(
      item,
      "lock",
      reason.trim()
    );
  }

  async function handleViolation(item) {
    const reason = window.prompt(
      "سبب تسجيل المخالفة:",
      item.reason ||
        "مخالفة تستوجب تدخل الإدارة."
    );

    if (reason === null) return;

    if (!reason.trim()) {
      alert("اكتب سبب المخالفة أولاً.");
      return;
    }

    await applyDecision(
      item,
      "violation",
      reason.trim()
    );
  }

  function openDetails(item) {
    setSelectedItem(item);
    setShowDetails(true);
    setMessage("");
    setError("");
  }

  function closeDetails() {
    if (actionLoading) return;

    setShowDetails(false);
    setSelectedItem(null);
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />

          <h2 style={styles.loadingTitle}>
            جاري تحميل مركز المراجعة...
          </h2>

          <p style={styles.muted}>
            يتم تحميل قائمة المنتجات التي
            تحتاج تدخل إداري.
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
            <div style={styles.badge}>
              SUPER ADMIN
            </div>

            <h1 style={styles.title}>
              مركز المراجعة
            </h1>

            <p style={styles.subtitle}>
              مكان واحد لمراجعة المنتجات
              التي تحتاج قرارًا إداريًا.
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
              href="/admin/products"
              style={styles.secondaryButton}
            >
              إدارة المنتجات
            </Link>

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
            <strong>
              تم بنجاح
            </strong>

            <span>
              {message}
            </span>
          </div>
        )}

        {error && (
          <div style={styles.errorAlert}>
            <strong>
              تنبيه
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}

        <section style={styles.statsGrid}>
          <StatCard
            icon="📋"
            label="إجمالي الحالات"
            value={stats.total}
          />

          <StatCard
            icon="🟡"
            label="تحتاج مراجعة"
            value={stats.review}
            color="#92400e"
          />

          <StatCard
            icon="⛔"
            label="مخالفات"
            value={stats.violation}
            color="#991b1b"
          />

          <StatCard
            icon="🔒"
            label="مقفلة"
            value={stats.locked}
            color="#991b1b"
          />

          <StatCard
            icon="🚨"
            label="حرج"
            value={stats.critical}
            color="#991b1b"
          />

          <StatCard
            icon="⚠️"
            label="مرتفع"
            value={stats.high}
            color="#c2410c"
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
              placeholder="ابحث باسم المنتج، المتجر، صاحب الحساب، الباركود..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterSection}>
            <span style={styles.filterLabel}>
              الحالة:
            </span>

            <div style={styles.filters}>
              {STATUS_FILTERS.map(
                (filter) => (
                  <button
                    key={filter.id}
                    onClick={() =>
                      setStatusFilter(
                        filter.id
                      )
                    }
                    style={{
                      ...styles.filterButton,
                      ...(statusFilter ===
                      filter.id
                        ? styles.filterButtonActive
                        : {}),
                    }}
                  >
                    {filter.label}
                  </button>
                )
              )}
            </div>
          </div>

          <div style={styles.filterSection}>
            <span style={styles.filterLabel}>
              الخطورة:
            </span>

            <div style={styles.filters}>
              {LEVEL_FILTERS.map(
                (filter) => (
                  <button
                    key={filter.id}
                    onClick={() =>
                      setLevelFilter(
                        filter.id
                      )
                    }
                    style={{
                      ...styles.filterButton,
                      ...(levelFilter ===
                      filter.id
                        ? styles.filterButtonActive
                        : {}),
                    }}
                  >
                    {filter.label}
                  </button>
                )
              )}
            </div>
          </div>
        </section>

        <section style={styles.infoCard}>
          <div style={styles.infoIcon}>
            🛡️
          </div>

          <div>
            <strong style={styles.infoTitle}>
              نظام المراجعة
            </strong>

            <p style={styles.infoText}>
              عدم وضوح المعلومات لا يعني
              تلقائيًا وجود مخالفة. يتم تحويل
              الحالات غير الواضحة للمراجعة،
              بينما الحالات التي تحتوي على
              مخالفة واضحة يمكن قفلها واتخاذ
              إجراء إداري عليها.
            </p>
          </div>
        </section>

        <section style={styles.resultsHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              قائمة المراجعة
            </h2>

            <p style={styles.resultCount}>
              عرض {filteredItems.length} من{" "}
              {currentQueue.length} حالة
            </p>
          </div>
        </section>

        {filteredItems.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>
              ✅
            </div>

            <h3 style={styles.emptyTitle}>
              لا توجد حالات معلقة
            </h3>

            <p style={styles.muted}>
              لا توجد منتجات تحتاج تدخلًا
              إداريًا حسب الفلاتر الحالية.
            </p>
          </div>
        ) : (
          <section style={styles.grid}>
            {filteredItems.map((item) => (
              <ModerationCard
                key={item.id}
                item={item}
                onOpen={() =>
                  openDetails(item)
                }
              />
            ))}
          </section>
        )}
      </div>

      {showDetails &&
        selectedItem && (
          <div
            style={styles.modalOverlay}
            onMouseDown={(e) => {
              if (
                e.target ===
                e.currentTarget
              ) {
                closeDetails();
              }
            }}
          >
            <div style={styles.modal}>
              <div style={styles.modalHeader}>
                <div>
                  <div
                    style={
                      styles.modalBadge
                    }
                  >
                    MODERATION CASE
                  </div>

                  <h2
                    style={
                      styles.modalTitle
                    }
                  >
                    {selectedItem.product
                      ?.name ||
                      "منتج"}
                  </h2>

                  <p
                    style={
                      styles.muted
                    }
                  >
                    {selectedItem.shop
                      ?.name ||
                      "متجر غير معروف"}
                  </p>
                </div>

                <button
                  onClick={
                    closeDetails
                  }
                  style={
                    styles.closeButton
                  }
                  disabled={
                    actionLoading
                  }
                >
                  ×
                </button>
              </div>

              <div
                style={
                  styles.modalBody
                }
              >
                <div
                  style={
                    styles.productHero
                  }
                >
                  {selectedItem
                    .product
                    ?.image_url ? (
                    <img
                      src={
                        selectedItem
                          .product
                          .image_url
                      }
                      alt={
                        selectedItem
                          .product
                          .name ||
                        "منتج"
                      }
                      style={
                        styles.productImage
                      }
                    />
                  ) : (
                    <div
                      style={
                        styles.imagePlaceholder
                      }
                    >
                      📦
                    </div>
                  )}

                  <div
                    style={
                      styles.heroInfo
                    }
                  >
                    <div
                      style={
                        styles.statusLine
                      }
                    >
                      <StatusBadge
                        status={
                          selectedItem.moderationStatus
                        }
                      />

                      <LevelBadge
                        level={
                          selectedItem.level ||
                          "low"
                        }
                      />
                    </div>

                    <div
                      style={
                        styles.metaGrid
                      }
                    >
                      <InfoItem
                        label="العلامة"
                        value={
                          selectedItem
                            .product
                            ?.brand ||
                          "—"
                        }
                      />

                      <InfoItem
                        label="الفئة"
                        value={
                          selectedItem
                            .product
                            ?.category ||
                          "—"
                        }
                      />

                      <InfoItem
                        label="الموديل"
                        value={
                          selectedItem
                            .product
                            ?.model_number ||
                          "—"
                        }
                      />

                      <InfoItem
                        label="الباركود"
                        value={
                          selectedItem
                            .product
                            ?.barcode ||
                          "—"
                        }
                      />

                      <InfoItem
                        label="الإجراء"
                        value={
                          selectedItem
                            .action ||
                          "—"
                        }
                      />

                      <InfoItem
                        label="تاريخ الحالة"
                        value={formatDate(
                          selectedItem.created_at
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={
                    styles.detailSection
                  }
                >
                  <h3
                    style={
                      styles.detailTitle
                    }
                  >
                    سبب المراجعة
                  </h3>

                  <div
                    style={
                      styles.reasonBox
                    }
                  >
                    <p
                      style={
                        styles.reasonText
                      }
                    >
                      {selectedItem.reason ||
                        selectedItem
                          .product
                          ?.safety_reason ||
                        selectedItem
                          .product
                          ?.verification_notes ||
                        "لا يوجد سبب مسجل."}
                    </p>
                  </div>
                </div>

                <div
                  style={
                    styles.detailSection
                  }
                >
                  <h3
                    style={
                      styles.detailTitle
                    }
                  >
                    بيانات صاحب المنتج
                  </h3>

                  <div
                    style={
                      styles.detailGrid
                    }
                  >
                    <InfoItem
                      label="المتجر"
                      value={
                        selectedItem
                          .shop?.name ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="صاحب المتجر"
                      value={
                        selectedItem
                          .owner
                          ?.full_name ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="الهاتف"
                      value={
                        selectedItem
                          .owner?.phone ||
                        selectedItem
                          .shop
                          ?.phone ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="الإمارة"
                      value={
                        selectedItem
                          .shop
                          ?.emirate ||
                        "—"
                      }
                    />
                  </div>
                </div>

                <div
                  style={
                    styles.detailSection
                  }
                >
                  <h3
                    style={
                      styles.detailTitle
                    }
                  >
                    قرار الإدارة
                  </h3>

                  <div
                    style={
                      styles.actionGrid
                    }
                  >
                    <button
                      onClick={() =>
                        handleApprove(
                          selectedItem
                        )
                      }
                      style={{
                        ...styles.actionButton,
                        ...styles.approveButton,
                      }}
                      disabled={
                        actionLoading
                      }
                    >
                      🟢 اعتماد المنتج
                    </button>

                    <button
                      onClick={() =>
                        handleReview(
                          selectedItem
                        )
                      }
                      style={{
                        ...styles.actionButton,
                        ...styles.reviewButton,
                      }}
                      disabled={
                        actionLoading
                      }
                    >
                      🟡 إبقاءه للمراجعة
                    </button>

                    <button
                      onClick={() =>
                        handleLock(
                          selectedItem
                        )
                      }
                      style={{
                        ...styles.actionButton,
                        ...styles.lockButton,
                      }}
                      disabled={
                        actionLoading
                      }
                    >
                      🔒 قفل المنتج
                    </button>

                    <button
                      onClick={() =>
                        handleViolation(
                          selectedItem
                        )
                      }
                      style={{
                        ...styles.actionButton,
                        ...styles.violationButton,
                      }}
                      disabled={
                        actionLoading
                      }
                    >
                      ⛔ تسجيل مخالفة
                    </button>
                  </div>

                  {actionLoading && (
                    <p
                      style={
                        styles.actionLoading
                      }
                    >
                      جاري تنفيذ القرار...
                    </p>
                  )}
                </div>

                <div
                  style={
                    styles.modalFooter
                  }
                >
                  {selectedItem.product
                    ?.id && (
                    <Link
                      href={`/products/${selectedItem.product.id}`}
                      style={
                        styles.secondaryButton
                      }
                    >
                      صفحة المنتج
                    </Link>
                  )}

                  <Link
                    href="/admin/products"
                    style={
                      styles.secondaryButton
                    }
                  >
                    إدارة المنتجات
                  </Link>

                  <button
                    onClick={
                      closeDetails
                    }
                    style={
                      styles.primaryButton
                    }
                    disabled={
                      actionLoading
                    }
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
      <div style={styles.statIcon}>
        {icon}
      </div>

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
      <span
        style={styles.infoItemLabel}
      >
        {label}
      </span>

      <strong
        style={styles.infoItemValue}
      >
        {value}
      </strong>
    </div>
  );
}

function ModerationCard({
  item,
  onOpen,
}) {
  return (
    <article style={styles.card}>
      <div style={styles.cardTop}>
        <div
          style={
            styles.productThumbWrap
          }
        >
          {item.product
            ?.image_url ? (
            <img
              src={
                item.product
                  .image_url
              }
              alt={
                item.product
                  ?.name ||
                "منتج"
              }
              style={
                styles.productThumb
              }
            />
          ) : (
            <div
              style={
                styles.thumbPlaceholder
              }
            >
              📦
            </div>
          )}
        </div>

        <div
          style={styles.cardMain}
        >
          <div
            style={
              styles.cardBadges
            }
          >
            <StatusBadge
              status={
                item.moderationStatus
              }
            />

            <LevelBadge
              level={
                item.level ||
                "low"
              }
            />
          </div>

          <h3
            style={
              styles.productName
            }
          >
            {item.product
              ?.name ||
              "منتج بدون اسم"}
          </h3>

          <p
            style={
              styles.productBrand
            }
          >
            {item.product
              ?.brand ||
              item.product
                ?.category ||
              "بدون علامة"}
          </p>

          <div
            style={
              styles.cardShop
            }
          >
            🏪{" "}
            {item.shop
              ?.name ||
              "متجر غير معروف"}
          </div>
        </div>
      </div>

      <div
        style={
          styles.reasonCard
        }
      >
        <span
          style={
            styles.reasonLabel
          }
        >
          سبب الحالة
        </span>

        <strong
          style={
            styles.reasonValue
          }
        >
          {item.reason ||
            item.product
              ?.safety_reason ||
            item.product
              ?.verification_notes ||
            "لا يوجد سبب مسجل."}
        </strong>
      </div>

      <div
        style={
          styles.cardMeta
        }
      >
        <span>
          👤{" "}
          {item.owner
            ?.full_name ||
            "صاحب المتجر"}
        </span>

        <span>
          🕒{" "}
          {formatDate(
            item.created_at
          )}
        </span>
      </div>

      <div
        style={
          styles.cardFooter
        }
      >
        <span
          style={
            styles.actionLabel
          }
        >
          {item.action ||
            "review"}
        </span>

        <button
          onClick={onOpen}
          style={
            styles.openButton
          }
        >
          فتح الحالة
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
    padding:
      "32px 18px 60px",
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
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
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
    margin:
      "10px 0 0",
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
    padding:
      "12px 18px",
    background: "#15803d",
    color: "#fff",
    fontWeight: "800",
    cursor: "pointer",
    textDecoration:
      "none",
  },

  secondaryButton: {
    border:
      "1px solid #bbf7d0",
    borderRadius: "12px",
    padding:
      "11px 16px",
    background: "#fff",
    color: "#166534",
    fontWeight: "800",
    cursor: "pointer",
    textDecoration:
      "none",
    display: "inline-flex",
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  backButton: {
    borderRadius: "12px",
    padding:
      "12px 16px",
    background: "#14532d",
    color: "#fff",
    fontWeight: "800",
    textDecoration:
      "none",
    display: "inline-flex",
    alignItems:
      "center",
  },

  successAlert: {
    display: "flex",
    gap: "10px",
    alignItems:
      "center",
    padding:
      "14px 16px",
    borderRadius: "14px",
    background: "#dcfce7",
    border:
      "1px solid #86efac",
    color: "#166534",
    marginBottom: "18px",
  },

  errorAlert: {
    display: "flex",
    gap: "10px",
    alignItems:
      "center",
    padding:
      "14px 16px",
    borderRadius: "14px",
    background: "#fee2e2",
    border:
      "1px solid #fecaca",
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
    border:
      "1px solid #dcfce7",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    alignItems:
      "center",
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
    alignItems:
      "center",
    justifyContent:
      "center",
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
    border:
      "1px solid #dcfce7",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "18px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,.04)",
  },

  searchWrap: {
    display: "flex",
    alignItems:
      "center",
    gap: "10px",
    border:
      "1px solid #dbe4e0",
    borderRadius: "14px",
    padding:
      "0 14px",
    background:
      "#f8fafc",
    marginBottom: "15px",
  },

  searchIcon: {
    fontSize: "18px",
  },

  searchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    background:
      "transparent",
    padding:
      "14px 0",
    fontSize: "15px",
    color: "#0f172a",
  },

  filterSection: {
    display: "flex",
    alignItems:
      "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "10px",
  },

  filterLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "800",
  },

  filters: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  filterButton: {
    border:
      "1px solid #dbe4e0",
    background: "#fff",
    color: "#475569",
    padding:
      "9px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
  },

  filterButtonActive: {
    background: "#15803d",
    color: "#fff",
    borderColor: "#15803d",
  },

  infoCard: {
    display: "flex",
    gap: "14px",
    alignItems:
      "flex-start",
    background: "#f0fdf4",
    border:
      "1px solid #bbf7d0",
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
    justifyContent:
      "space-between",
    alignItems:
      "center",
    marginBottom: "14px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "900",
    color: "#14532d",
  },

  resultCount: {
    margin:
      "5px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(330px,1fr))",
    gap: "16px",
  },

  card: {
    background: "#fff",
    border:
      "1px solid #e2e8f0",
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
    border:
      "1px solid #e2e8f0",
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
    alignItems:
      "center",
    justifyContent:
      "center",
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
    alignItems:
      "center",
    gap: "4px",
    borderRadius: "999px",
    padding:
      "5px 9px",
    fontSize: "11px",
    fontWeight: "800",
  },

  levelBadge: {
    display: "inline-flex",
    alignItems:
      "center",
    borderRadius: "999px",
    padding:
      "5px 9px",
    fontSize: "11px",
    fontWeight: "800",
  },

  productName: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "900",
    color: "#0f172a",
    overflow: "hidden",
    textOverflow:
      "ellipsis",
    whiteSpace:
      "nowrap",
  },

  productBrand: {
    margin:
      "5px 0",
    color: "#64748b",
    fontSize: "13px",
  },

  cardShop: {
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
  },

  reasonCard: {
    marginTop: "16px",
    padding:
      "12px 14px",
    borderRadius: "13px",
    background: "#fffbeb",
    border:
      "1px solid #fde68a",
  },

  reasonLabel: {
    display: "block",
    color: "#92400e",
    fontSize: "11px",
    fontWeight: "800",
    marginBottom: "4px",
  },

  reasonValue: {
    display: "block",
    color: "#78350f",
    fontSize: "13px",
    lineHeight: 1.7,
  },

  cardMeta: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "12px",
    color: "#64748b",
    fontSize: "11px",
  },

  cardFooter: {
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap: "10px",
    marginTop: "14px",
    paddingTop: "14px",
    borderTop:
      "1px solid #f1f5f9",
  },

  actionLabel: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "700",
  },

  openButton: {
    border: 0,
    borderRadius: "11px",
    padding:
      "10px 14px",
    background: "#15803d",
    color: "#fff",
    fontWeight: "800",
    cursor: "pointer",
  },

  emptyCard: {
    background: "#fff",
    border:
      "1px solid #e2e8f0",
    borderRadius: "20px",
    padding:
      "55px 20px",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "44px",
    marginBottom: "10px",
  },

  emptyTitle: {
    margin:
      "0 0 7px",
    color: "#14532d",
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.7,
    margin: 0,
  },

  loadingCard: {
    maxWidth: "500px",
    margin:
      "100px auto",
    background: "#fff",
    borderRadius: "20px",
    padding: "35px",
    textAlign: "center",
    border:
      "1px solid #dcfce7",
    boxShadow:
      "0 15px 40px rgba(15,23,42,.06)",
  },

  spinner: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    border:
      "4px solid #dcfce7",
    borderTopColor:
      "#15803d",
    margin:
      "0 auto 18px",
    animation:
      "spin 1s linear infinite",
  },

  loadingTitle: {
    color: "#14532d",
    margin:
      "0 0 8px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background:
      "rgba(15,23,42,.58)",
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
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
    alignItems:
      "flex-start",
    justifyContent:
      "space-between",
    gap: "20px",
    padding: "22px",
    borderBottom:
      "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 2,
  },

  modalBadge: {
    color: "#166534",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing:
      "0.6px",
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
    alignItems:
      "flex-start",
    padding: "16px",
    background:
      "#f8fafc",
    borderRadius: "18px",
  },

  productImage: {
    width: "150px",
    height: "150px",
    objectFit: "cover",
    borderRadius: "16px",
    border:
      "1px solid #e2e8f0",
    background: "#fff",
  },

  imagePlaceholder: {
    width: "150px",
    height: "150px",
    borderRadius: "16px",
    background:
      "#e2e8f0",
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
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
    margin:
      "0 0 10px",
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
    padding: "16px",
    borderRadius: "16px",
    background:
      "#fffbeb",
    border:
      "1px solid #fde68a",
  },

  reasonText: {
    margin: 0,
    color: "#78350f",
    lineHeight: 1.8,
    fontSize: "14px",
  },

  infoItem: {
    minWidth: 0,
    padding: "9px",
    borderRadius: "10px",
    background:
      "#f8fafc",
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
    textOverflow:
      "ellipsis",
    whiteSpace:
      "nowrap",
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
    padding:
      "13px 15px",
    fontWeight: "900",
    cursor: "pointer",
  },

  approveButton: {
    background:
      "#dcfce7",
    color: "#166534",
  },

  reviewButton: {
    background:
      "#fef3c7",
    color: "#92400e",
  },

  lockButton: {
    background:
      "#fee2e2",
    color: "#991b1b",
  },

  violationButton: {
    background:
      "#991b1b",
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
    justifyContent:
      "flex-end",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "25px",
    paddingTop: "18px",
    borderTop:
      "1px solid #e2e8f0",
  },
};
