"use client";

import { useEffect, useState } from "react";
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
        current.filter(
          (item) => item.id !== product.id
        )
      );
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حذف المنتج.");
    }
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
          maxWidth: "1100px",
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
                fontSize: "28px",
                color: "#111827",
              }}
            >
              منتجات {shop?.name || "المحل"}
            </h1>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              إدارة منتجات محلك ومعلوماتها التسويقية.
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
              lineHeight: "1.7",
            }}
          >
            {error}
          </div>
        )}

        {/* Status Guide */}
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
              حالة المنتجات
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <StatusBadge
                text="🟢 واضح / موثّق"
                type="clear"
              />

              <StatusBadge
                text="🟡 معلومات غير واضحة"
                type="review"
              />

              <StatusBadge
                text="🔴 مقفل"
                type="locked"
              />
            </div>
          </div>
        )}

        {/* Empty */}
        {products.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "22px",
              padding: "50px 25px",
              textAlign: "center",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "48px",
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
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {products.map((product) => (
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
  const isLocked =
    product.verification_status === "locked" ||
    product.safety_status === "locked";

  const isUnclear = isProductUnclear(product);

  const isCompleted =
    product.ai_status === "completed";

  const isVerified =
    product.verification_status === "verified";

  let statusText = "🟡 معلومات غير واضحة";
  let statusType = "review";

  if (isLocked) {
    statusText = "🔴 مقفل";
    statusType = "locked";
  } else if (isVerified && !isUnclear) {
    statusText = "🟢 واضح / موثّق";
    statusType = "clear";
  }

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
          : "1px solid #e5e7eb",
        boxShadow:
          "0 5px 20px rgba(0,0,0,0.04)",
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
            text={statusText}
            type={statusType}
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
              {product.price}{" "}
              {product.currency || "AED"}
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
                : "review"
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
              {product.product_type ===
              "imported"
                ? "مستورد"
                : "محلي"}
            </span>
          )}
        </div>

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
            ⚠️ المعلومات غير مكتملة أو غير
            واضحة.
            <br />
            عند استخدام المنتج للتسويق أو التصميم،
            سيطلب منك تأكيد مسؤوليتك عنه.
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
            لا يمكن استخدامه في التسويق أو
            التصاميم حتى تتم مراجعته.
            {product.safety_reason && (
              <>
                <br />
                <strong>
                  السبب:
                </strong>{" "}
                {product.safety_reason}
              </>
            )}
          </div>
        )}

        {/* Buttons */}
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
                href="/designs"
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
                🎨 التصميم
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

function isProductUnclear(product) {
  if (!product) {
    return true;
  }

  if (
    product.verification_status === "review" ||
    product.verification_status === "unverified"
  ) {
    return true;
  }

  if (
    product.confidence === "low" ||
    product.confidence === "منخفض" ||
    product.confidence === "medium" ||
    product.confidence === "متوسط"
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
