"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminReviewPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadReview();
  }, []);

  async function loadReview() {
    setLoading(true);

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

      if (
        profileError ||
        !profile ||
        (profile.is_super_admin !== true &&
          profile.role !== "super_admin")
      ) {
        router.replace("/dashboard");
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .or(
          "safety_status.eq.review,safety_status.eq.violation,safety_status.eq.locked,verification_status.eq.review,verification_status.eq.locked"
        )
        .order("created_at", { ascending: false });

      if (productError) {
        console.error(productError);
        setProducts([]);
        return;
      }

      const productList = productData || [];

      const shopIds = [
        ...new Set(
          productList
            .map((product) => product.shop_id)
            .filter(Boolean)
        ),
      ];

      let shops = [];

      if (shopIds.length > 0) {
        const { data: shopData } = await supabase
          .from("shops")
          .select("id, name, owner_id")
          .in("id", shopIds);

        shops = shopData || [];
      }

      const ownerIds = [
        ...new Set(
          shops
            .map((shop) => shop.owner_id)
            .filter(Boolean)
        ),
      ];

      let profiles = [];

      if (ownerIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", ownerIds);

        profiles = profileData || [];
      }

      const shopMap = {};
      shops.forEach((shop) => {
        shopMap[shop.id] = shop;
      });

      const profileMap = {};
      profiles.forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      const enriched = productList.map((product) => {
        const shop = shopMap[product.shop_id] || null;
        const owner = shop
          ? profileMap[shop.owner_id] || null
          : null;

        return {
          ...product,
          shop,
          owner,
        };
      });

      setProducts(enriched);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function getStatus(product) {
    if (
      product.safety_status === "locked" ||
      product.verification_status === "locked"
    ) {
      return {
        text: "مقفل",
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    if (
      product.safety_status === "violation"
    ) {
      return {
        text: "مخالفة",
        background: "#ffedd5",
        color: "#9a3412",
      };
    }

    if (
      product.safety_status === "review" ||
      product.verification_status === "review"
    ) {
      return {
        text: "يحتاج مراجعة",
        background: "#fef3c7",
        color: "#92400e",
      };
    }

    return {
      text: "طبيعي",
      background: "#dcfce7",
      color: "#166534",
    };
  }

  function getLevel(product) {
    const level =
      product.safety_level ||
      product.confidence ||
      "low";

    if (level === "critical") {
      return {
        text: "حرج",
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    if (level === "high") {
      return {
        text: "مرتفع",
        background: "#ffedd5",
        color: "#9a3412",
      };
    }

    if (level === "medium") {
      return {
        text: "متوسط",
        background: "#fef3c7",
        color: "#92400e",
      };
    }

    return {
      text: "منخفض",
      background: "#dcfce7",
      color: "#166534",
    };
  }

  const filteredProducts = products.filter((product) => {
    const text = search.trim().toLowerCase();

    const matchesSearch =
      !text ||
      [
        product.name,
        product.brand,
        product.category,
        product.barcode,
        product.shop?.name,
        product.owner?.full_name,
        product.safety_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);

    const status = getStatus(product);

    let matchesFilter = true;

    if (filter === "locked") {
      matchesFilter = status.text === "مقفل";
    }

    if (filter === "violation") {
      matchesFilter = status.text === "مخالفة";
    }

    if (filter === "review") {
      matchesFilter = status.text === "يحتاج مراجعة";
    }

    if (filter === "high") {
      matchesFilter =
        product.safety_level === "high" ||
        product.safety_level === "critical";
    }

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        جاري تحميل المراجعة...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f7f7",
        padding: "25px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>
              🛡️ مراجعة المنتجات
            </h1>

            <p
              style={{
                color: "#666",
                marginTop: 8,
              }}
            >
              المنتجات التي تحتاج مراجعة أو عليها مخالفة
            </p>
          </div>

          <Link
            href="/admin"
            style={{
              textDecoration: "none",
              background: "#111",
              color: "#fff",
              padding: "11px 18px",
              borderRadius: 12,
              fontWeight: "bold",
            }}
          >
            لوحة التحكم
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              boxShadow:
                "0 4px 18px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ color: "#777" }}>
              إجمالي المراجعة
            </div>

            <strong
              style={{
                display: "block",
                fontSize: 28,
                marginTop: 6,
              }}
            >
              {products.length}
            </strong>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              boxShadow:
                "0 4px 18px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ color: "#777" }}>
              مقفلة
            </div>

            <strong
              style={{
                display: "block",
                fontSize: 28,
                marginTop: 6,
              }}
            >
              {
                products.filter(
                  (p) =>
                    getStatus(p).text === "مقفل"
                ).length
              }
            </strong>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              boxShadow:
                "0 4px 18px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ color: "#777" }}>
              مخالفات
            </div>

            <strong
              style={{
                display: "block",
                fontSize: 28,
                marginTop: 6,
              }}
            >
              {
                products.filter(
                  (p) =>
                    getStatus(p).text === "مخالفة"
                ).length
              }
            </strong>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 16,
            marginBottom: 18,
            boxShadow:
              "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المنتج أو المحل أو المالك أو الباركود..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border: "1px solid #ddd",
              borderRadius: 12,
              fontSize: 15,
              outline: "none",
              marginBottom: 12,
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {[
              ["all", "الكل"],
              ["review", "تحتاج مراجعة"],
              ["violation", "مخالفات"],
              ["locked", "مقفلة"],
              ["high", "خطورة مرتفعة"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: "9px 14px",
                  cursor: "pointer",
                  background:
                    filter === value
                      ? "#111"
                      : "#fff",
                  color:
                    filter === value
                      ? "#fff"
                      : "#111",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow:
              "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          {filteredProducts.length === 0 ? (
            <div
              style={{
                padding: 45,
                textAlign: "center",
                color: "#666",
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  marginBottom: 10,
                }}
              >
                ✅
              </div>

              لا توجد منتجات تحتاج مراجعة حالياً.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 950,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8f8f8",
                    }}
                  >
                    {[
                      "المنتج",
                      "المحل",
                      "المالك",
                      "الحالة",
                      "الخطورة",
                      "سبب المراجعة",
                      "التاريخ",
                    ].map((title) => (
                      <th
                        key={title}
                        style={{
                          padding: 14,
                          textAlign: "right",
                          fontSize: 14,
                          whiteSpace: "nowrap",
                          borderBottom:
                            "1px solid #eee",
                        }}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product) => {
                      const status =
                        getStatus(product);

                      const level =
                        getLevel(product);

                      return (
                        <tr
                          key={product.id}
                          style={{
                            borderBottom:
                              "1px solid #eee",
                          }}
                        >
                          <td
                            style={{
                              padding: 14,
                              fontWeight: "bold",
                            }}
                          >
                            <div>
                              {product.name ||
                                "بدون اسم"}
                            </div>

                            {product.brand && (
                              <div
                                style={{
                                  color: "#777",
                                  fontSize: 13,
                                  marginTop: 4,
                                }}
                              >
                                {product.brand}
                              </div>
                            )}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {product.shop?.name ||
                              "بدون محل"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            {product.owner
                              ?.full_name ||
                              "غير معروف"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",
                                background:
                                  status.background,
                                color:
                                  status.color,
                                padding:
                                  "6px 10px",
                                borderRadius: 20,
                                fontSize: 13,
                                fontWeight:
                                  "bold",
                              }}
                            >
                              {status.text}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 14,
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",
                                background:
                                  level.background,
                                color:
                                  level.color,
                                padding:
                                  "6px 10px",
                                borderRadius: 20,
                                fontSize: 13,
                                fontWeight:
                                  "bold",
                              }}
                            >
                              {level.text}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 14,
                              maxWidth: 280,
                            }}
                          >
                            {product.safety_reason ||
                              product.verification_notes ||
                              "لا يوجد سبب مسجل"}
                          </td>

                          <td
                            style={{
                              padding: 14,
                              whiteSpace:
                                "nowrap",
                              color: "#666",
                            }}
                          >
                            {product.created_at
                              ? new Date(
                                  product.created_at
                                ).toLocaleDateString(
                                  "ar-AE"
                                )
                              : "-"}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
