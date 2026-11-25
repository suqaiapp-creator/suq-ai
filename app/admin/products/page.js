"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminProductsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
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
                .select("id, full_name, account_status")
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

  const filteredProducts = products.filter((product) => {
    const text = search.trim().toLowerCase();

    if (!text) return true;

    return (
      (product.name || "").toLowerCase().includes(text) ||
      (product.brand || "").toLowerCase().includes(text) ||
      (product.category || "").toLowerCase().includes(text) ||
      (product.shop?.name || "").toLowerCase().includes(text) ||
      (product.owner?.full_name || "").toLowerCase().includes(text) ||
      (product.barcode || "").toLowerCase().includes(text)
    );
  });

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
            <div style={{ fontSize: 13, opacity: 0.7 }}>
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
      </header>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "25px 18px 50px",
        }}
      >
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
            متابعة المنتجات وحالات التحقق والسلامة.
          </p>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالمنتج أو العلامة أو المحل أو الباركود..."
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
        </section>

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
              الظاهر: {filteredProducts.length}
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
              لا توجد منتجات مطابقة للبحث.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 1050,
                }}
              >
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={thStyle}>المنتج</th>
                    <th style={thStyle}>المحل</th>
                    <th style={thStyle}>المالك</th>
                    <th style={thStyle}>النوع</th>
                    <th style={thStyle}>التحقق</th>
                    <th style={thStyle}>السلامة</th>
                    <th style={thStyle}>الحالة</th>
                    <th style={thStyle}>التاريخ</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const locked = isLocked(product);
                    const review = needsReview(product);

                    return (
                      <tr key={product.id}>
                        <td style={tdStyle}>
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

                          {product.barcode && (
                            <div
                              style={{
                                color: "#999",
                                fontSize: 11,
                                marginTop: 4,
                                direction: "ltr",
                                textAlign: "right",
                              }}
                            >
                              {product.barcode}
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {product.shop?.name || "بدون محل"}
                        </td>

                        <td style={tdStyle}>
                          {product.owner?.full_name || "غير معروف"}
                        </td>

                        <td style={tdStyle}>
                          {product.product_type === "imported"
                            ? "مستورد"
                            : "محلي"}
                        </td>

                        <td style={tdStyle}>
                          <VerificationBadge
                            status={product.verification_status}
                          />
                        </td>

                        <td style={tdStyle}>
                          <SafetyBadge
                            status={product.safety_status}
                            level={product.safety_level}
                          />
                        </td>

                        <td style={tdStyle}>
                          {locked ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "#ffe8e8",
                                color: "#a51d1d",
                                fontSize: 12,
                                fontWeight: "bold",
                              }}
                            >
                              🔒 مقفل
                            </span>
                          ) : review ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "#fff4d6",
                                color: "#806000",
                                fontSize: 12,
                                fontWeight: "bold",
                              }}
                            >
                              ⚠️ يحتاج مراجعة
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "#eef7ee",
                                color: "#277227",
                                fontSize: 12,
                                fontWeight: "bold",
                              }}
                            >
                              ✅ طبيعي
                            </span>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {formatDate(product.created_at)}
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

function VerificationBadge({ status }) {
  const value = status || "unverified";

  const labels = {
    verified: "موثق",
    approved: "معتمد",
    unverified: "غير موثق",
    pending: "قيد الانتظار",
    review: "مراجعة",
    locked: "مقفل",
  };

  const danger = value === "locked";
  const warning = value === "review" || value === "pending";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        background: danger
          ? "#ffe8e8"
          : warning
          ? "#fff4d6"
          : "#eef7ee",
        color: danger
          ? "#a51d1d"
          : warning
          ? "#806000"
          : "#277227",
        fontSize: 12,
        fontWeight: "bold",
      }}
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
        مراجعة {level ? `· ${level}` : ""}
      </span>
    );
  }

  return (
    <span style={badgeStyle("#eef7ee", "#277227")}>
      سليم
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

const thStyle = {
  padding: "14px 16px",
  textAlign: "right",
  fontSize: 13,
  color: "#555",
  borderBottom: "1px solid #eee",
};

const tdStyle = {
  padding: "15px 16px",
  textAlign: "right",
  fontSize: 14,
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};
