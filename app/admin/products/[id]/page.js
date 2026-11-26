"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, Link } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";

export default function AdminProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const productId = params?.id;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [owner, setOwner] = useState(null);
  const [moderation, setModeration] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    loadProduct();
  }, [productId]);

  async function loadProduct() {
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
        .select("id, full_name, role, is_super_admin, account_status")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.is_super_admin) {
        router.replace("/dashboard");
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) {
        throw productError;
      }

      setProduct(productData);

      if (productData.shop_id) {
        const { data: shopData } = await supabase
          .from("shops")
          .select("*")
          .eq("id", productData.shop_id)
          .single();

        setShop(shopData || null);

        if (shopData?.owner_id) {
          const { data: ownerData } = await supabase
            .from("profiles")
            .select(
              "id, full_name, phone, role, account_status, suspension_reason, created_at"
            )
            .eq("id", shopData.owner_id)
            .single();

          setOwner(ownerData || null);
        }
      }

      const { data: moderationData } = await supabase
        .from("product_moderation")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      setModeration(moderationData || []);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل بيانات المنتج.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value) {
    if (!value) return "غير متوفر";

    try {
      return new Date(value).toLocaleString("ar-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  }

  function getSafetyLabel(status) {
    switch (status) {
      case "clear":
        return "سليم";
      case "review":
        return "يحتاج مراجعة";
      case "violation":
        return "مخالفة";
      case "locked":
        return "مقفل";
      case "approved":
        return "معتمد";
      default:
        return status || "غير معروف";
    }
  }

  function getSafetyClass(status) {
    switch (status) {
      case "clear":
      case "approved":
        return "safe";

      case "review":
        return "review";

      case "violation":
      case "locked":
        return "danger";

      default:
        return "neutral";
    }
  }

  function getAIStatus(status) {
    switch (status) {
      case "completed":
      case "success":
        return "مكتمل";

      case "processing":
        return "قيد المعالجة";

      case "failed":
        return "فشل";

      case "pending":
        return "بانتظار التحليل";

      default:
        return status || "غير معروف";
    }
  }

  function getVerificationStatus(status) {
    switch (status) {
      case "verified":
        return "موثّق";

      case "unverified":
        return "غير موثّق";

      case "review":
        return "قيد المراجعة";

      case "rejected":
        return "مرفوض";

      default:
        return status || "غير معروف";
    }
  }

  function getModerationAction(action) {
    switch (action) {
      case "approve":
        return "اعتماد المنتج";

      case "lock":
        return "قفل المنتج";

      case "unlock":
        return "فتح المنتج";

      case "review":
        return "إرسال للمراجعة";

      default:
        return action || "إجراء";
    }
  }

  if (loading) {
    return (
      <main dir="rtl" style={styles.page}>
        <div style={styles.loading}>جاري تحميل بيانات المنتج...</div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main dir="rtl" style={styles.page}>
        <div style={styles.topBar}>
          <Link href="/admin/products" style={styles.backButton}>
            ← العودة للمنتجات
          </Link>
        </div>

        <div style={styles.errorBox}>
          {error || "المنتج غير موجود."}
        </div>
      </main>
    );
  }

  const safetyStatus =
    product.safety_status ||
    (product.safety_level === "high" || product.safety_level === "critical"
      ? "review"
      : "clear");

  const isLocked =
    safetyStatus === "locked" ||
    product.safety_status === "locked";

  return (
    <main dir="rtl" style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.topBar}>
          <div>
            <Link href="/admin" style={styles.homeLink}>
              🏠 الرئيسية
            </Link>

            <span style={styles.separator}>/</span>

            <Link href="/admin/products" style={styles.homeLink}>
              المنتجات
            </Link>

            <span style={styles.separator}>/</span>

            <span style={styles.current}>
              تفاصيل المنتج
            </span>
          </div>

          <Link href="/admin/products" style={styles.backButton}>
            ← العودة للمنتجات
          </Link>
        </div>

        {/* Title */}
        <div style={styles.titleCard}>
          <div>
            <div style={styles.titleRow}>
              <h1 style={styles.title}>
                {product.name || "بدون اسم"}
              </h1>

              {isLocked && (
                <span style={styles.lockBadge}>
                  🔒 مقفل
                </span>
              )}
            </div>

            <p style={styles.subtitle}>
              تفاصيل المنتج ومعلومات التحقق والسلامة
            </p>
          </div>

          <div style={styles.idBox}>
            <span style={styles.idLabel}>Product ID</span>
            <span style={styles.idValue}>{product.id}</span>
          </div>
        </div>

        {/* Main grid */}
        <div style={styles.mainGrid}>
          {/* Image */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🖼️ صورة المنتج</h2>

            <div style={styles.imageContainer}>
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name || "Product"}
                  style={styles.productImage}
                />
              ) : (
                <div style={styles.noImage}>
                  لا توجد صورة
                </div>
              )}
            </div>
          </section>

          {/* Basic information */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>📦 معلومات المنتج</h2>

            <div style={styles.infoGrid}>
              <Info label="اسم المنتج" value={product.name} />
              <Info label="العلامة التجارية" value={product.brand} />
              <Info label="الشركة المصنعة" value={product.manufacturer} />
              <Info label="الفئة" value={product.category} />
              <Info label="رقم الموديل" value={product.model_number} />
              <Info label="الباركود" value={product.barcode} />
              <Info label="نوع المنتج" value={product.product_type} />
              <Info
                label="السعر"
                value={
                  product.price !== null && product.price !== undefined
                    ? `${product.price} ${product.currency || "AED"}`
                    : null
                }
              />
              <Info label="الحجم / السعة" value={product.size_or_volume} />
              <Info label="بلد المنشأ" value={product.country_of_origin} />
              <Info label="الضمان" value={product.warranty} />
              <Info label="التخزين" value={product.storage} />
            </div>
          </section>
        </div>

        {/* Verification + Safety */}
        <div style={styles.twoColumns}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🔍 التحقق</h2>

            <div style={styles.statusBox}>
              <div>
                <span style={styles.smallLabel}>
                  حالة التحقق
                </span>

                <strong style={styles.bigValue}>
                  {getVerificationStatus(
                    product.verification_status
                  )}
                </strong>
              </div>

              <span
                style={{
                  ...styles.statusBadge,
                  ...getSafetyStyle(
                    product.verification_status
                  ),
                }}
              >
                {getVerificationStatus(
                  product.verification_status
                )}
              </span>
            </div>

            <Info
              label="مستوى الثقة"
              value={product.confidence}
            />

            <Info
              label="آخر فحص"
              value={formatDate(product.verification_checked_at)}
            />

            <div style={styles.longInfo}>
              <span style={styles.smallLabel}>
                ملاحظات التحقق
              </span>

              <div style={styles.longText}>
                {product.verification_notes ||
                  "لا توجد ملاحظات."}
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🛡️ السلامة والحماية</h2>

            <div style={styles.statusBox}>
              <div>
                <span style={styles.smallLabel}>
                  الحالة
                </span>

                <strong style={styles.bigValue}>
                  {getSafetyLabel(safetyStatus)}
                </strong>
              </div>

              <span
                style={{
                  ...styles.statusBadge,
                  ...getSafetyStyle(safetyStatus),
                }}
              >
                {isLocked ? "🔒 مقفل" : getSafetyLabel(safetyStatus)}
              </span>
            </div>

            <Info
              label="مستوى الخطورة"
              value={product.safety_level}
            />

            <div style={styles.longInfo}>
              <span style={styles.smallLabel}>
                سبب الحالة
              </span>

              <div style={styles.longText}>
                {product.safety_reason ||
                  "لا يوجد سبب مسجل."}
              </div>
            </div>

            <Info
              label="تاريخ القفل"
              value={formatDate(product.locked_at)}
            />

            <Info
              label="تاريخ الاعتماد"
              value={formatDate(product.approved_at)}
            />
          </section>
        </div>

        {/* AI */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>🤖 حالة الذكاء الاصطناعي</h2>

          <div style={styles.aiGrid}>
            <div style={styles.aiItem}>
              <span style={styles.smallLabel}>
                حالة التحليل
              </span>

              <strong style={styles.aiValue}>
                {getAIStatus(product.ai_status)}
              </strong>
            </div>

            <div style={styles.aiItem}>
              <span style={styles.smallLabel}>
                آخر فحص سلامة
              </span>

              <strong style={styles.aiValue}>
                {formatDate(product.last_checked_at)}
              </strong>
            </div>
          </div>
        </section>

        {/* Description */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>📝 وصف ومعلومات المنتج</h2>

          <LongField
            label="الوصف"
            value={product.description}
          />

          <LongField
            label="المواصفات"
            value={product.specifications}
          />

          <LongField
            label="المميزات"
            value={product.features}
          />

          <LongField
            label="الاستخدامات"
            value={product.uses}
          />

          <LongField
            label="الفئة المستهدفة"
            value={product.target_audience}
          />

          <LongField
            label="المكونات"
            value={product.ingredients}
          />

          <LongField
            label="التحذيرات"
            value={product.warnings}
          />
        </section>

        {/* Shop */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>🏪 المحل والمالك</h2>

          {shop ? (
            <div style={styles.shopGrid}>
              <div style={styles.shopInfo}>
                <span style={styles.smallLabel}>المحل</span>

                <strong style={styles.shopName}>
                  {shop.name || "بدون اسم"}
                </strong>

                <span style={styles.muted}>
                  {shop.description ||
                    "لا يوجد وصف للمحل."}
                </span>
              </div>

              <div style={styles.shopInfo}>
                <span style={styles.smallLabel}>المالك</span>

                <strong style={styles.shopName}>
                  {owner?.full_name || "غير معروف"}
                </strong>

                <span style={styles.muted}>
                  {owner?.account_status || "غير معروف"}
                </span>
              </div>

              <div style={styles.shopInfo}>
                <span style={styles.smallLabel}>الهاتف</span>

                <span>
                  {shop.phone ||
                    shop.whatsapp ||
                    "غير متوفر"}
                </span>
              </div>

              <div style={styles.shopInfo}>
                <span style={styles.smallLabel}>الموقع</span>

                <span>
                  {shop.address ||
                    shop.emirate ||
                    shop.country ||
                    "غير متوفر"}
                </span>
              </div>

              <div style={styles.shopInfo}>
                <span style={styles.smallLabel}>حالة المالك</span>

                <span
                  style={{
                    ...styles.statusBadge,
                    ...getSafetyStyle(
                      owner?.account_status === "active"
                        ? "clear"
                        : "locked"
                    ),
                  }}
                >
                  {owner?.account_status === "active"
                    ? "نشط"
                    : owner?.account_status || "غير معروف"}
                </span>
              </div>
            </div>
          ) : (
            <div style={styles.empty}>
              المنتج غير مرتبط بمحل.
            </div>
          )}
        </section>

        {/* Sources */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>📚 مصادر التحقق</h2>

          {Array.isArray(product.sources) &&
          product.sources.length > 0 ? (
            <div style={styles.sources}>
              {product.sources.map((source, index) => {
                const url =
                  typeof source === "string"
                    ? source
                    : source?.url;

                const title =
                  typeof source === "string"
                    ? source
                    : source?.title ||
                      source?.name ||
                      `المصدر ${index + 1}`;

                return (
                  <div
                    key={index}
                    style={styles.sourceItem}
                  >
                    <span style={styles.sourceNumber}>
                      {index + 1}
                    </span>

                    <div style={styles.sourceContent}>
                      <strong>{title}</strong>

                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.sourceLink}
                        >
                          فتح المصدر
                        </a>
                      ) : (
                        <span style={styles.muted}>
                          لا يوجد رابط
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.empty}>
              لا توجد مصادر مسجلة لهذا المنتج.
            </div>
          )}
        </section>

        {/* Moderation history */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>
            📋 سجل المراجعة والموديريشن
          </h2>

          {moderation.length > 0 ? (
            <div style={styles.moderationList}>
              {moderation.map((item) => (
                <div
                  key={item.id}
                  style={styles.moderationItem}
                >
                  <div style={styles.moderationTop}>
                    <strong>
                      {getModerationAction(item.action)}
                    </strong>

                    <span
                      style={{
                        ...styles.statusBadge,
                        ...getSafetyStyle(item.status),
                      }}
                    >
                      {getSafetyLabel(item.status)}
                    </span>
                  </div>

                  <div style={styles.moderationDetails}>
                    <span>
                      المستوى: {item.level || "low"}
                    </span>

                    <span>
                      التاريخ: {formatDate(item.created_at)}
                    </span>
                  </div>

                  {item.reason && (
                    <div style={styles.reason}>
                      <strong>السبب:</strong>{" "}
                      {item.reason}
                    </div>
                  )}

                  {item.notes && (
                    <div style={styles.reason}>
                      <strong>ملاحظات:</strong>{" "}
                      {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>
              لا توجد عمليات مراجعة مسجلة لهذا المنتج.
            </div>
          )}
        </section>

        {/* Dates */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>🕒 التواريخ</h2>

          <div style={styles.infoGrid}>
            <Info
              label="تاريخ إنشاء المنتج"
              value={formatDate(product.created_at)}
            />

            <Info
              label="آخر تحديث"
              value={formatDate(product.updated_at)}
            />

            <Info
              label="آخر فحص"
              value={formatDate(product.last_checked_at)}
            />

            <Info
              label="آخر تحقق"
              value={formatDate(
                product.verification_checked_at
              )}
            />
          </div>
        </section>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        a {
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.smallLabel}>{label}</span>
      <strong style={styles.infoValue}>
        {value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
          ? String(value)
          : "غير متوفر"}
      </strong>
    </div>
  );
}

function LongField({ label, value }) {
  return (
    <div style={styles.longInfo}>
      <span style={styles.smallLabel}>{label}</span>

      <div style={styles.longText}>
        {value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
          ? String(value)
          : "غير متوفر"}
      </div>
    </div>
  );
}

function getSafetyStyle(status) {
  switch (status) {
    case "clear":
    case "approved":
    case "active":
    case "verified":
      return {
        background: "#dcfce7",
        color: "#166534",
      };

    case "review":
    case "pending":
    case "medium":
      return {
        background: "#fef3c7",
        color: "#92400e",
      };

    case "violation":
    case "locked":
    case "blocked":
    case "high":
    case "critical":
      return {
        background: "#fee2e2",
        color: "#991b1b",
      };

    default:
      return {
        background: "#f1f5f9",
        color: "#475569",
      };
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "24px 16px 60px",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },

  container: {
    maxWidth: "1250px",
    margin: "0 auto",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  homeLink: {
    color: "#0f766e",
    fontWeight: "700",
  },

  separator: {
    margin: "0 8px",
    color: "#94a3b8",
  },

  current: {
    color: "#64748b",
  },

  backButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 15px",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    fontWeight: "700",
  },

  titleCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "22px",
    marginBottom: "18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    fontSize: "30px",
    lineHeight: 1.2,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
  },

  idBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 12px",
    maxWidth: "100%",
  },

  idLabel: {
    display: "block",
    fontSize: "11px",
    color: "#64748b",
    marginBottom: "4px",
  },

  idValue: {
    fontSize: "11px",
    wordBreak: "break-all",
    color: "#334155",
  },

  lockBadge: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: "800",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(260px, 360px) minmax(0, 1fr)",
    gap: "18px",
    marginBottom: "18px",
  },

  twoColumns: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    marginBottom: "18px",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "18px",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
  },

  cardTitle: {
    margin: "0 0 18px",
    fontSize: "20px",
  },

  imageContainer: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#f8fafc",
    borderRadius: "14px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #e2e8f0",
  },

  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "#ffffff",
  },

  noImage: {
    color: "#94a3b8",
    fontWeight: "700",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  infoItem: {
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #eef2f7",
    minWidth: 0,
  },

  smallLabel: {
    display: "block",
    fontSize: "12px",
    color: "#64748b",
    marginBottom: "5px",
  },

  infoValue: {
    display: "block",
    fontSize: "14px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },

  statusBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "15px",
    background: "#f8fafc",
    borderRadius: "13px",
    marginBottom: "14px",
  },

  bigValue: {
    display: "block",
    fontSize: "18px",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  longInfo: {
    marginTop: "15px",
  },

  longText: {
    background: "#f8fafc",
    border: "1px solid #eef2f7",
    borderRadius: "12px",
    padding: "13px",
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#334155",
    minHeight: "45px",
  },

  aiGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  aiItem: {
    padding: "15px",
    background: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #eef2f7",
  },

  aiValue: {
    fontSize: "16px",
  },

  shopGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  shopInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "14px",
    background: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #eef2f7",
  },

  shopName: {
    fontSize: "16px",
  },

  muted: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },

  sources: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  sourceItem: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    padding: "13px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #eef2f7",
  },

  sourceNumber: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    flexShrink: 0,
  },

  sourceContent: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: 0,
  },

  sourceLink: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: "13px",
  },

  moderationList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  moderationItem: {
    padding: "15px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "13px",
  },

  moderationTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  moderationDetails: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: "12px",
    marginTop: "9px",
  },

  reason: {
    marginTop: "10px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px",
    lineHeight: 1.7,
    color: "#334155",
  },

  empty: {
    padding: "20px",
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
    borderRadius: "12px",
  },

  loading: {
    maxWidth: "600px",
    margin: "100px auto",
    textAlign: "center",
    padding: "30px",
    background: "#ffffff",
    borderRadius: "18px",
    border: "1px solid #e2e8f0",
    color: "#64748b",
  },

  errorBox: {
    maxWidth: "700px",
    margin: "40px auto",
    padding: "20px",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "14px",
    textAlign: "center",
    fontWeight: "700",
  },
};
