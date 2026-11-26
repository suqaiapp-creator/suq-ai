"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function MarketingCenterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [marketingContents, setMarketingContents] = useState([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadMarketingCenter();
  }, []);

  async function loadMarketingCenter() {
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
        router.replace("/setup-shop");
        return;
      }

      setShop(shopData);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("*")
          .eq("shop_id", shopData.id)
          .order("created_at", {
            ascending: false,
          });

      if (productError) {
        throw productError;
      }

      const { data: marketingData, error: marketingError } =
        await supabase
          .from("marketing_contents")
          .select("*")
          .eq("shop_id", shopData.id)
          .order("created_at", {
            ascending: false,
          });

      if (marketingError) {
        throw marketingError;
      }

      setProducts(productData || []);
      setMarketingContents(marketingData || []);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل مركز التسويق."
      );
    } finally {
      setLoading(false);
    }
  }

  const latestMarketingByProduct = useMemo(() => {
    const map = new Map();

    for (const item of marketingContents) {
      if (!map.has(item.product_id)) {
        map.set(item.product_id, item);
      }
    }

    return map;
  }, [marketingContents]);

  const marketingProducts = useMemo(() => {
    return products
      .map((product) => {
        const marketing =
          latestMarketingByProduct.get(product.id) || null;

        return {
          product,
          marketing,
        };
      })
      .filter(({ product, marketing }) => {
        const query = search.trim().toLowerCase();

        const matchesSearch =
          !query ||
          [
            product.name,
            product.brand,
            product.category,
            marketing?.marketing_description,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            );

        if (!matchesSearch) {
          return false;
        }

        if (filter === "ready") {
          return Boolean(marketing);
        }

        if (filter === "not_ready") {
          return !marketing;
        }

        if (filter === "locked") {
          return isProductLocked(product);
        }

        if (filter === "review") {
          return (
            !isProductLocked(product) &&
            isProductUnclear(product)
          );
        }

        return true;
      });
  }, [
    products,
    search,
    filter,
    latestMarketingByProduct,
  ]);

  const stats = useMemo(() => {
    const totalProducts = products.length;

    const ready = products.filter((product) =>
      latestMarketingByProduct.has(product.id)
    ).length;

    const notReady = products.filter(
      (product) =>
        !latestMarketingByProduct.has(product.id) &&
        !isProductLocked(product)
    ).length;

    const locked = products.filter((product) =>
      isProductLocked(product)
    ).length;

    const review = products.filter(
      (product) =>
        !isProductLocked(product) &&
        isProductUnclear(product)
    ).length;

    return {
      totalProducts,
      ready,
      notReady,
      locked,
      review,
      totalContents: marketingContents.length,
    };
  }, [
    products,
    marketingContents,
    latestMarketingByProduct,
  ]);

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
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 35,
            textAlign: "center",
            color: "#374151",
          }}
        >
          جاري تحميل مركز التسويق...
        </div>
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
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 15,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <Link
              href="/dashboard"
              style={{
                color: "#6b7280",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              ← لوحة التحكم
            </Link>

            <h1
              style={{
                margin: "10px 0 5px",
                fontSize: 30,
                color: "#111827",
              }}
            >
              🚀 مركز التسويق
            </h1>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                fontSize: 14,
              }}
            >
              إدارة وإنشاء المحتوى التسويقي لمنتجات{" "}
              {shop?.name || "محلك"}.
            </p>
          </div>

          <Link
            href="/products"
            style={{
              textDecoration: "none",
              background: "#111827",
              color: "#fff",
              padding: "13px 18px",
              borderRadius: 12,
              fontWeight: "bold",
              fontSize: 14,
            }}
          >
            📦 إدارة المنتجات
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 15,
              borderRadius: 14,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              lineHeight: 1.7,
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
              "repeat(auto-fit, minmax(155px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard
            icon="📦"
            title="المنتجات"
            value={stats.totalProducts}
          />

          <StatCard
            icon="✅"
            title="لديها محتوى"
            value={stats.ready}
          />

          <StatCard
            icon="📝"
            title="تحتاج محتوى"
            value={stats.notReady}
          />

          <StatCard
            icon="🟡"
            title="تحتاج مراجعة"
            value={stats.review}
          />

          <StatCard
            icon="🔒"
            title="مقفلة"
            value={stats.locked}
          />

          <StatCard
            icon="📣"
            title="إجمالي المحتوى"
            value={stats.totalContents}
          />
        </div>

        {/* Search / Filters */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المنتج أو البراند أو التصنيف..."
              style={{
                flex: "1 1 280px",
                minWidth: 220,
                boxSizing: "border-box",
                padding: "13px 15px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: 14,
                background: "#fff",
                color: "#111827",
              }}
            />

            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              text={`الكل (${stats.totalProducts})`}
            />

            <FilterButton
              active={filter === "ready"}
              onClick={() => setFilter("ready")}
              text={`✅ جاهز (${stats.ready})`}
            />

            <FilterButton
              active={filter === "not_ready"}
              onClick={() => setFilter("not_ready")}
              text={`📝 يحتاج محتوى (${stats.notReady})`}
            />

            <FilterButton
              active={filter === "review"}
              onClick={() => setFilter("review")}
              text={`🟡 مراجعة (${stats.review})`}
            />

            <FilterButton
              active={filter === "locked"}
              onClick={() => setFilter("locked")}
              text={`🔒 مقفل (${stats.locked})`}
            />
          </div>
        </div>

        {/* Explanation */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#111827",
              marginBottom: 10,
            }}
          >
            كيف يعمل مركز التسويق؟
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <StatusBadge
              text="🟢 جاهز للتسويق"
              type="clear"
            />

            <StatusBadge
              text="🟡 يحتاج تأكيد المسؤولية"
              type="review"
            />

            <StatusBadge
              text="📝 لم يتم إنشاء المحتوى"
              type="neutral"
            />

            <StatusBadge
              text="🔒 مقفل"
              type="locked"
            />
          </div>
        </div>

        {/* No products */}
        {products.length === 0 ? (
          <EmptyProducts />
        ) : marketingProducts.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              padding: "50px 20px",
              textAlign: "center",
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
                "repeat(auto-fill, minmax(310px, 1fr))",
              gap: 18,
            }}
          >
            {marketingProducts.map(
              ({ product, marketing }) => (
                <MarketingProductCard
                  key={product.id}
                  product={product}
                  marketing={marketing}
                />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function MarketingProductCard({
  product,
  marketing,
}) {
  const locked = isProductLocked(product);
  const unclear =
    !locked && isProductUnclear(product);

  const hasMarketing = Boolean(marketing);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        border: locked
          ? "2px solid #dc2626"
          : unclear
          ? "2px solid #f59e0b"
          : "1px solid #e5e7eb",
        boxShadow:
          "0 5px 20px rgba(0,0,0,0.04)",
      }}
    >
      {/* Image */}
      <div
        style={{
          height: 210,
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
              fontSize: 55,
            }}
          >
            📦
          </div>
        )}

        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
          }}
        >
          {locked ? (
            <StatusBadge
              text="🔒 مقفل"
              type="locked"
            />
          ) : unclear ? (
            <StatusBadge
              text="🟡 يحتاج تأكيد"
              type="review"
            />
          ) : hasMarketing ? (
            <StatusBadge
              text="🟢 جاهز"
              type="clear"
            />
          ) : (
            <StatusBadge
              text="📝 يحتاج محتوى"
              type="neutral"
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 18 }}>
        <h2
          style={{
            margin: "0 0 7px",
            color: "#111827",
            fontSize: 19,
          }}
        >
          {product.name || "منتج بدون اسم"}
        </h2>

        {product.brand && (
          <div
            style={{
              color: "#6b7280",
              fontSize: 14,
              marginBottom: 5,
            }}
          >
            {product.brand}
          </div>
        )}

        {product.category && (
          <div
            style={{
              color: "#9ca3af",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {product.category}
          </div>
        )}

        {/* Marketing status */}
        <div
          style={{
            background: "#f8f9fb",
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 5,
            }}
          >
            حالة المحتوى التسويقي
          </div>

          <strong
            style={{
              color: hasMarketing
                ? "#047857"
                : "#6b7280",
            }}
          >
            {hasMarketing
              ? "✅ محتوى تسويقي جاهز"
              : "📝 لم يتم إنشاء المحتوى بعد"}
          </strong>
        </div>

        {/* Preview */}
        {hasMarketing &&
          marketing.marketing_description && (
            <div
              style={{
                marginBottom: 14,
                color: "#4b5563",
                fontSize: 13,
                lineHeight: 1.7,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {marketing.marketing_description}
            </div>
          )}

        {/* Locked */}
        {locked && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: 12,
              padding: 11,
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            🔒 لا يمكن إنشاء أو استخدام المحتوى
            التسويقي لهذا المنتج حتى تتم مراجعته.
            {product.safety_reason && (
              <>
                <br />
                <strong>السبب:</strong>{" "}
                {product.safety_reason}
              </>
            )}
          </div>
        )}

        {/* Responsibility */}
        {unclear && (
          <div
            style={{
              background: "#fff8e1",
              border: "1px solid #f0d98a",
              color: "#7c5a00",
              borderRadius: 12,
              padding: 11,
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            ⚠️ المنتج يحتاج تأكيد مسؤولية التاجر
            قبل إنشاء المحتوى.
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <Link
            href={`/marketing/${product.id}`}
            style={{
              textDecoration: "none",
              textAlign: "center",
              padding: "11px 8px",
              borderRadius: 10,
              background: locked
                ? "#f3f4f6"
                : "#111827",
              color: locked
                ? "#9ca3af"
                : "#fff",
              fontSize: 13,
              fontWeight: "bold",
              pointerEvents: locked
                ? "none"
                : "auto",
            }}
          >
            {hasMarketing
              ? "📣 فتح التسويق"
              : "🚀 إنشاء التسويق"}
          </Link>

          <Link
            href={`/product-intelligence/${product.id}`}
            style={{
              textDecoration: "none",
              textAlign: "center",
              padding: "11px 8px",
              borderRadius: 10,
              background: "#f3f4f6",
              color: "#111827",
              fontSize: 13,
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
              borderRadius: 10,
              background: "#f3f4f6",
              color: "#111827",
              fontSize: 13,
              fontWeight: "bold",
            }}
          >
            ✏️ تعديل المنتج
          </Link>

          {!locked && (
            <>
              <Link
                href={`/videos/new?product=${product.id}`}
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  padding: "11px 8px",
                  borderRadius: 10,
                  background: "#f3f4f6",
                  color: "#111827",
                  fontSize: 13,
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
                  borderRadius: 10,
                  background: "#f3f4f6",
                  color: "#111827",
                  fontSize: 13,
                  fontWeight: "bold",
                  gridColumn: "1 / -1",
                }}
              >
                🎨 التصميم
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function isProductLocked(product) {
  if (!product) {
    return false;
  }

  return (
    product.verification_status === "locked" ||
    product.verification_status === "violation" ||
    product.safety_status === "locked" ||
    product.safety_status === "violation" ||
    product.safety_level === "critical"
  );
}

function isProductUnclear(product) {
  if (!product) {
    return true;
  }

  if (isProductLocked(product)) {
    return false;
  }

  const verification =
    String(
      product.verification_status || ""
    ).toLowerCase();

  const confidence =
    String(
      product.confidence || ""
    )
      .trim()
      .toLowerCase();

  if (
    verification === "review" ||
    verification === "unverified" ||
    verification === "pending"
  ) {
    return true;
  }

  if (
    confidence === "low" ||
    confidence === "منخفض" ||
    confidence === "medium" ||
    confidence === "متوسط"
  ) {
    return true;
  }

  const hasName = Boolean(
    String(product.name || "").trim()
  );

  const hasBrand = Boolean(
    String(product.brand || "").trim()
  );

  const hasCategory = Boolean(
    String(product.category || "").trim()
  );

  const hasDescription = Boolean(
    String(product.description || "").trim()
  );

  if (
    hasName &&
    !hasBrand &&
    !hasCategory &&
    !hasDescription
  ) {
    return true;
  }

  return false;
}

function StatCard({
  icon,
  title,
  value,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 15,
      }}
    >
      <div
        style={{
          fontSize: 22,
          marginBottom: 7,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#6b7280",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#111827",
          fontSize: 23,
          fontWeight: "bold",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  text,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "11px 13px",
        borderRadius: 11,
        border: active
          ? "1px solid #111827"
          : "1px solid #e5e7eb",
        background: active
          ? "#111827"
          : "#fff",
        color: active
          ? "#fff"
          : "#374151",
        fontSize: 13,
        fontWeight: "bold",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </button>
  );
}

function StatusBadge({
  text,
  type,
}) {
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

    neutral: {
      background: "#f3f4f6",
      color: "#4b5563",
      border: "1px solid #e5e7eb",
    },

    locked: {
      background: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
    },
  };

  const style =
    styles[type] || styles.neutral;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 9px",
        borderRadius: 9,
        background: style.background,
        color: style.color,
        border: style.border,
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      {text}
    </span>
  );
}

function EmptyProducts() {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "55px 25px",
        textAlign: "center",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: 52,
          marginBottom: 12,
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
          marginBottom: 20,
        }}
      >
        أضف منتجًا أولًا حتى تتمكن من إنشاء
        المحتوى التسويقي.
      </p>

      <Link
        href="/add-product"
        style={{
          display: "inline-block",
          textDecoration: "none",
          background: "#111827",
          color: "#fff",
          padding: "13px 20px",
          borderRadius: 12,
          fontWeight: "bold",
        }}
      >
        ➕ إضافة منتج
      </Link>
    </div>
  );
}
