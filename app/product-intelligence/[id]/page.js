"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function ProductIntelligencePage() {
  const params = useParams();
  const id = params.id;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    description: "",
    specifications: "",
    features: "",
    uses: "",
    target_audience: "",
    manufacturer: "",
    country_of_origin: "",
    size_or_volume: "",
    ingredients: "",
    warnings: "",
    storage: "",
    warranty: "",
    verification_notes: "",
    confidence: "",
  });

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setProduct(data);

    setForm({
      name: data.name || "",
      brand: data.brand || "",
      category: data.category || "",
      price: data.price || "",
      description: data.description || "",
      specifications: data.specifications || "",
      features: data.features || "",

      uses: data.uses || "",
      target_audience: data.target_audience || "",
      manufacturer: data.manufacturer || "",
      country_of_origin: data.country_of_origin || "",
      size_or_volume: data.size_or_volume || "",
      ingredients: data.ingredients || "",
      warnings: data.warnings || "",
      storage: data.storage || "",
      warranty: data.warranty || "",
      verification_notes: data.verification_notes || "",
      confidence: data.confidence || "",
    });

    setLoading(false);
  }

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function saveProduct() {
    setSaving(true);

    const { error } = await supabase
      .from("products")
      .update({
        name: form.name,
        brand: form.brand,
        category: form.category,
        price: form.price || null,
        description: form.description,
        specifications: form.specifications,
        features: form.features,

        ai_status: "completed",
        verification_status: "verified",
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ المعلومات.");
      setSaving(false);
      return;
    }

    setProduct((prev) => ({
      ...prev,
      ...form,
      verification_status: "verified",
      ai_status: "completed",
    }));

    alert("✅ تم اعتماد معلومات المنتج بنجاح");

    setSaving(false);
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "30px 16px",
          background: "#f7f7f7",
          direction: "rtl",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "auto",
            background: "#fff",
            padding: 30,
            borderRadius: 20,
            textAlign: "center",
          }}
        >
          جاري تحميل معلومات المنتج...
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "30px 16px",
          background: "#f7f7f7",
          direction: "rtl",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "auto",
            background: "#fff",
            padding: 30,
            borderRadius: 20,
            textAlign: "center",
          }}
        >
          <h2>المنتج غير موجود</h2>

          <Link href="/products">
            العودة إلى المنتجات
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "25px 16px 50px",
        background: "#f7f7f7",
        direction: "rtl",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 950,
          margin: "auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            background: "#fff",
            borderRadius: 22,
            padding: 24,
            marginBottom: 18,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 15,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 28,
                }}
              >
                🧠 ذكاء المنتج
              </h1>

              <p
                style={{
                  marginTop: 8,
                  color: "#666",
                }}
              >
                مراجعة معلومات المنتج قبل استخدامه في التسويق.
              </p>
            </div>

            <div
              style={{
                background:
                  product.verification_status === "verified"
                    ? "#e8f7ed"
                    : "#fff4d6",
                color:
                  product.verification_status === "verified"
                    ? "#16803c"
                    : "#9a6700",
                padding: "10px 15px",
                borderRadius: 12,
                fontWeight: "bold",
              }}
            >
              {product.verification_status === "verified"
                ? "✅ المعلومات معتمدة"
                : "⚠️ يحتاج مراجعة"}
            </div>
          </div>
        </div>

        {/* PRODUCT IMAGE */}

        {product.image_url && (
          <div
            style={{
              background: "#fff",
              borderRadius: 22,
              padding: 20,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            <img
              src={product.image_url}
              alt={product.name}
              style={{
                maxWidth: "100%",
                width: 280,
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: 15,
              }}
            />
          </div>
        )}

        {/* BASIC INFORMATION */}

        <Section title="📦 المعلومات الأساسية">
          <Field
            label="اسم المنتج"
            value={form.name}
            onChange={(v) => updateField("name", v)}
          />

          <Field
            label="العلامة التجارية"
            value={form.brand}
            onChange={(v) => updateField("brand", v)}
          />

          <Field
            label="التصنيف"
            value={form.category}
            onChange={(v) => updateField("category", v)}
          />

          <Field
            label="السعر"
            value={form.price}
            onChange={(v) => updateField("price", v)}
            type="number"
          />
        </Section>

        {/* DESCRIPTION */}

        <Section title="📝 وصف المنتج">
          <TextArea
            label="الوصف المختصر / الكامل"
            value={form.description}
            onChange={(v) => updateField("description", v)}
          />

          <TextArea
            label="المواصفات"
            value={form.specifications}
            onChange={(v) => updateField("specifications", v)}
          />

          <TextArea
            label="المميزات"
            value={form.features}
            onChange={(v) => updateField("features", v)}
          />
        </Section>

        {/* PRODUCT INTELLIGENCE */}

        <Section title="🔎 معلومات إضافية">
          <TextArea
            label="الاستخدامات"
            value={form.uses}
            onChange={(v) => updateField("uses", v)}
            placeholder="مثال: الاستخدامات المعروفة للمنتج"
          />

          <TextArea
            label="الجمهور المستهدف"
            value={form.target_audience}
            onChange={(v) =>
              updateField("target_audience", v)
            }
            placeholder="مثال: رجال، نساء، أطفال..."
          />

          <Field
            label="الشركة المصنعة"
            value={form.manufacturer}
            onChange={(v) =>
              updateField("manufacturer", v)
            }
          />

          <Field
            label="بلد المنشأ"
            value={form.country_of_origin}
            onChange={(v) =>
              updateField("country_of_origin", v)
            }
          />

          <Field
            label="الحجم / السعة"
            value={form.size_or_volume}
            onChange={(v) =>
              updateField("size_or_volume", v)
            }
          />

          <TextArea
            label="المكونات"
            value={form.ingredients}
            onChange={(v) =>
              updateField("ingredients", v)
            }
          />

          <TextArea
            label="التحذيرات"
            value={form.warnings}
            onChange={(v) =>
              updateField("warnings", v)
            }
          />

          <TextArea
            label="طريقة التخزين"
            value={form.storage}
            onChange={(v) =>
              updateField("storage", v)
            }
          />

          <TextArea
            label="الضمان"
            value={form.warranty}
            onChange={(v) =>
              updateField("warranty", v)
            }
          />
        </Section>

        {/* VERIFICATION */}

        <Section title="🛡️ التحقق">
          <div
            style={{
              background: "#f8f9fa",
              padding: 16,
              borderRadius: 14,
              marginBottom: 15,
              lineHeight: 1.8,
            }}
          >
            <strong>ملاحظات التحقق</strong>

            <textarea
              value={form.verification_notes}
              onChange={(e) =>
                updateField(
                  "verification_notes",
                  e.target.value
                )
              }
              placeholder="ملاحظات حول المصادر أو المعلومات التي تحتاج مراجعة..."
              style={{
                width: "100%",
                minHeight: 100,
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ddd",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div
            style={{
              background: "#eef6ff",
              padding: 16,
              borderRadius: 14,
              lineHeight: 1.8,
            }}
          >
            <strong>📊 درجة الثقة</strong>

            <div
              style={{
                marginTop: 8,
                fontSize: 18,
                fontWeight: "bold",
              }}
            >
              {form.confidence || "غير محددة"}
            </div>
          </div>
        </Section>

        {/* ACTIONS */}

        <div
          style={{
            background: "#fff",
            padding: 20,
            borderRadius: 22,
            marginTop: 18,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <button
            onClick={saveProduct}
            disabled={saving}
            style={{
              width: "100%",
              padding: 17,
              border: "none",
              borderRadius: 14,
              background: saving
                ? "#999"
                : "#111",
              color: "#fff",
              fontSize: 17,
              fontWeight: "bold",
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
          >
            {saving
              ? "جاري الحفظ..."
              : "✅ اعتماد معلومات المنتج"}
          </button>

          <Link
            href={`/marketing/${id}`}
            style={{
              display: "block",
              marginTop: 12,
              textAlign: "center",
              padding: 15,
              borderRadius: 14,
              background: "#f0f0f0",
              color: "#111",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            🚀 الانتقال إلى التسويق
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: 22,
        marginBottom: 18,
        boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: 20,
          fontSize: 21,
        }}
      >
        {title}
      </h2>

      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          marginBottom: 7,
          fontWeight: "bold",
        }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: 13,
          borderRadius: 11,
          border: "1px solid #ddd",
          fontSize: 16,
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder = "",
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          marginBottom: 7,
          fontWeight: "bold",
        }}
      >
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          minHeight: 110,
          padding: 13,
          borderRadius: 11,
          border: "1px solid #ddd",
          fontSize: 16,
          boxSizing: "border-box",
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.7,
        }}
      />
    </div>
  );
}
