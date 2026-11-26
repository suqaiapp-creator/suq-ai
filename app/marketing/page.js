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
    const query = search.trim().toLowerCase();

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
        const matchesSearch =
          !query ||
          [
            product.name,
            product.brand,
            product.category,
            product.model_number,
            product.barcode,
            product.description,
            marketing?.marketing_description,
            marketing?.seo_title,
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
          return !marketing && !isProductLocked(product);
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

    const completedContents = marketingContents.filter(
      (item) =>
        item.status === "completed" ||
        item.status === "ready"
    ).length;

    const processingContents = marketingContents.filter(
      (item) =>
        item.status === "processing" ||
        item.status === "generating" ||
        item.status === "pending"
    ).length;

    const failedContents = marketingContents.filter(
      (item) =>
        item.status === "failed" ||
        item.status === "error"
    ).length;

    return {
      totalProducts,
      ready,
      notReady,
      locked,
      review,
      totalContents: marketingContents.length,
      completedContents,
      processingContents,
      failedContents,
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
          background: "#f6f8f7",
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
            border: "1px solid #e1e7e3",
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
        background: "#f6f8f7",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#17201c",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
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
                color: "#66736d",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              ← لوحة التحكم
            </Link>

            <div
              style={{
                color: "#15803d",
                fontWeight: 800,
                fontSize: 13,
                marginTop: 10,
              }}
            >
              سوق AI
            </div>

            <h1
              style={{
                margin: "5px 0",
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              🚀 مركز التسويق
            </h1>

            <p
              style={{
                margin: 0,
                color: "#66736d",
                fontSize: 14,
              }}
            >
              إدارة وإنشاء المحتوى التسويقي لمنتجات{" "}
              {shop?.name || "محلك"}.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/products"
              style={{
                textDecoration: "none",
                background: "#fff",
                color: "#17201c",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                border: "1px solid #d9e1dc",
              }}
            >
              📦 المنتجات
            </Link>

            <Link
              href="/dashboard"
              style={{
                textDecoration: "none",
                background: "#15803d",
                color: "#fff",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              لوحة التحكم
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 15,
              borderRadius: 14,
              background: "#fef3f2",
              border: "1px solid #fecdca",
              color: "#b42318",
              lineHeight: 1.7,
            }}
          >
            {error}
          </div>
        )}

        {/* Main stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
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
            icon="🟢"
            title="جاهزة للتسويق"
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

        {/* Content stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <MiniStat
            icon="✅"
            title="محتوى مكتمل"
            value={stats.completedContents}
          />

          <MiniStat
            icon="⏳"
            title="قيد المعالجة"
            value={stats.processingContents}
          />

          <MiniStat
            icon="❌"
            title="فشل"
            value={stats.failedContents}
          />
        </div>

        {/* Search */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e1e7e3",
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
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="ابحث باسم المنتج أو البراند أو التصنيف أو الموديل..."
              style={{
                flex: "1 1 280px",
                minWidth: 220,
                boxSizing: "border-box",
                padding: "13px 15px",
                borderRadius: 12,
                border: "1px solid #cfd8d3",
                outline: "none",
                fontSize: 14,
                background: "#fff",
                color: "#17201c",
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
              text={`🟢 جاهز (${stats.ready})`}
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
            border: "1px solid #e1e7e3",
            borderRadius: 18,
            padding: 17,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              color: "#17201c",
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

        {/* Products */}
        {products.length === 0 ? (
          <EmptyProducts />
        ) : marketingProducts.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              border: "1px solid #e1e7e3",
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
              }}
            >
              لا توجد نتائج
            </h2>

            <p
              style={{
                margin: 0,
                color: "#66736d",
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

      <style jsx>{`
        @media (max-width: 600px) {
          main {
            padding: 14px !important;
          }
        }
      `}</style>
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

  const marketingStatus =
    getMarketingStatus(marketing);

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
          : "1px solid #e1e7e3",
        boxShadow:
          "0 5px 20px rgba(0,0,0,0.04)",
      }}
    >
      {/* Product image */}
      <div
        style={{
          height: 220,
          background: "#f5f7f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: 12,
          boxSizing: "border-box",
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
              borderRadius: 12,
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
              text={marketingStatus.text}
              type={marketingStatus.type}
            />
          ) : (
            <StatusBadge
              text="📝 يحتاج محتوى"
              type="neutral"
            />
          )}
        </div>
      </div>

      <div
        style={{
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              minWidth: 0,
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#17201c",
                fontSize: 19,
                lineHeight: 1.5,
              }}
            >
              {product.name || "منتج بدون اسم"}
            </h2>

            {product.brand && (
              <div
                style={{
                  color: "#66736d",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {product.brand}
              </div>
            )}
          </div>
        </div>

        {product.category && (
          <div
            style={{
              color: "#8a958f",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {product.category}
          </div>
        )}

        {/* Marketing information */}
        <div
          style={{
            background: "#f8faf9",
            borderRadius: 13,
            padding: 12,
            marginBottom: 13,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#7a857f",
              marginBottom: 5,
            }}
          >
            حالة المحتوى التسويقي
          </div>

          <div
            style={{
              fontWeight: 900,
              fontSize: 14,
              color: hasMarketing
                ? "#047857"
                : "#66736d",
            }}
          >
            {hasMarketing
              ? marketingStatus.text
              : "📝 لم يتم إنشاء المحتوى بعد"}
          </div>
        </div>

        {hasMarketing &&
          marketing.marketing_description && (
            <div
              style={{
                marginBottom: 14,
                color: "#56625c",
                fontSize: 13,
                lineHeight: 1.8,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {marketing.marketing_description}
            </div>
          )}

        {hasMarketing &&
          marketing.call_to_action && (
            <div
              style={{
                background: "#f0fdf4",
                border:
                  "1px solid #bbf7d0",
                color: "#166534",
                borderRadius: 10,
                padding: 9,
                marginBottom: 13,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              CTA: {marketing.call_to_action}
            </div>
          )}

        {/* Locked */}
        {locked && (
          <div
            style={{
              background: "#fef3f2",
              border: "1px solid #fecdca",
              color: "#b42318",
              borderRadius: 12,
              padding: 11,
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            🔒 لا يمكن إنشاء أو استخدام المحتوى التسويقي لهذا المنتج حتى تتم مراجعته.

            {product.safety_reason && (
              <>
                <br />
                <strong>السبب:</strong>{" "}
                {product.safety_reason}
              </>
            )}
          </div>
        )}

        {/* Unclear */}
        {unclear && (
          <div
            style={{
              background: "#fffaeb",
              border: "1px solid #fedf89",
              color: "#92400e",
              borderRadius: 12,
              padding: 11,
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            ⚠️ المنتج يحتاج تأكيد مسؤولية التاجر قبل إنشاء المحتوى.
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {!locked ? (
            <Link
              href={`/marketing/${product.id}`}
              style={{
                textDecoration: "none",
                textAlign: "center",
                padding: "12px 8px",
                borderRadius: 10,
                background: "#15803d",
                color: "#fff",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {hasMarketing
                ? "📣 فتح التسويق"
                : "🚀 إنشاء التسويق"}
            </Link>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "12px 8px",
                borderRadius: 10,
                background: "#f3f4f6",
                color: "#9ca3af",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              🔒 التسويق مقفل
            </div>
          )}

          <Link
            href={`/product-intelligence/${product.id}`}
            style={{
              textDecoration: "none",
              textAlign: "center",
              padding: "12px 8px",
              borderRadius: 10,
              background: "#f3f5f4",
              color: "#17201c",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            🧠 الذكاء
          </Link>

          <Link
            href={`/edit-product/${product.id}`}
            style={{
              textDecoration: "none",
              textAlign: "center",
              padding: "12px 8px",
              borderRadius: 10,
              background: "#f3f5f4",
              color: "#17201c",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ✏️ تعديل
          </Link>

          {!locked && (
            <Link
              href={`/videos/new?product=${product.id}`}
              style={{
                textDecoration: "none",
                textAlign: "center",
                padding: "12px 8px",
                borderRadius: 10,
                background: "#f3f5f4",
                color: "#17201c",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              🎬 فيديو
            </Link>
          )}

          {!locked && (
            <Link
              href={`/designs?product=${product.id}`}
              style={{
                textDecoration: "none",
                textAlign: "center",
                padding: "12px 8px",
                borderRadius: 10,
                background: "#f3f5f4",
                color: "#17201c",
                fontSize: 13,
                fontWeight: 800,
                gridColumn: "1 / -1",
              }}
            >
              🎨 تصميم
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function getMarketingStatus(marketing) {
  if (!marketing) {
    return {
      type: "neutral",
      text: "📝 يحتاج محتوى",
    };
  }

  const status = String(
    marketing.status || ""
  ).toLowerCase();

  if (
    status === "completed" ||
    status === "ready"
  ) {
    return {
      type: "clear",
      text: "🟢 مكتمل",
    };
  }

  if (
    status === "processing" ||
    status === "generating" ||
    status === "pending"
  ) {
    return {
      type: "review",
      text: "⏳ قيد المعالجة",
    };
  }

  if (
    status === "failed" ||
    status === "error"
  ) {
    return {
      type: "locked",
      text: "❌ فشل",
    };
  }

  return {
    type: "neutral",
    text: `ℹ️ ${marketing.status || "موجود"}`,
  };
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

  const verification = String(
    product.verification_status || ""
  )
    .trim()
    .toLowerCase();

  const confidence = String(
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
    confidence === "medium" ||
    confidence === "منخفض" ||
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
        border: "1px solid #e1e7e3",
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
          color: "#66736d",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#17201c",
          fontSize: 23,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  title,
  value,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e1e7e3",
        borderRadius: 14,
        padding: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: "#f0fdf4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        {icon}
      </div>

      <div>
        <div
          style={{
            color: "#66736d",
            fontSize: 11,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 19,
            fontWeight: 900,
            marginTop: 2,
          }}
        >
          {value}
        </div>
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
          ? "1px solid #15803d"
          : "1px solid #e1e7e3",
        background: active
          ? "#15803d"
          : "#fff",
        color: active
          ? "#fff"
          : "#374151",
        fontSize: 13,
        fontWeight: 800,
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
      background: "#ecfdf3",
      color: "#067647",
      border: "1px solid #abefc6",
    },

    review: {
      background: "#fffaeb",
      color: "#b54708",
      border: "1px solid #fedf89",
    },

    neutral: {
      background: "#f3f5f4",
      color: "#56625c",
      border: "1px solid #e1e7e3",
    },

    locked: {
      background: "#fef3f2",
      color: "#b42318",
      border: "1px solid #fecdca",
    },
  };

  const style =
    styles[type] || styles.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 9px",
        borderRadius: 999,
        background: style.background,
        color: style.color,
        border: style.border,
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.2,
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
        border: "1px solid #e1e7e3",
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
        }}
      >
        لا توجد منتجات
      </h2>

      <p
        style={{
          color: "#66736d",
          marginBottom: 20,
        }}
      >
        أضف منتجًا أولًا حتى تتمكن من إنشاء المحتوى التسويقي.
      </p>

      <Link
        href="/add-product"
        style={{
          display: "inline-block",
          textDecoration: "none",
          background: "#15803d",
          color: "#fff",
          padding: "13px 20px",
          borderRadius: 12,
          fontWeight: 900,
        }}
      >
        ➕ إضافة منتج
      </Link>
    </div>
  );
}
