"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function ProductsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: currentShop, error: shopError } =
        await supabase
          .from("shops")
          .select("id, name, status")
          .eq("owner_id", user.id)
          .maybeSingle();

      if (shopError) {
        console.error(shopError);
        setError("تعذر الوصول إلى بيانات المحل.");
        return;
      }

      if (!currentShop) {
        router.replace("/setup-shop");
        return;
      }

      setShop(currentShop);

      const { data, error: productsError } =
        await supabase
          .from("products")
          .select("*")
          .eq("shop_id", currentShop.id)
          .order("created_at", {
            ascending: false,
          });

      if (productsError) {
        console.error(productsError);
        setError("تعذر تحميل المنتجات.");
        return;
      }

      setProducts(data || []);
    } catch (err) {
      console.error(err);
      setError("حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المنتج "${product.name}"؟\n\nسيتم حذف المنتج ومحتواه المرتبط به.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const { error: deleteError } =
        await supabase
          .from("products")
          .delete()
          .eq("id", product.id)
          .eq("shop_id", shop.id);

      if (deleteError) {
        console.error(deleteError);
        setError("تعذر حذف المنتج.");
        return;
      }

      setProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حذف المنتج.");
    }
  }

  const productStats = useMemo(() => {
    let ready = 0;
    let review = 0;
    let locked = 0;
    let processing = 0;

    for (const product of products) {
      const status = getProductStatus(product);

      if (status === "locked") {
        locked++;
      } else if (status === "review") {
        review++;
      } else if (status === "processing") {
        processing++;
      } else {
        ready++;
      }
    }

    return {
      total: products.length,
      ready,
      review,
      locked,
      processing,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [
          product.name,
          product.brand,
          product.category,
          product.model_number,
          product.barcode,
          product.description,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );

      if (!matchesSearch) {
        return false;
      }

      const status = getProductStatus(product);

      if (filter === "ready") {
        return status === "ready";
      }

      if (filter === "review") {
        return status === "review";
      }

      if (filter === "locked") {
        return status === "locked";
      }

      if (filter === "processing") {
        return status === "processing";
      }

      return true;
    });
  }, [products, search, filter]);

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
          padding: "24px",
        }}
      >
        جاري تحميل المنتجات...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "15px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div>
            <Link
              href="/dashboard"
              style={{
                textDecoration: "none",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              ← لوحة التحكم
            </Link>

            <h1
              style={{
                margin: "10px 0 5px",
                fontSize: "30px",
                color: "#111827",
              }}
            >
              منتجاتي
            </h1>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              إدارة منتجات {shop?.name || "المحل"} ومعلوماتها وذكائها التسويقي.
            </p>
          </div>

          <Link
            href="/add-product"
            style={{
              textDecoration: "none",
              background: "#111827",
              color: "#ffffff",
              padding: "13px 18px",
              borderRadius: "12px",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            ➕ إضافة منتج
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px",
              borderRadius: "14px",
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              lineHeight: "1.7",
            }}
          >
            {error}
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <StatCard
            icon="📦"
            title="كل المنتجات"
            value={productStats.total}
          />

          <StatCard
            icon="🟢"
            title="جاهزة"
            value={productStats.ready}
          />

          <StatCard
            icon="🟡"
            title="تحتاج مراجعة"
            value={productStats.review}
          />

          <StatCard
            icon="⏳"
            title="قيد المعالجة"
            value={productStats.processing}
          />

          <StatCard
            icon="🔴"
            title="مقفلة"
            value={productStats.locked}
          />
        </div>

        {/* Search + Filters */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: "1 1 280px",
                position: "relative",
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم المنتج أو البراند أو التصنيف..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "13px 15px",
                  borderRadius: "12px",
                  border: "1px solid #d1d5db",
                  outline: "none",
                  fontSize: "14px",
                  background: "#ffffff",
                  color: "#111827",
                }}
              />
            </div>

            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              text={`الكل (${productStats.total})`}
            />

            <FilterButton
              active={filter === "ready"}
              onClick={() => setFilter("ready")}
              text={`🟢 جاهز (${productStats.ready})`}
            />

            <FilterButton
              active={filter === "review"}
              onClick={() => setFilter("review")}
              text={`🟡 مراجعة (${productStats.review})`}
            />

            <FilterButton
              active={filter === "processing"}
              onClick={() => setFilter("processing")}
              text={`⏳ معالجة (${productStats.processing})`}
            />

            <FilterButton
              active={filter === "locked"}
              onClick={() => setFilter("locked")}
              text={`🔴 مقفل (${productStats.locked})`}
            />
          </div>
        </div>

        {/* Status Explanation */}
        {products.length > 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "15px 18px",
              marginBottom: "20px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "9px",
                color: "#111827",
              }}
            >
              حالات المنتج
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <StatusBadge
                text="🟢 جاهز للاستخدام"
                type="clear"
              />

              <StatusBadge
                text="🟡 يحتاج مراجعة"
                type="review"
              />

              <StatusBadge
                text="⏳ قيد المعالجة"
                type="processing"
              />

              <StatusBadge
                text="🔴 مقفل"
                type="locked"
              />
            </div>
          </div>
        )}

        {/* No products at all */}
        {products.length === 0 ? (
          <EmptyState />
        ) : filteredProducts.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              border: "1px solid #e5e7eb",
              padding: "45px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "45px",
                marginBottom: "10px",
              }}
            >
              🔎
            </div>

            <h2
              style={{
                margin: "0 0 8px",
                color: "#111827",
              }}
            >
              لا توجد نتائج
            </h2>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
              }}
            >
              جرّب تغيير كلمة البحث أو الفلتر.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(290px, 1fr))",
              gap: "18px",
            }}
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onDelete={deleteProduct}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ProductCard({ product, onDelete }) {
  const status = getProductStatus(product);

  const isLocked = status === "locked";
  const isUnclear = status === "review";
  const isProcessing = status === "processing";

  const statusInfo = getStatusInfo(status);

  const isCompleted =
    product.ai_status === "completed";

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "20px",
        overflow: "hidden",
        border: isLocked
          ? "2px solid #dc2626"
          : isUnclear
          ? "2px solid #f59e0b"
          : isProcessing
          ? "2px solid #d97706"
          : "1px solid #e5e7eb",
        boxShadow: "0 5px 20px rgba(0,0,0,0.04)",
      }}
    >
      {/* Image */}
      <div
        style={{
          height: "230px",
          background: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name || "منتج"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <div
            style={{
              fontSize: "55px",
            }}
          >
            📦
          </div>
        )}

        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
          }}
        >
          <StatusBadge
            text={statusInfo.text}
            type={statusInfo.type}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "18px" }}>
        <h2
          style={{
            margin: "0 0 7px",
            color: "#111827",
            fontSize: "19px",
          }}
        >
          {product.name || "منتج بدون اسم"}
        </h2>

        {product.brand && (
          <div
            style={{
              color: "#6b7280",
              fontSize: "14px",
              marginBottom: "6px",
            }}
          >
            {product.brand}
          </div>
        )}

        {product.category && (
          <div
            style={{
              color: "#9ca3af",
              fontSize: "13px",
              marginBottom: "10px",
            }}
          >
            {product.category}
          </div>
        )}

        {product.price !== null &&
          product.price !== undefined && (
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#111827",
                marginBottom: "12px",
              }}
            >
              {product.price} {product.currency || "AED"}
            </div>
          )}

        {/* AI / Verification */}
        <div
          style={{
            display: "flex",
            gap: "7px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <StatusBadge
            text={
              isCompleted
                ? "✓ تحليل AI مكتمل"
                : "⏳ تحليل AI"
            }
            type={
              isCompleted
                ? "clear"
                : "processing"
            }
          />

          {product.product_type && (
            <span
              style={{
                display: "inline-block",
                padding: "5px 8px",
                borderRadius: "8px",
                background: "#f3f4f6",
                color: "#4b5563",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              {product.product_type === "imported"
                ? "مستورد"
                : "محلي"}
            </span>
          )}
        </div>

        {/* Verification */}
        {product.verification_status && (
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginBottom: "12px",
            }}
          >
            حالة التحقق:{" "}
            <strong style={{ color: "#374151" }}>
              {getVerificationLabel(
                product.verification_status
              )}
            </strong>
          </div>
        )}

        {/* Responsibility notice */}
        {isUnclear && !isLocked && (
          <div
            style={{
              background: "#fff8e1",
              border: "1px solid #f0d98a",
              borderRadius: "12px",
              padding: "11px",
              marginBottom: "14px",
              color: "#7c5a00",
              fontSize: "13px",
              lineHeight: "1.7",
            }}
          >
            ⚠️ المعلومات غير مكتملة أو غير واضحة.
            <br />
            عند استخدام المنتج للتسويق أو التصميم،
            سيطلب منك تأكيد مسؤوليتك عنه.
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "12px",
              padding: "11px",
              marginBottom: "14px",
              color: "#9a3412",
              fontSize: "13px",
              lineHeight: "1.7",
            }}
          >
            ⏳ يجري تحليل المنتج والتحقق من معلوماته.
            <br />
            ستظهر الحالة النهائية بعد اكتمال المعالجة.
          </div>
        )}

        {/* Locked notice */}
        {isLocked && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              padding: "11px",
              marginBottom: "14px",
              color: "#991b1b",
              fontSize: "13px",
              lineHeight: "1.7",
            }}
          >
            🔒 هذا المنتج مقفل حاليًا.
            <br />
            لا يمكن استخدامه في التسويق أو التصاميم أو
            الفيديو حتى تتم مراجعته.
            {product.safety_reason && (
              <>
                <br />
                <strong>السبب:</strong>{" "}
                {product.safety_reason}
              </>
            )}
          </div>
        )}

        {/* Main buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          <Link
            href={`/product-intelligence/${product.id}`}
            style={{
              textDecoration: "none",
              textAlign: "center",
              padding: "11px 8px",
              borderRadius: "10px",
              background: "#f3f4f6",
              color: "#111827",
              fontSize: "13px",
              fontWeight: "bold",
            }}
          >
            🧠 الذكاء
          </Link>

          <Link
            href={`/edit-product/${product.id}`}
            style={{
              textDecoration: "none",
              textAlign: "center",
              padding: "11px 8px",
              borderRadius: "10px",
              background: "#f3f4f6",
              color: "#111827",
              fontSize: "13px",
              fontWeight: "bold",
            }}
          >
            ✏️ تعديل
          </Link>

          {!isLocked && (
            <>
              <Link
                href={`/marketing/${product.id}`}
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  padding: "11px 8px",
                  borderRadius: "10px",
                  background: "#111827",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                🚀 التسويق
              </Link>

              <Link
                href={`/videos/new?product=${product.id}`}
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  padding: "11px 8px",
                  borderRadius: "10px",
                  background: "#111827",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                🎬 الفيديو
              </Link>

              <Link
                href={`/designs?product=${product.id}`}
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  padding: "11px 8px",
                  borderRadius: "10px",
                  background: "#111827",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "bold",
                  gridColumn: "1 / -1",
                }}
              >
                🎨 إنشاء تصميم
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => onDelete(product)}
            style={{
              padding: "11px 8px",
              borderRadius: "10px",
              border: "1px solid #fecaca",
              background: "#fff",
              color: "#b91c1c",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              gridColumn: "1 / -1",
            }}
          >
            🗑️ حذف المنتج
          </button>
        </div>
      </div>
    </div>
  );
}

function getProductStatus(product) {
  if (!product) {
    return "review";
  }

  const safetyStatus = String(
    product.safety_status || ""
  ).toLowerCase();

  const verificationStatus = String(
    product.verification_status || ""
  ).toLowerCase();

  const safetyLevel = String(
    product.safety_level || ""
  ).toLowerCase();

  if (
    safetyStatus === "locked" ||
    safetyStatus === "violation" ||
    verificationStatus === "locked" ||
    verificationStatus === "violation" ||
    safetyLevel === "critical"
  ) {
    return "locked";
  }

  if (
    product.ai_status === "pending" ||
    product.ai_status === "processing" ||
    product.ai_status === "analyzing"
  ) {
    return "processing";
  }

  if (isProductUnclear(product)) {
    return "review";
  }

  if (
    verificationStatus === "verified" ||
    verificationStatus === "approved" ||
    verificationStatus === "clear"
  ) {
    return "ready";
  }

  return "review";
}

function isProductUnclear(product) {
  if (!product) {
    return true;
  }

  const verificationStatus = String(
    product.verification_status || ""
  ).toLowerCase();

  if (
    verificationStatus === "review" ||
    verificationStatus === "unverified" ||
    verificationStatus === "pending"
  ) {
    return true;
  }

  const confidence = String(
    product.confidence || ""
  ).toLowerCase();

  if (
    confidence === "low" ||
    confidence === "منخفض" ||
    confidence === "medium" ||
    confidence === "متوسط"
  ) {
    return true;
  }

  if (
    product.name &&
    (!product.brand ||
      !product.category ||
      !product.description)
  ) {
    return true;
  }

  return false;
}

function getStatusInfo(status) {
  if (status === "ready") {
    return {
      text: "🟢 جاهز للاستخدام",
      type: "clear",
    };
  }

  if (status === "locked") {
    return {
      text: "🔴 مقفل",
      type: "locked",
    };
  }

  if (status === "processing") {
    return {
      text: "⏳ قيد المعالجة",
      type: "processing",
    };
  }

  return {
    text: "🟡 يحتاج مراجعة",
    type: "review",
  };
}

function getVerificationLabel(status) {
  const value = String(status || "").toLowerCase();

  if (
    value === "verified" ||
    value === "approved" ||
    value === "clear"
  ) {
    return "موثّق";
  }

  if (
    value === "review" ||
    value === "pending"
  ) {
    return "يحتاج مراجعة";
  }

  if (
    value === "unverified"
  ) {
    return "غير موثّق بعد";
  }

  if (
    value === "locked" ||
    value === "violation"
  ) {
    return "مقفل";
  }

  return status || "غير محدد";
}

function StatCard({ icon, title, value }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "15px",
      }}
    >
      <div
        style={{
          fontSize: "22px",
          marginBottom: "7px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#6b7280",
          fontSize: "12px",
          marginBottom: "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#111827",
          fontSize: "23px",
          fontWeight: "bold",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, text }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "11px 13px",
        borderRadius: "11px",
        border: active
          ? "1px solid #111827"
          : "1px solid #e5e7eb",
        background: active
          ? "#111827"
          : "#ffffff",
        color: active
          ? "#ffffff"
          : "#374151",
        fontSize: "13px",
        fontWeight: "bold",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </button>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "22px",
        padding: "55px 25px",
        textAlign: "center",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: "52px",
          marginBottom: "12px",
        }}
      >
        📦
      </div>

      <h2
        style={{
          margin: "0 0 8px",
          color: "#111827",
        }}
      >
        لا توجد منتجات
      </h2>

      <p
        style={{
          color: "#6b7280",
          marginBottom: "20px",
        }}
      >
        أضف أول منتج إلى محلك للبدء.
      </p>

      <Link
        href="/add-product"
        style={{
          display: "inline-block",
          textDecoration: "none",
          background: "#111827",
          color: "#ffffff",
          padding: "13px 20px",
          borderRadius: "12px",
          fontWeight: "bold",
        }}
      >
        ➕ إضافة أول منتج
      </Link>
    </div>
  );
}

function StatusBadge({ text, type }) {
  const styles = {
    clear: {
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    },

    review: {
      background: "#fff7ed",
      color: "#c2410c",
      border: "1px solid #fed7aa",
    },

    processing: {
      background: "#fff7ed",
      color: "#b45309",
      border: "1px solid #fcd34d",
    },

    locked: {
      background: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
    },
  };

  const style = styles[type] || styles.review;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 9px",
        borderRadius: "9px",
        background: style.background,
        color: style.color,
        border: style.border,
        fontSize: "12px",
        fontWeight: "bold",
      }}
    >
      {text}
    </span>
  );
}
