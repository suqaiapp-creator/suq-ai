"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function ProductIntelligencePage({ params }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    description: "",
    specifications: "",
    features: "",
  });

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) {
        console.error(error);
        setMessage("❌ تعذر تحميل المنتج.");
        return;
      }

      setProduct(data);

      setForm({
        name: data.name || "",
        brand: data.brand || "",
        category: data.category || "",
        price:
          data.price !== null && data.price !== undefined
            ? String(data.price)
            : "",
        description: data.description || "",
        specifications: data.specifications || "",
        features: data.features || "",
      });
    } catch (error) {
      console.error(error);
      setMessage("❌ حدث خطأ أثناء تحميل المنتج.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function approveProduct() {
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          category: form.category.trim() || null,
          price:
            form.price === ""
              ? null
              : Number(form.price),
          description:
            form.description.trim() || null,
          specifications:
            form.specifications.trim() || null,
          features:
            form.features.trim() || null,
          verification_status: "verified",
          ai_status: "completed",
        })
        .eq("id", params.id);

      if (error) {
        console.error(error);
        throw new Error(
          "تعذر حفظ واعتماد معلومات المنتج."
        );
      }

      setProduct((current) => ({
        ...current,
        name: form.name,
        brand: form.brand,
        category: form.category,
        price:
          form.price === ""
            ? null
            : Number(form.price),
        description: form.description,
        specifications: form.specifications,
        features: form.features,
        verification_status: "verified",
        ai_status: "completed",
      }));

      setMessage(
        "✅ تم اعتماد معلومات المنتج بنجاح."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        `❌ ${error.message || "حدث خطأ أثناء الحفظ."}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f7fb",
          padding: "40px 18px",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            maxWidth: "700px",
            margin: "0 auto",
            padding: "35px",
            borderRadius: "20px",
          }}
        >
          🧠 جاري تحميل معلومات المنتج...
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
          background: "#f7f7fb",
          padding: "40px 18px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            background: "#fff",
            padding: "30px",
            borderRadius: "20px",
          }}
        >
          {message || "المنتج غير موجود."}
        </div>
      </main>
    );
  }

  const isVerified =
    product.verification_status === "verified";

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f7fb",
        padding: "25px 18px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "850px",
          margin: "0 auto",
        }}
      >
        <a
          href="/products"
          style={{
            display: "inline-block",
            marginBottom: "18px",
            color: "#6246e5",
            textDecoration: "none",
            fontWeight: "700",
          }}
        >
          ← إدارة المنتجات
        </a>

        <div
          style={{
            background: "#fff",
            borderRadius: "24px",
            padding: "25px",
            boxShadow:
              "0 5px 25px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "15px",
              marginBottom: "25px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#6246e5",
                  fontWeight: "800",
                  marginBottom: "8px",
                }}
              >
                🧠 ذكاء المنتج
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "30px",
                }}
              >
                مراجعة معلومات المنتج
              </h1>

              <p
                style={{
                  marginTop: "8px",
                  marginBottom: 0,
                  color: "#666",
                  lineHeight: "1.7",
                }}
              >
                راجع المعلومات التي جهزها الذكاء
                الاصطناعي قبل استخدامها في التسويق.
              </p>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                background: isVerified
                  ? "#eaf8f0"
                  : "#fff5d9",
                color: isVerified
                  ? "#147a48"
                  : "#806000",
                fontWeight: "800",
                whiteSpace: "nowrap",
              }}
            >
              {isVerified
                ? "✅ معتمد"
                : "⚠️ يحتاج مراجعة"}
            </div>
          </div>

          {/* Product image */}
          {product.image_url && (
            <div
              style={{
                marginBottom: "25px",
                textAlign: "center",
                background: "#fafafa",
                borderRadius: "18px",
                padding: "20px",
              }}
            >
              <img
                src={product.image_url}
                alt={product.name}
                style={{
                  width: "100%",
                  maxHeight: "330px",
                  objectFit: "contain",
                  borderRadius: "14px",
                }}
              />
            </div>
          )}

          {/* AI notice */}
          <div
            style={{
              marginBottom: "25px",
              padding: "16px",
              background: "#f3efff",
              border: "1px solid #e3dbff",
              borderRadius: "15px",
              lineHeight: "1.8",
              color: "#4b3b8f",
            }}
          >
            <strong>🔎 مراجعة قبل الاعتماد</strong>
            <br />
            عدّل أي معلومة تراها غير دقيقة، ثم اضغط
            «اعتماد المعلومات». لا نريد استخدام أي
            معلومة غير مؤكدة في التسويق.
          </div>

          <Field
            label="اسم المنتج"
            value={form.name}
            onChange={(value) =>
              updateField("name", value)
            }
          />

          <Field
            label="العلامة التجارية"
            value={form.brand}
            onChange={(value) =>
              updateField("brand", value)
            }
          />

          <Field
            label="التصنيف"
            value={form.category}
            onChange={(value) =>
              updateField("category", value)
            }
          />

          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "700",
              }}
            >
              السعر
            </label>

            <div
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  updateField(
                    "price",
                    e.target.value
                  )
                }
                style={{
                  flex: 1,
                  padding: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  fontSize: "16px",
                  boxSizing: "border-box",
                }}
              />

              <div
                style={{
                  padding: "14px 16px",
                  background: "#f3f3f6",
                  borderRadius: "12px",
                  fontWeight: "700",
                }}
              >
                AED
              </div>
            </div>
          </div>

          <TextArea
            label="الوصف"
            value={form.description}
            onChange={(value) =>
              updateField(
                "description",
                value
              )
            }
          />

          <TextArea
            label="المواصفات"
            value={form.specifications}
            onChange={(value) =>
              updateField(
                "specifications",
                value
              )
            }
          />

          <TextArea
            label="المميزات"
            value={form.features}
            onChange={(value) =>
              updateField(
                "features",
                value
              )
            }
          />

          {/* Information that will be added later */}
          <div
            style={{
              marginTop: "5px",
              marginBottom: "20px",
              padding: "18px",
              background: "#fafafa",
              border: "1px solid #eee",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                fontWeight: "800",
                marginBottom: "10px",
              }}
            >
              🔎 معلومات إضافية
            </div>

            <InfoRow
              label="الاستخدامات"
              value="سيتم تجهيزها في المرحلة القادمة"
            />

            <InfoRow
              label="الجمهور المستهدف"
              value="سيتم تجهيزها في المرحلة القادمة"
            />

            <InfoRow
              label="الشركة المصنعة"
              value="سيتم التحقق منها لاحقًا"
            />

            <InfoRow
              label="بلد المنشأ"
              value="سيتم التحقق منه لاحقًا"
            />
          </div>

          {/* Verification */}
          <div
            style={{
              marginBottom: "20px",
              padding: "18px",
              background: "#fff8e7",
              border: "1px solid #f0dda6",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                fontWeight: "800",
                marginBottom: "8px",
              }}
            >
              ⚠️ حالة التحقق
            </div>

            <div
              style={{
                color: "#665400",
                lineHeight: "1.7",
              }}
            >
              هذه المعلومات تم تجهيزها بواسطة الذكاء
              الاصطناعي، ويجب مراجعتها قبل اعتمادها.
            </div>
          </div>

          {message && (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px",
                borderRadius: "12px",
                background: message.startsWith("❌")
                  ? "#fff0f0"
                  : "#eefbf3",
                color: message.startsWith("❌")
                  ? "#b42318"
                  : "#16794c",
                fontWeight: "700",
                lineHeight: "1.7",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={approveProduct}
            disabled={saving}
            style={{
              width: "100%",
              border: "none",
              background: saving
                ? "#999"
                : "#16794c",
              color: "#fff",
              padding: "17px",
              borderRadius: "14px",
              fontSize: "18px",
              fontWeight: "800",
              cursor: saving
                ? "default"
                : "pointer",
            }}
          >
            {saving
              ? "⏳ جاري الحفظ..."
              : "✅ اعتماد معلومات المنتج"}
          </button>

          <a
            href={`/marketing/${product.id}`}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              marginTop: "12px",
              padding: "15px",
              borderRadius: "14px",
              background: "#6246e5",
              color: "#fff",
              textAlign: "center",
              textDecoration: "none",
              fontSize: "17px",
              fontWeight: "800",
            }}
          >
            🚀 الانتقال إلى التسويق
          </a>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <label
        style={{
          display: "block",
          marginBottom: "8px",
          fontWeight: "700",
        }}
      >
        {label}
      </label>

      <input
        type="text"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        style={{
          width: "100%",
          padding: "14px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          fontSize: "16px",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <label
        style={{
          display: "block",
          marginBottom: "8px",
          fontWeight: "700",
        }}
      >
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        rows={5}
        style={{
          width: "100%",
          padding: "14px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          fontSize: "16px",
          boxSizing: "border-box",
          resize: "vertical",
          fontFamily: "Arial, sans-serif",
          lineHeight: "1.7",
        }}
      />
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "15px",
        padding: "10px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <strong>{label}</strong>
      <span style={{ color: "#777" }}>
        {value}
      </span>
    </div>
  );
}
