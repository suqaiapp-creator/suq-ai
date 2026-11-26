"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function ProductIntelligencePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!data) {
        setError("المنتج غير موجود.");
        return;
      }

      const { data: shopData, error: shopError } =
        await supabase
          .from("shops")
          .select("*")
          .eq("id", data.shop_id)
          .eq("owner_id", user.id)
          .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        setError("غير مصرح لك بعرض هذا المنتج.");
        return;
      }

      setProduct(data);
      setShop(shopData);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "حدث خطأ أثناء تحميل بيانات المنتج."
      );
    } finally {
      setLoading(false);
    }
  }

  function isLocked() {
    return (
      product?.verification_status === "locked" ||
      product?.safety_status === "locked"
    );
  }

  function isViolation() {
    return (
      product?.safety_status === "violation" ||
      product?.safety_level === "critical"
    );
  }

  function isUnclear() {
    if (!product) return false;

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

  function statusInfo() {
    if (isLocked()) {
      return {
        title: "المنتج مقفل",
        icon: "🔴",
        background: "#fee4e2",
        color: "#b42318",
        border: "#f3b5b0",
      };
    }

    if (isViolation()) {
      return {
        title: "توجد مخالفة أو خطورة",
        icon: "🔴",
        background: "#fff1f0",
        color: "#b42318",
        border: "#f3b5b0",
      };
    }

    if (isUnclear()) {
      return {
        title: "معلومات غير واضحة",
        icon: "🟡",
        background: "#fff8df",
        color: "#8a5a00",
        border: "#f0d98a",
      };
    }

    return {
      title: "المنتج واضح وموثّق",
      icon: "🟢",
      background: "#e8f7ee",
      color: "#16794a",
      border: "#9ad5b4",
    };
  }

  function formatSources(sources) {
    if (!sources) return [];

    if (Array.isArray(sources)) {
      return sources;
    }

    if (typeof sources === "string") {
      try {
        const parsed = JSON.parse(sources);

        if (Array.isArray(parsed)) {
          return parsed;
        }

        return [parsed];
      } catch {
        return [sources];
      }
    }

    if (typeof sources === "object") {
      return Object.values(sources);
    }

    return [];
  }

  function sourceLabel(source) {
    if (typeof source === "string") {
      return source;
    }

    if (!source || typeof source !== "object") {
      return "";
    }

    return (
      source.title ||
      source.name ||
      source.url ||
      source.source ||
      source.domain ||
      "مصدر"
    );
  }

  function sourceUrl(source) {
    if (!source || typeof source !== "object") {
      if (
        typeof source === "string" &&
        /^https?:\/\//i.test(source)
      ) {
        return source;
      }

      return "";
    }

    return source.url || "";
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f6f8f7",
          padding: "40px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 20,
            padding: 30,
            textAlign: "center",
          }}
        >
          جاري تحميل تحليل المنتج...
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f6f8f7",
          padding: "40px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 20,
            padding: 30,
            textAlign: "center",
          }}
        >
          <h2>المنتج غير موجود</h2>

          {error && (
            <p style={{ color: "#b42318" }}>
              {error}
            </p>
          )}

          <Link
            href="/products"
            style={{
              display: "inline-block",
              marginTop: 15,
              padding: "12px 20px",
              borderRadius: 10,
              background: "#16834b",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            العودة للمنتجات
          </Link>
        </div>
      </main>
    );
  }

  const status = statusInfo();
  const sources = formatSources(product.sources);

  const confidence =
    product.confidence ||
    product.verification_status ||
    "غير محدد";

  const verificationDate =
    product.verification_checked_at ||
    product.last_checked_at ||
    product.updated_at;

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f6f8f7",
        padding: "25px 16px 50px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
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
            marginBottom: 20,
          }}
        >
          <div>
            <Link
              href="/products"
              style={{
                color: "#16834b",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              ← العودة للمنتجات
            </Link>

            <h1
              style={{
                margin: "12px 0 5px",
                fontSize: 30,
              }}
            >
              🧠 ذكاء المنتج
            </h1>

            <p
              style={{
                margin: 0,
                color: "#666",
              }}
            >
              {shop?.name || "المحل"}
            </p>
          </div>

          <div
            style={{
              padding: "12px 18px",
              borderRadius: 14,
              background: status.background,
              color: status.color,
              border: `1px solid ${status.border}`,
              fontWeight: 800,
            }}
          >
            {status.icon} {status.title}
          </div>
        </div>

        {/* رسالة الحالة */}
        <div
          style={{
            background: status.background,
            border: `1px solid ${status.border}`,
            color: status.color,
            borderRadius: 18,
            padding: 20,
            marginBottom: 20,
          }}
        >
          {isLocked() ? (
            <>
              <strong>🔒 المنتج مقفل</strong>

              <p style={{ marginBottom: 0 }}>
                لا يمكن استخدام هذا المنتج في التسويق أو التصميم
                أو الفيديو أو النشر حتى تتم مراجعته من Super Admin.
              </p>

              {product.safety_reason && (
                <p
                  style={{
                    marginBottom: 0,
                    marginTop: 10,
                  }}
                >
                  <strong>السبب:</strong>{" "}
                  {product.safety_reason}
                </p>
              )}
            </>
          ) : isViolation() ? (
            <>
              <strong>⚠️ توجد ملاحظة على المنتج</strong>

              <p style={{ marginBottom: 0 }}>
                توجد إشارة إلى مخالفة أو مستوى خطورة مرتفع.
              </p>

              {product.safety_reason && (
                <p
                  style={{
                    marginBottom: 0,
                    marginTop: 10,
                  }}
                >
                  <strong>التفاصيل:</strong>{" "}
                  {product.safety_reason}
                </p>
              )}
            </>
          ) : isUnclear() ? (
            <>
              <strong>
                ⚠️ المعلومات غير مكتملة أو غير مؤكدة
              </strong>

              <p style={{ marginBottom: 0 }}>
                يمكنك إكمال البيانات من صفحة تعديل المنتج.
                وعند استخدام المنتج في التسويق أو التصميم سيطلب
                منك النظام تأكيد مسؤوليتك عنه.
              </p>
            </>
          ) : (
            <>
              <strong>
                ✅ المنتج واضح ويمكن استخدام بياناته
              </strong>

              <p style={{ marginBottom: 0 }}>
                المعلومات المتوفرة عن المنتج مناسبة للاستخدام
                داخل النظام وفق حالة التحقق الحالية.
              </p>
            </>
          )}
        </div>

        {/* المنتج */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(260px, 350px) minmax(0, 1fr)",
              gap: 25,
              alignItems: "start",
            }}
          >
            <div>
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={{
                    width: "100%",
                    height: 300,
                    objectFit: "contain",
                    background: "#f7f7f7",
                    borderRadius: 18,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 300,
                    borderRadius: 18,
                    background: "#f1f3f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#777",
                  }}
                >
                  لا توجد صورة
                </div>
              )}
            </div>

            <div>
              <h2
                style={{
                  marginTop: 0,
                  fontSize: 28,
                }}
              >
                {product.name}
              </h2>

              {product.brand && (
                <p>
                  <strong>العلامة التجارية:</strong>{" "}
                  {product.brand}
                </p>
              )}

              {product.category && (
                <p>
                  <strong>التصنيف:</strong>{" "}
                  {product.category}
                </p>
              )}

              {product.model_number && (
                <p>
                  <strong>رقم الموديل:</strong>{" "}
                  {product.model_number}
                </p>
              )}

              {product.barcode && (
                <p>
                  <strong>الباركود:</strong>{" "}
                  {product.barcode}
                </p>
              )}

              {product.price !== null &&
                product.price !== undefined && (
                  <p>
                    <strong>السعر:</strong>{" "}
                    {product.price}{" "}
                    {product.currency || "AED"}
                  </p>
                )}

              <p>
                <strong>نوع المنتج:</strong>{" "}
                {product.product_type === "imported"
                  ? "مستورد"
                  : "محلي"}
              </p>

              {product.description && (
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    borderRadius: 14,
                    background: "#f7faf8",
                  }}
                >
                  <strong>الوصف</strong>

                  <p
                    style={{
                      whiteSpace: "pre-wrap",
                      marginBottom: 0,
                    }}
                  >
                    {product.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* مؤشرات الذكاء */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 15,
            marginBottom: 20,
          }}
        >
          <InfoCard
            title="حالة الذكاء"
            value={product.ai_status || "غير محدد"}
          />

          <InfoCard
            title="درجة الثقة"
            value={confidence}
          />

          <InfoCard
            title="التحقق"
            value={
              verificationDate
                ? new Date(
                    verificationDate
                  ).toLocaleDateString("ar-AE")
                : "غير محدد"
            }
          />
        </section>

        {/* التفاصيل */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            معلومات المنتج
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: 15,
            }}
          >
            <Detail
              title="الشركة المصنعة"
              value={product.manufacturer}
            />

            <Detail
              title="بلد المنشأ"
              value={product.country_of_origin}
            />

            <Detail
              title="الحجم / الكمية"
              value={product.size_or_volume}
            />

            <Detail
              title="الفئة المستهدفة"
              value={product.target_audience}
            />

            <Detail
              title="الاستخدامات"
              value={product.uses}
            />

            <Detail
              title="المميزات"
              value={product.features}
            />

            <Detail
              title="المواصفات"
              value={product.specifications}
            />

            <Detail
              title="المكونات"
              value={product.ingredients}
            />

            <Detail
              title="التحذيرات"
              value={product.warnings}
            />

            <Detail
              title="التخزين"
              value={product.storage}
            />

            <Detail
              title="الضمان"
              value={product.warranty}
            />
          </div>
        </section>

        {/* مصادر */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            🔎 مصادر التحقق
          </h2>

          {sources.length === 0 ? (
            <p style={{ color: "#777" }}>
              لا توجد مصادر محفوظة لهذا المنتج.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {sources.map((source, index) => {
                const label = sourceLabel(source);
                const url = sourceUrl(source);

                if (!label) return null;

                return (
                  <div
                    key={index}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "#f7faf8",
                      border: "1px solid #e0e8e3",
                    }}
                  >
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#16834b",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        {label}
                      </a>
                    ) : (
                      <span>{label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* أزرار */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/edit-product/${product.id}`}
            style={{
              flex: 1,
              minWidth: 180,
              textAlign: "center",
              padding: "15px 20px",
              borderRadius: 14,
              background: "#eef1ef",
              color: "#333",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            ✏️ تعديل المنتج
          </Link>

          {!isLocked() && (
            <>
              <Link
                href={`/marketing/${product.id}`}
                style={{
                  flex: 1,
                  minWidth: 180,
                  textAlign: "center",
                  padding: "15px 20px",
                  borderRadius: 14,
                  background: "#16834b",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 800,
                }}
              >
                🚀 التسويق
              </Link>

              <Link
                href="/designs"
                style={{
                  flex: 1,
                  minWidth: 180,
                  textAlign: "center",
                  padding: "15px 20px",
                  borderRadius: 14,
                  background: "#e9f1ff",
                  color: "#174ea6",
                  textDecoration: "none",
                  fontWeight: 800,
                }}
              >
                🎨 التصميم
              </Link>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 750px) {
          section > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function InfoCard({ title, value }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: 20,
        boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          color: "#777",
          fontSize: 14,
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <strong
        style={{
          fontSize: 18,
          wordBreak: "break-word",
        }}
      >
        {value || "غير محدد"}
      </strong>
    </div>
  );
}

function Detail({ title, value }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "#f7faf8",
        border: "1px solid #e0e8e3",
      }}
    >
      <div
        style={{
          color: "#777",
          fontSize: 14,
          marginBottom: 7,
        }}
      >
        {title}
      </div>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.7,
        }}
      >
        {value || "غير متوفر"}
      </div>
    </div>
  );
}
