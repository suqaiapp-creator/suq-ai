"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

export default function DesignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [design, setDesign] = useState(null);
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    loadDesign();
  }, [id]);

  async function loadDesign() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      // جلب المحل
      const { data: shopData, error: shopError } =
        await supabase
          .from("shops")
          .select("*")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

      if (shopError) {
        throw new Error(shopError.message);
      }

      if (!shopData) {
        throw new Error("المحل غير موجود.");
      }

      setShop(shopData);

      // جلب التصميم
      const { data: designData, error: designError } =
        await supabase
          .from("ad_images")
          .select("*")
          .eq("id", id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

      if (designError) {
        throw new Error(designError.message);
      }

      if (!designData) {
        throw new Error("التصميم غير موجود.");
      }

      setDesign(designData);

      // جلب المنتج
      if (designData.product_id) {
        const { data: productData, error: productError } =
          await supabase
            .from("products")
            .select("*")
            .eq("id", designData.product_id)
            .eq("shop_id", shopData.id)
            .maybeSingle();

        if (!productError) {
          setProduct(productData || null);
        }
      }
    } catch (err) {
      console.error("DESIGN DETAILS ERROR:", err);
      setError(err?.message || "تعذر تحميل التصميم.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDesign() {
    if (!design?.id) return;

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا التصميم؟"
    );

    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase
        .from("ad_images")
        .delete()
        .eq("id", design.id)
        .eq("shop_id", shop?.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/designs");
    } catch (err) {
      console.error("DELETE DESIGN ERROR:", err);
      alert("تعذر حذف التصميم.");
    }
  }

  async function downloadDesign() {
    if (!design?.image_url) return;

    try {
      const response = await fetch(design.image_url);

      if (!response.ok) {
        throw new Error("تعذر تحميل الصورة.");
      }

      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `suq-ai-design-${design.id}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);

      // حل بديل للجوال
      window.open(design.image_url, "_blank");
    }
  }

  async function shareDesign() {
    if (!design?.image_url) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: product?.name || "تصميم إعلاني",
          text: `تصميم إعلاني من ${shop?.name || "سوق AI"}`,
          url: design.image_url,
        });
      } else {
        await navigator.clipboard.writeText(
          design.image_url
        );

        alert("تم نسخ رابط التصميم.");
      }
    } catch (err) {
      console.log("Share cancelled or failed:", err);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f5f7f6",
          padding: "30px 16px",
          fontFamily:
            "Arial, Tahoma, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            textAlign: "center",
            paddingTop: 100,
          }}
        >
          <div
            style={{
              fontSize: 42,
              marginBottom: 15,
            }}
          >
            ⏳
          </div>

          <h2 style={{ margin: 0 }}>
            جاري تحميل التصميم...
          </h2>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f5f7f6",
          padding: "30px 16px",
          fontFamily:
            "Arial, Tahoma, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
          }}
        >
          <button
            onClick={() => router.push("/designs")}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              marginBottom: 25,
            }}
          >
            ← العودة للتصاميم
          </button>

          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 30,
              textAlign: "center",
              boxShadow:
                "0 10px 30px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                fontSize: 45,
                marginBottom: 15,
              }}
            >
              ⚠️
            </div>

            <h2>تعذر تحميل التصميم</h2>

            <p
              style={{
                color: "#666",
                marginTop: 10,
              }}
            >
              {error}
            </p>

            <button
              onClick={loadDesign}
              style={{
                marginTop: 20,
                padding: "12px 24px",
                borderRadius: 12,
                border: "none",
                background: "#16834b",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f5f7f6",
        padding: "25px 16px 50px",
        fontFamily:
          "Arial, Tahoma, sans-serif",
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
            alignItems: "center",
            justifyContent: "space-between",
            gap: 15,
            marginBottom: 25,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => router.push("/designs")}
            style={{
              border: "none",
              background: "#fff",
              padding: "11px 18px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ← العودة للتصاميم
          </button>

          <h1
            style={{
              margin: 0,
              fontSize: 25,
            }}
          >
            تفاصيل التصميم
          </h1>
        </div>

        {/* Main */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
            gap: 20,
          }}
        >
          {/* Design */}
          <section
            style={{
              background: "#fff",
              borderRadius: 22,
              padding: 18,
              boxShadow:
                "0 10px 30px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                background: "#f1f3f2",
                borderRadius: 18,
                padding: 15,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 400,
              }}
            >
              {design?.image_url ? (
                <img
                  src={design.image_url}
                  alt={
                    product?.name ||
                    "التصميم الإعلاني"
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: 750,
                    height: "auto",
                    maxHeight: "75vh",
                    objectFit: "contain",
                    borderRadius: 12,
                  }}
                  onError={(event) => {
                    console.error(
                      "DESIGN IMAGE LOAD ERROR:",
                      design.image_url
                    );

                    event.currentTarget.style.display =
                      "none";

                    const message =
                      document.getElementById(
                        "design-image-error"
                      );

                    if (message) {
                      message.style.display = "block";
                    }
                  }}
                />
              ) : null}

              <div
                id="design-image-error"
                style={{
                  display: design?.image_url
                    ? "none"
                    : "block",
                  textAlign: "center",
                  color: "#777",
                  padding: 40,
                }}
              >
                <div
                  style={{
                    fontSize: 45,
                    marginBottom: 10,
                  }}
                >
                  🖼️
                </div>

                <strong>
                  الصورة غير متوفرة
                </strong>

                <p
                  style={{
                    fontSize: 13,
                    marginTop: 8,
                  }}
                >
                  رابط الصورة غير موجود في
                  قاعدة البيانات.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 10,
                marginTop: 15,
              }}
            >
              <button
                onClick={() =>
                  window.open(
                    design?.image_url,
                    "_blank"
                  )
                }
                disabled={!design?.image_url}
                style={{
                  padding: "13px 10px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                فتح الصورة
              </button>

              <button
                onClick={downloadDesign}
                disabled={!design?.image_url}
                style={{
                  padding: "13px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: "#16834b",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                تحميل
              </button>

              <button
                onClick={shareDesign}
                disabled={!design?.image_url}
                style={{
                  padding: "13px 10px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                مشاركة
              </button>
            </div>
          </section>

          {/* Info */}
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 15,
            }}
          >
            {/* Product */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 20,
                boxShadow:
                  "0 8px 25px rgba(0,0,0,0.05)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                المنتج
              </h3>

              {product?.image_url && (
                <img
                  src={product.image_url}
                  alt={product?.name || "المنتج"}
                  style={{
                    width: "100%",
                    height: 180,
                    objectFit: "contain",
                    background: "#f7f7f7",
                    borderRadius: 12,
                    marginBottom: 15,
                  }}
                />
              )}

              <div
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                }}
              >
                {product?.name || "منتج"}
              </div>

              {product?.brand && (
                <div
                  style={{
                    color: "#666",
                    marginTop: 6,
                  }}
                >
                  {product.brand}
                </div>
              )}

              {product?.price != null && (
                <div
                  style={{
                    color: "#16834b",
                    fontWeight: "bold",
                    marginTop: 10,
                  }}
                >
                  {product.price}{" "}
                  {product.currency || "AED"}
                </div>
              )}
            </div>

            {/* Design info */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 20,
                boxShadow:
                  "0 8px 25px rgba(0,0,0,0.05)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                إعدادات التصميم
              </h3>

              <InfoRow
                label="الحالة"
                value={
                  design?.status === "completed"
                    ? "مكتمل"
                    : design?.status || "غير معروف"
                }
              />

              <InfoRow
                label="المقاس"
                value={
                  design?.format || "1:1"
                }
              />

              {design?.created_at && (
                <InfoRow
                  label="تاريخ الإنشاء"
                  value={new Date(
                    design.created_at
                  ).toLocaleString("ar-AE")}
                />
              )}
            </div>

            {/* Shop */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 20,
                boxShadow:
                  "0 8px 25px rgba(0,0,0,0.05)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                بيانات المحل
              </h3>

              <InfoRow
                label="المحل"
                value={shop?.name || "-"}
              />

              {shop?.phone && (
                <InfoRow
                  label="الهاتف"
                  value={shop.phone}
                />
              )}

              {shop?.whatsapp && (
                <InfoRow
                  label="واتساب"
                  value={shop.whatsapp}
                />
              )}

              {shop?.instagram && (
                <InfoRow
                  label="Instagram"
                  value={shop.instagram}
                />
              )}
            </div>

            {/* Delete */}
            <button
              onClick={deleteDesign}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                border: "1px solid #e5bcbc",
                background: "#fff",
                color: "#b42318",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              حذف التصميم
            </button>

            <button
              onClick={() => router.push("/designs")}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                border: "none",
                background: "#16834b",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              إنشاء تصميم جديد
            </button>
          </aside>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 800px) {
          main {
            padding: 18px 12px 40px !important;
          }

          h1 {
            font-size: 21px !important;
          }

          section {
            padding: 12px !important;
          }

          aside {
            width: 100%;
          }

          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }

          img {
            max-height: 65vh !important;
          }
        }
      `}</style>
    </main>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 15,
        padding: "9px 0",
        borderBottom: "1px solid #eee",
        fontSize: 14,
      }}
    >
      <span style={{ color: "#777" }}>
        {label}
      </span>

      <strong
        style={{
          textAlign: "left",
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
