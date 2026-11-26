"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminProductsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shopFilter, setShopFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
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
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        router.replace("/dashboard");
        return;
      }

      if (
        profile.is_super_admin !== true &&
        profile.role !== "super_admin"
      ) {
        router.replace("/dashboard");
        return;
      }

      const { data, error: productsError } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (productsError) {
        throw productsError;
      }

      const productList = data || [];

      const productsWithDetails = await Promise.all(
        productList.map(async (product) => {
          let shop = null;
          let owner = null;

          if (product.shop_id) {
            const { data: shopData } = await supabase
              .from("shops")
              .select("id, name, owner_id, status")
              .eq("id", product.shop_id)
              .maybeSingle();

            shop = shopData;

            if (shop?.owner_id) {
              const { data: ownerData } = await supabase
                .from("profiles")
                .select(
                  "id, full_name, account_status"
                )
                .eq("id", shop.owner_id)
                .maybeSingle();

              owner = ownerData;
            }
          }

          return {
            ...product,
            shop,
            owner,
          };
        })
      );

      setProducts(productsWithDetails);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل المنتجات.");
    } finally {
      setLoading(false);
    }
  }

  const shops = useMemo(() => {
    const map = new Map();

    products.forEach((product) => {
      if (product.shop?.id) {
        map.set(product.shop.id, product.shop.name);
      }
    });

    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "ar")
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const text = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !text ||
        (product.name || "").toLowerCase().includes(text) ||
        (product.brand || "").toLowerCase().includes(text) ||
        (product.category || "").toLowerCase().includes(text) ||
        (product.shop?.name || "").toLowerCase().includes(text) ||
        (product.owner?.full_name || "").toLowerCase().includes(text) ||
        (product.barcode || "").toLowerCase().includes(text) ||
        (product.model_number || "").toLowerCase().includes(text);

      const matchesType =
        typeFilter === "all" ||
        product.product_type === typeFilter;

      const matchesShop =
        shopFilter === "all" ||
        product.shop_id === shopFilter;

      const locked = isLocked(product);
      const review = needsReview(product);

      let matchesStatus = true;

      if (statusFilter === "locked") {
        matchesStatus = locked;
      }

      if (statusFilter === "review") {
        matchesStatus = !locked && review;
      }

      if (statusFilter === "normal") {
        matchesStatus = !locked && !review;
      }

      return (
        matchesSearch &&
        matchesType &&
        matchesShop &&
        matchesStatus
      );
    });
  }, [
    products,
    search,
    typeFilter,
    statusFilter,
    shopFilter,
  ]);

  const stats = useMemo(() => {
    let locked = 0;
    let review = 0;
    let normal = 0;
    let local = 0;
    let imported = 0;

    products.forEach((product) => {
      if (isLocked(product)) {
        locked++;
      } else if (needsReview(product)) {
        review++;
      } else {
        normal++;
      }

      if (product.product_type === "imported") {
        imported++;
      } else {
        local++;
      }
    });

    return {
      total: products.length,
      locked,
      review,
      normal,
      local,
      imported,
    };
  }, [products]);

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setShopFilter("all");
  }

  function isLocked(product) {
    return (
      product.safety_status === "locked" ||
      product.verification_status === "locked"
    );
  }

  function needsReview(product) {
    return (
      product.safety_status === "review" ||
      product.verification_status === "review"
    );
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f5f6f8",
          fontFamily: "Arial, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "80px auto",
            background: "#fff",
            borderRadius: 20,
            padding: 40,
            textAlign: "center",
          }}
        >
          جاري تحميل المنتجات...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#111",
          color: "#fff",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              سوق AI
            </div>

            <h1
              style={{
                margin: "5px 0 0",
                fontSize: 25,
              }}
            >
              إدارة المنتجات
            </h1>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/"
              style={{
                color: "#111",
                background: "#fff",
                textDecoration: "none",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 14,
                fontWeight: "bold",
              }}
            >
              🏠 الرئيسية
            </Link>

            <Link
              href="/admin"
              style={{
                color: "#fff",
                textDecoration: "none",
                border: "1px solid #555",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 14,
              }}
            >
              ← لوحة الإدارة
            </Link>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "25px 18px 50px",
        }}
      >
        {/* Summary */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <MiniStat
            title="كل المنتجات"
            value={stats.total}
            icon="📦"
          />

          <MiniStat
            title="محلي"
            value={stats.local}
            icon="🇦🇪"
          />

          <MiniStat
            title="مستورد"
            value={stats.imported}
            icon="🌍"
          />

          <MiniStat
            title="طبيعي"
            value={stats.normal}
            icon="✅"
          />

          <MiniStat
            title="تحتاج مراجعة"
            value={stats.review}
            icon="⚠️"
          />

          <MiniStat
            title="مقفلة"
            value={stats.locked}
            icon="🔒"
          />
        </section>

        {/* Search and filters */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            border: "1px solid #e8e8e8",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: 22,
            }}
          >
            جميع المنتجات
          </h2>

          <p
            style={{
              margin: 0,
              color: "#777",
              fontSize: 14,
            }}
          >
            البحث والتصفية ومتابعة حالة كل منتج.
          </p>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالمنتج أو العلامة أو المحل أو الباركود أو رقم الموديل..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: 18,
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: "13px 14px",
              fontSize: 15,
              outline: "none",
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 10,
              marginTop: 12,
            }}
          >
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">كل الأنواع</option>
              <option value="local">محلي</option>
              <option value="imported">مستورد</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">كل الحالات</option>
              <option value="normal">طبيعي</option>
              <option value="review">يحتاج مراجعة</option>
              <option value="locked">مقفل</option>
            </select>

            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">كل المحلات</option>

              {shops.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <button
              onClick={clearFilters}
              style={{
                border: "1px solid #ddd",
                background: "#f7f7f7",
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              مسح الفلاتر
            </button>
          </div>
        </section>

        {/* Error */}
        {error && (
          <section
            style={{
              background: "#fff0f0",
              border: "1px solid #f0bcbc",
              color: "#9b1c1c",
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
            }}
          >
            {error}
          </section>
        )}

        {/* Products */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            border: "1px solid #e8e8e8",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 20,
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <strong>
              إجمالي المنتجات: {products.length}
            </strong>

            <span
              style={{
                color: "#777",
                fontSize: 14,
              }}
            >
              الظاهر بعد الفلترة: {filteredProducts.length}
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#777",
              }}
            >
              لا توجد منتجات مطابقة للفلاتر الحالية.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 1250,
                }}
              >
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={thStyle}>المنتج</th>
                    <th style={thStyle}>المحل</th>
                    <th style={thStyle}>المالك</th>
                    <th style={thStyle}>النوع</th>
                    <th style={thStyle}>السعر</th>
                    <th style={thStyle}>التحقق</th>
                    <th style={thStyle}>السلامة</th>
                    <th style={thStyle}>AI</th>
                    <th style={thStyle}>الحالة</th>
                    <th style={thStyle}>التاريخ</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const locked = isLocked(product);
                    const review = needsReview(product);

                    return (
                      <tr
                        key={product.id}
                        style={{
                          background: locked
                            ? "#fffafa"
                            : review
                            ? "#fffdf5"
                            : "#fff",
                        }}
                      >
                        {/* Product */}
                        <td style={tdStyle}>
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              minWidth: 220,
                            }}
                          >
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                style={{
                                  width: 52,
                                  height: 52,
                                  objectFit: "cover",
                                  borderRadius: 10,
                                  border: "1px solid #eee",
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: 10,
                                  background: "#f3f3f3",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                📦
                              </div>
                            )}

                            <div>
                              <div
                                style={{
                                  fontWeight: "bold",
                                  fontSize: 15,
                                }}
                              >
                                {product.name || "بدون اسم"}
                              </div>

                              {product.brand && (
                                <div
                                  style={{
                                    color: "#777",
                                    fontSize: 12,
                                    marginTop: 4,
                                  }}
                                >
                                  {product.brand}
                                </div>
                              )}

                              {product.category && (
                                <div
                                  style={{
                                    color: "#999",
                                    fontSize: 11,
                                    marginTop: 3,
                                  }}
                                >
                                  {product.category}
                                </div>
                              )}

                              {product.model_number && (
                                <div
                                  style={{
                                    color: "#999",
                                    fontSize: 11,
                                    marginTop: 3,
                                    direction: "ltr",
                                    textAlign: "right",
                                  }}
                                >
                                  موديل: {product.model_number}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Shop */}
                        <td style={tdStyle}>
                          {product.shop ? (
                            <div>
                              <div
                                style={{
                                  fontWeight: "bold",
                                }}
                              >
                                {product.shop.name}
                              </div>

                              {product.shop.status && (
                                <div
                                  style={{
                                    marginTop: 5,
                                    fontSize: 11,
                                    color:
                                      product.shop.status ===
                                      "active"
                                        ? "#277227"
                                        : "#a51d1d",
                                  }}
                                >
                                  {product.shop.status ===
                                  "active"
                                    ? "نشط"
                                    : product.shop.status}
                                </div>
                              )}

                              <Link
                                href={`/admin/shops/${product.shop.id}`}
                                style={{
                                  display: "inline-block",
                                  marginTop: 7,
                                  color: "#2563eb",
                                  fontSize: 12,
                                  textDecoration: "none",
                                }}
                              >
                                عرض المحل →
                              </Link>
                            </div>
                          ) : (
                            <span style={{ color: "#999" }}>
                              بدون محل
                            </span>
                          )}
                        </td>

                        {/* Owner */}
                        <td style={tdStyle}>
                          <div>
                            {product.owner?.full_name ||
                              "غير معروف"}
                          </div>

                          {product.owner?.account_status && (
                            <div
                              style={{
                                marginTop: 5,
                                fontSize: 11,
                                color:
                                  product.owner
                                    .account_status ===
                                  "active"
                                    ? "#277227"
                                    : "#a51d1d",
                              }}
                            >
                              {product.owner.account_status ===
                              "active"
                                ? "الحساب نشط"
                                : product.owner.account_status}
                            </div>
                          )}
                        </td>

                        {/* Type */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 10px",
                              borderRadius: 999,
                              background:
                                product.product_type ===
                                "imported"
                                  ? "#eef2ff"
                                  : "#edf8ef",
                              color:
                                product.product_type ===
                                "imported"
                                  ? "#4338ca"
                                  : "#277227",
                              fontSize: 12,
                              fontWeight: "bold",
                            }}
                          >
                            {product.product_type ===
                            "imported"
                              ? "🌍 مستورد"
                              : "🇦🇪 محلي"}
                          </span>
                        </td>

                        {/* Price */}
                        <td style={tdStyle}>
                          {product.price !== null &&
                          product.price !== undefined ? (
                            <span
                              style={{
                                fontWeight: "bold",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {product.price}{" "}
                              {product.currency || "AED"}
                            </span>
                          ) : (
                            <span style={{ color: "#999" }}>
                              غير محدد
                            </span>
                          )}
                        </td>

                        {/* Verification */}
                        <td style={tdStyle}>
                          <VerificationBadge
                            status={
                              product.verification_status
                            }
                          />
                        </td>

                        {/* Safety */}
                        <td style={tdStyle}>
                          <SafetyBadge
                            status={product.safety_status}
                            level={product.safety_level}
                          />
                        </td>

                        {/* AI */}
                        <td style={tdStyle}>
                          <AIBadge
                            status={product.ai_status}
                          />
                        </td>

                        {/* Overall status */}
                        <td style={tdStyle}>
                          {locked ? (
                            <span
                              style={badgeStyle(
                                "#ffe8e8",
                                "#a51d1d"
                              )}
                            >
                              🔒 مقفل
                            </span>
                          ) : review ? (
                            <span
                              style={badgeStyle(
                                "#fff4d6",
                                "#806000"
                              )}
                            >
                              ⚠️ يحتاج مراجعة
                            </span>
                          ) : (
                            <span
                              style={badgeStyle(
                                "#eef7ee",
                                "#277227"
                              )}
                            >
                              ✅ طبيعي
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              whiteSpace: "nowrap",
                              color: "#666",
                            }}
                          >
                            {formatDate(
                              product.created_at
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MiniStat({ title, value, icon }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8e8e8",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 24 }}>{icon}</div>

      <div
        style={{
          fontSize: 25,
          fontWeight: "bold",
          marginTop: 6,
        }}
      >
        {value}
      </div>

      <div
        style={{
          color: "#777",
          fontSize: 13,
          marginTop: 3,
        }}
      >
        {title}
      </div>
    </div>
  );
}

function VerificationBadge({ status }) {
  const value = status || "unverified";

  const labels = {
    verified: "موثق",
    approved: "معتمد",
    unverified: "غير موثق",
    pending: "قيد الانتظار",
    review: "مراجعة",
    locked: "مقفل",
    rejected: "مرفوض",
  };

  const danger = value === "locked" || value === "rejected";
  const warning =
    value === "review" || value === "pending";

  return (
    <span
      style={badgeStyle(
        danger
          ? "#ffe8e8"
          : warning
          ? "#fff4d6"
          : "#eef7ee",
        danger
          ? "#a51d1d"
          : warning
          ? "#806000"
          : "#277227"
      )}
    >
      {labels[value] || value}
    </span>
  );
}

function SafetyBadge({ status, level }) {
  const value = status || "clear";

  if (value === "locked") {
    return (
      <span style={badgeStyle("#ffe8e8", "#a51d1d")}>
        🔒 مقفل
      </span>
    );
  }

  if (value === "violation") {
    return (
      <span style={badgeStyle("#ffe8e8", "#a51d1d")}>
        مخالفة
      </span>
    );
  }

  if (value === "review") {
    return (
      <span style={badgeStyle("#fff4d6", "#806000")}>
        ⚠️ مراجعة
        {level ? ` · ${level}` : ""}
      </span>
    );
  }

  return (
    <span style={badgeStyle("#eef7ee", "#277227")}>
      ✅ سليم
    </span>
  );
}

function AIBadge({ status }) {
  const value = status || "pending";

  if (value === "completed" || value === "success") {
    return (
      <span style={badgeStyle("#eef7ee", "#277227")}>
        ✅ مكتمل
      </span>
    );
  }

  if (value === "failed" || value === "error") {
    return (
      <span style={badgeStyle("#ffe8e8", "#a51d1d")}>
        ❌ فشل
      </span>
    );
  }

  if (value === "processing" || value === "analyzing") {
    return (
      <span style={badgeStyle("#fff4d6", "#806000")}>
        ⏳ جارٍ
      </span>
    );
  }

  return (
    <span style={badgeStyle("#f2f2f2", "#666")}>
      انتظار
    </span>
  );
}

function badgeStyle(background, color) {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    fontWeight: "bold",
  };
}

function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

const selectStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const thStyle = {
  padding: "14px 16px",
  textAlign: "right",
  fontSize: 13,
  color: "#555",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "15px 16px",
  textAlign: "right",
  fontSize: 14,
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};
