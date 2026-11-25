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

        {isLocked && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "#dc2626",
              color: "#ffffff",
              padding: "7px 10px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "bold",
            }}
          >
            🔒 مقفل
          </div>
        )}
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
              {product.price} AED
            </div>
          )}

        <div
          style={{
            display: "flex",
            gap: "7px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <StatusBadge
            text={
              isCompleted
                ? "✓ مكتمل"
                : "⏳ قيد المعالجة"
            }
            success={isCompleted}
          />

          {product.verification_status && (
            <StatusBadge
              text={
                product.verification_status ===
                "verified"
                  ? "✓ موثّق"
                  : product.verification_status ===
                    "locked"
                  ? "🔒 مقفل"
                  : "مراجعة"
              }
              success={
                product.verification_status ===
                "verified"
              }
            />
          )}
        </div>

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
            }}
          >
            🗑️ حذف
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ text, success }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 8px",
        borderRadius: "8px",
        background: success
          ? "#ecfdf5"
          : "#fff7ed",
        color: success
          ? "#047857"
          : "#c2410c",
        fontSize: "12px",
        fontWeight: "bold",
      }}
    >
      {text}
    </span>
  );
}
