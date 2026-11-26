"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

const supabase = createClient();

export default function DesignDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [shop, setShop] = useState(null);
  const [design, setDesign] = useState(null);
  const [product, setProduct] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (id) {
      loadDesign();
    }
  }, [id]);

  async function loadDesign() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.replace("/login");
        return;
      }

      const {
        data: shopData,
        error: shopError,
      } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", currentUser.id)
        .order("created_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        setError("لم يتم العثور على المحل.");
        return;
      }

      setShop(shopData);

      const {
        data: designData,
        error: designError,
      } = await supabase
        .from("ad_images")
        .select("*")
        .eq("id", id)
        .eq("shop_id", shopData.id)
        .maybeSingle();

      if (designError) {
        throw designError;
      }

      if (!designData) {
        setError("التصميم غير موجود.");
        return;
      }

      setDesign(designData);

      if (designData.product_id) {
        const {
          data: productData,
          error: productError,
        } = await supabase
          .from("products")
          .select("*")
          .eq("id", designData.product_id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

        if (productError) {
          console.error(productError);
        }

        setProduct(productData || null);
      }
    } catch (err) {
      console.error(err);

      setError(
        "حدث خطأ أثناء تحميل تفاصيل التصميم."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteDesign() {
    if (!design) return;

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا التصميم؟"
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("ad_images")
        .delete()
        .eq("id", design.id)
        .eq("shop_id", shop?.id);

      if (deleteError) {
        throw deleteError;
      }

      router.replace("/designs");
    } catch (err) {
      console.error(err);

      setError("تعذر حذف التصميم.");
    } finally {
      setDeleting(false);
    }
  }

  function getStatus() {
    if (!design) {
      return {
        text: "غير معروف",
        background: "#f5f5f5",
        color: "#555",
      };
    }

    if (design.status === "completed") {
      return {
        text: "مكتمل",
        background: "#ecfdf3",
        color: "#067647",
      };
    }

    if (
      design.status === "processing" ||
      design.status === "generating"
    ) {
      return {
        text: "قيد الإنشاء",
        background: "#eff8ff",
        color: "#175cd3",
      };
    }

    if (design.status === "failed") {
      return {
        text: "فشل",
        background: "#fef3f2",
        color: "#b42318",
      };
    }

    return {
      text: "بانتظار الإنشاء",
      background: "#fffaeb",
      color: "#b54708",
    };
  }

  function formatDate(date) {
    if (!date) return "";

    try {
      return new Intl.DateTimeFormat(
        "ar-AE",
        {
          dateStyle: "medium",
          timeStyle: "short",
        }
      ).format(new Date(date));
    } catch {
      return date;
    }
  }

  function shareDesign() {
    if (!design?.image_url) {
      return;
    }

    if (navigator.share) {
      navigator
        .share({
          title:
            product?.name ||
            "تصميم إعلاني",
          text:
            `تصميم إعلاني لـ ${
              product?.name ||
              "المنتج"
            }`,
          url: design.image_url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        ?.writeText(design.image_url)
        .then(() => {
          setMessage(
            "تم نسخ رابط التصميم."
          );
        })
        .catch(() => {
          setMessage(
            "يمكنك فتح التصميم ومشاركة الرابط."
          );
        });
    }
  }

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
          fontFamily:
            "Arial, sans-serif",
          color: "#17201c",
        }}
      >
        جاري تحميل التصميم...
      </main>
    );
  }

  if (error && !design) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f6f8f7",
          fontFamily:
            "Arial, sans-serif",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "80px auto",
            background: "#fff",
            border:
              "1px solid #e1e7e3",
            borderRadius: 20,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 42,
              marginBottom: 14,
            }}
          >
            ⚠️
          </div>

          <h2
            style={{
              margin: "0 0 10px",
            }}
          >
            {error}
          </h2>

          <button
            onClick={() =>
              router.push("/designs")
            }
            style={{
              marginTop: 16,
              border: 0,
              borderRadius: 12,
              padding:
                "12px 20px",
              background:
                "#15803d",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ← العودة للتصاميم
          </button>
        </div>
      </main>
    );
  }

  const status = getStatus();

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f6f8f7",
        color: "#17201c",
        fontFamily:
          "Arial, sans-serif",
        paddingBottom: 60,
      }}
    >
      <div
        style={{
          maxWidth: 1150,
          margin: "0 auto",
          padding:
            "22px 16px",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 14,
            marginBottom: 20,
            flexWrap:
              "wrap",
          }}
        >
          <div>
            <div
              style={{
                color:
                  "#15803d",
                fontWeight: 900,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              سوق AI
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              🎨 تفاصيل التصميم
            </h1>

            <div
              style={{
                color:
                  "#66736d",
                marginTop: 6,
                fontSize: 14,
              }}
            >
              {product?.name ||
                "التصميم الإعلاني"}
            </div>
          </div>

          <button
            onClick={() =>
              router.push("/designs")
            }
            style={{
              border:
                "1px solid #d7dfda",
              background:
                "#fff",
              color:
                "#1f2933",
              borderRadius: 12,
              padding:
                "11px 16px",
              fontWeight: 900,
              cursor:
                "pointer",
            }}
          >
            ← كل التصاميم
          </button>
        </header>

        {message && (
          <div
            style={{
              background:
                "#ecfdf3",
              border:
                "1px solid #abefc6",
              color:
                "#067647",
              borderRadius: 14,
              padding: 13,
              marginBottom: 16,
              fontWeight: 800,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background:
                "#fef3f2",
              border:
                "1px solid #fecdca",
              color:
                "#b42318",
              borderRadius: 14,
              padding: 13,
              marginBottom: 16,
              fontWeight: 800,
            }}
          >
            {error}
          </div>
        )}

        <div
          className="details-layout"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.5fr) minmax(300px, .7fr)",
            gap: 20,
            alignItems:
              "start",
          }}
        >
          <section
            style={{
              background:
                "#fff",
              border:
                "1px solid #e1e7e3",
              borderRadius: 20,
              overflow:
                "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom:
                  "1px solid #e8edea",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 10,
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 17,
                  }}
                >
                  التصميم
                </div>

                <div
                  style={{
                    color:
                      "#66736d",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {design?.format ||
                    "1:1"}
                </div>
              </div>

              <span
                style={{
                  background:
                    status.background,
                  color:
                    status.color,
                  padding:
                    "7px 12px",
                  borderRadius:
                    999,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {status.text}
              </span>
            </div>

            <div
              style={{
                background:
                  "#f2f4f3",
                padding: 16,
                minHeight: 400,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
              }}
            >
              {design?.image_url ? (
                <img
                  src={
                    design.image_url
                  }
                  alt={
                    product?.name ||
                    "التصميم"
                  }
                  style={{
                    display:
                      "block",
                    width:
                      "100%",
                    maxWidth: 800,
                    maxHeight:
                      "75vh",
                    objectFit:
                      "contain",
                    borderRadius:
                      12,
                    boxShadow:
                      "0 10px 35px rgba(0,0,0,.12)",
                  }}
                />
              ) : (
                <div
                  style={{
                    textAlign:
                      "center",
                    color:
                      "#66736d",
                    padding: 50,
                  }}
                >
                  <div
                    style={{
                      fontSize: 44,
                      marginBottom: 12,
                    }}
                  >
                    🎨
                  </div>

                  <div
                    style={{
                      fontWeight: 900,
                      marginBottom: 6,
                    }}
                  >
                    لم يتم استلام صورة التصميم
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                    }}
                  >
                    حالة التصميم:{" "}
                    {status.text}
                  </div>
                </div>
              )}
            </div>

            {design?.image_url && (
              <div
                className="action-grid"
                style={{
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: 10,
                }}
              >
                <a
                  href={
                    design.image_url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration:
                      "none",
                    textAlign:
                      "center",
                    background:
                      "#15803d",
                    color:
                      "#fff",
                    borderRadius:
                      12,
                    padding:
                      "13px 10px",
                    fontWeight:
                      900,
                    fontSize: 13,
                  }}
                >
                  👁️ فتح
                </a>

                <a
                  href={
                    design.image_url
                  }
                  download
                  style={{
                    textDecoration:
                      "none",
                    textAlign:
                      "center",
                    background:
                      "#f0fdf4",
                    color:
                      "#166534",
                    border:
                      "1px solid #bbf7d0",
                    borderRadius:
                      12,
                    padding:
                      "13px 10px",
                    fontWeight:
                      900,
                    fontSize: 13,
                  }}
                >
                  ⬇️ تحميل
                </a>

                <button
                  onClick={
                    shareDesign
                  }
                  style={{
                    border:
                      "1px solid #d9e1dc",
                    background:
                      "#fff",
                    color:
                      "#17201c",
                    borderRadius:
                      12,
                    padding:
                      "13px 10px",
                    fontWeight:
                      900,
                    fontSize: 13,
                    cursor:
                      "pointer",
                  }}
                >
                  📤 مشاركة
                </button>
              </div>
            )}
          </section>

          <aside>
            <div
              style={{
                background:
                  "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 18,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 14px",
                  fontSize: 18,
                }}
              >
                🛍️ المنتج
              </h2>

              {product ? (
                <>
                  {product.image_url && (
                    <div
                      style={{
                        width:
                          "100%",
                        height: 170,
                        borderRadius:
                          14,
                        overflow:
                          "hidden",
                        background:
                          "#f5f7f6",
                        marginBottom:
                          12,
                      }}
                    >
                      <img
                        src={
                          product.image_url
                        }
                        alt={
                          product.name
                        }
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "contain",
                        }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 900,
                      lineHeight:
                        1.5,
                    }}
                  >
                    {
                      product.name
                    }
                  </div>

                  {product.brand && (
                    <div
                      style={{
                        color:
                          "#66736d",
                        fontSize: 13,
                        marginTop: 5,
                      }}
                    >
                      {
                        product.brand
                      }
                    </div>
                  )}

                  {product.category && (
                    <div
                      style={{
                        marginTop: 10,
                        color:
                          "#66736d",
                        fontSize: 13,
                      }}
                    >
                      التصنيف:{" "}
                      {
                        product.category
                      }
                    </div>
                  )}

                  {product.price !==
                    null &&
                    product.price !==
                      undefined && (
                      <div
                        style={{
                          marginTop: 8,
                          fontWeight:
                            900,
                          color:
                            "#15803d",
                        }}
                      >
                        السعر:{" "}
                        {
                          product.price
                        }{" "}
                        {product.currency ||
                          "AED"}
                      </div>
                    )}
                </>
              ) : (
                <div
                  style={{
                    color:
                      "#66736d",
                    fontSize: 13,
                  }}
                >
                  لم يتم العثور على بيانات المنتج.
                </div>
              )}
            </div>

            <div
              style={{
                background:
                  "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding: 18,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 14px",
                  fontSize: 18,
                }}
              >
                ⚙️ إعدادات التصميم
              </h2>

              <div
                style={{
                  display:
                    "grid",
                  gap: 11,
                  fontSize: 13,
                }}
              >
                <InfoRow
                  label="المقاس"
                  value={
                    design?.format ||
                    "1:1"
                  }
                />

                <InfoRow
                  label="الحالة"
                  value={
                    status.text
                  }
                />

                {design?.created_at && (
                  <InfoRow
                    label="تاريخ الإنشاء"
                    value={formatDate(
                      design.created_at
                    )}
                  />
                )}

                {design?.completed_at && (
                  <InfoRow
                    label="اكتمل في"
                    value={formatDate(
                      design.completed_at
                    )}
                  />
                )}

                {design?.generation_started_at && (
                  <InfoRow
                    label="بدأ التوليد"
                    value={formatDate(
                      design.generation_started_at
                    )}
                  />
                )}
              </div>
            </div>

            {shop && (
              <div
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    margin:
                      "0 0 14px",
                    fontSize: 18,
                  }}
                >
                  🏪 المحل
                </h2>

                <div
                  style={{
                    fontWeight:
                      900,
                    fontSize: 16,
                  }}
                >
                  {
                    shop.name
                  }
                </div>

                {shop.phone && (
                  <div
                    style={{
                      color:
                        "#66736d",
                      fontSize: 13,
                      marginTop: 7,
                    }}
                  >
                    ☎️{" "}
                    {
                      shop.phone
                    }
                  </div>
                )}

                {shop.whatsapp && (
                  <div
                    style={{
                      color:
                        "#66736d",
                      fontSize: 13,
                      marginTop: 7,
                    }}
                  >
                    💬{" "}
                    {
                      shop.whatsapp
                    }
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() =>
                router.push(
                  "/designs"
                )
              }
              style={{
                width:
                  "100%",
                border: 0,
                borderRadius:
                  14,
                padding: 15,
                background:
                  "#15803d",
                color:
                  "#fff",
                fontWeight:
                  900,
                fontSize: 15,
                cursor:
                  "pointer",
                marginBottom:
                  10,
              }}
            >
              🎨 إنشاء تصميم جديد
            </button>

            <button
              onClick={
                deleteDesign
              }
              disabled={
                deleting
              }
              style={{
                width:
                  "100%",
                border:
                  "1px solid #fecdca",
                borderRadius:
                  14,
                padding: 13,
                background:
                  "#fff",
                color:
                  "#b42318",
                fontWeight:
                  900,
                fontSize: 14,
                cursor:
                  deleting
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  deleting
                    ? 0.6
                    : 1,
              }}
            >
              {deleting
                ? "جاري الحذف..."
                : "🗑️ حذف التصميم"}
            </button>
          </aside>
        </div>
      </div>

      <style jsx>{`
        button,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        @media (max-width: 900px) {
          .details-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .action-grid {
            grid-template-columns: 1fr !important;
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
        justifyContent:
          "space-between",
        alignItems:
          "flex-start",
        gap: 12,
        paddingBottom: 10,
        borderBottom:
          "1px solid #eef1ef",
      }}
    >
      <span
        style={{
          color: "#66736d",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontWeight: 800,
          textAlign: "left",
          direction: "rtl",
        }}
      >
        {value}
      </span>
    </div>
  );
}
