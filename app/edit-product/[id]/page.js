"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function EditProductPage({ params }) {
  const [productId, setProductId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [product, setProduct] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    description: "",
    specifications: "",
    features: "",
    barcode: "",
  });

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    try {
      const { id } = await params;
      setProductId(id);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("LOAD PRODUCT ERROR:", error);
        setMessage("❌ لم يتم العثور على المنتج.");
        setLoading(false);
        return;
      }

      setProduct({
        name: data.name || "",
        brand: data.brand || "",
        category: data.category || "",
        price: data.price ?? "",
        description: data.description || "",
        specifications: data.specifications || "",
        features: data.features || "",
        barcode: data.barcode || "",
      });
    } catch (error) {
      console.error(error);
      setMessage("❌ حدث خطأ أثناء تحميل المنتج.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setProduct((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveProduct(event) {
    event.preventDefault();

    if (!product.name.trim()) {
      setMessage("❌ اسم المنتج مطلوب.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("products")
      .update({
        name: product.name.trim(),
        brand: product.brand.trim() || null,
        category: product.category.trim() || null,
        price: product.price === "" ? null : Number(product.price),
        description: product.description.trim() || null,
        specifications: product.specifications.trim() || null,
        features: product.features.trim() || null,
        barcode: product.barcode.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (error) {
      console.error("UPDATE PRODUCT ERROR:", error);
      setMessage("❌ حدث خطأ أثناء حفظ التعديلات.");
      setSaving(false);
      return;
    }

    setMessage("✅ تم حفظ تعديلات المنتج بنجاح.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f7fb",
          padding: "30px 18px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            background: "#fff",
            borderRadius: "20px",
            padding: "35px",
            textAlign: "center",
          }}
        >
          جاري تحميل المنتج...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f7fb",
        padding: "25px 18px 50px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
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
          ← العودة إلى المنتجات
        </a>

        <div
          style={{
            background: "#fff",
            borderRadius: "22px",
            padding: "25px",
            boxShadow: "0 5px 20px rgba(0,0,0,0.06)",
          }}
        >
          <h1
            style={{
              marginTop: 0,
              marginBottom: "8px",
              fontSize: "30px",
            }}
          >
            ✏️ تعديل المنتج
          </h1>

          <p
            style={{
              color: "#666",
              marginBottom: "25px",
            }}
          >
            عدّل بيانات المنتج ثم احفظ التغييرات.
          </p>

          <form onSubmit={saveProduct}>
            <Field
              label="اسم المنتج *"
              value={product.name}
              onChange={(value) => updateField("name", value)}
              placeholder="مثال: عطر إماراتي"
            />

            <Field
              label="العلامة التجارية"
              value={product.brand}
              onChange={(value) => updateField("brand", value)}
              placeholder="مثال: عطر سلطان"
            />

            <Field
              label="التصنيف"
              value={product.category}
              onChange={(value) => updateField("category", value)}
              placeholder="مثال: عطور رجالية"
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
                  value={product.price}
                  onChange={(e) =>
                    updateField("price", e.target.value)
                  }
                  placeholder="مثال: 167"
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

            <Field
              label="الباركود"
              value={product.barcode}
              onChange={(value) => updateField("barcode", value)}
              placeholder="أدخل الباركود إذا كان موجودًا"
            />

            <TextArea
              label="وصف المنتج"
              value={product.description}
              onChange={(value) =>
                updateField("description", value)
              }
              placeholder="اكتب وصف المنتج..."
            />

            <TextArea
              label="المواصفات"
              value={product.specifications}
              onChange={(value) =>
                updateField("specifications", value)
              }
              placeholder="مثال: الحجم، المادة، السعة، المقاس..."
            />

            <TextArea
              label="المميزات"
              value={product.features}
              onChange={(value) =>
                updateField("features", value)
              }
              placeholder="اكتب أهم مميزات المنتج..."
            />

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
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                border: "none",
                background: saving ? "#999" : "#6246e5",
                color: "#fff",
                padding: "16px",
                borderRadius: "14px",
                fontSize: "18px",
                fontWeight: "800",
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }) {
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function TextArea({ label, value, onChange, placeholder }) {
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
