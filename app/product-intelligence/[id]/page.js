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
  const [reanalyzing, setReanalyzing] = useState(false);

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
      price: data.price ?? "",
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
      verification_notes:
        data.verification_notes || "",
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

    const { data, error } = await supabase
      .from("products")
      .update({
        name: form.name,
        brand: form.brand,
        category: form.category,
        price: form.price
          ? Number(form.price)
          : null,
        description: form.description,
        specifications: form.specifications,
        features: form.features,
        uses: form.uses,
        target_audience: form.target_audience,
        manufacturer: form.manufacturer,
        country_of_origin: form.country_of_origin,
        size_or_volume: form.size_or_volume,
        ingredients: form.ingredients,
        warnings: form.warnings,
        storage: form.storage,
        warranty: form.warranty,
        verification_notes:
          form.verification_notes,
        confidence: form.confidence,

        verification_status: "verified",
        ai_status: "completed",

        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ المعلومات.");
      setSaving(false);
      return;
    }

    setProduct(data);

    alert("✅ تم اعتماد معلومات المنتج بنجاح");

    setSaving(false);
  }

  async function reanalyzeProduct() {
    if (reanalyzing) return;

    const confirmed = window.confirm(
      "🔄 سيتم إعادة تحليل المنتج باستخدام الذكاء الاصطناعي.\n\nقد يؤدي ذلك إلى استهلاك جزء من رصيد OpenAI.\n\nهل تريد المتابعة؟"
    );

    if (!confirmed) return;

    setReanalyzing(true);

    try {
      // نستخدم آخر بيانات موجودة في الصفحة
      // حتى يستطيع الذكاء الاصطناعي البحث بشكل أدق
      const productForAnalysis = {
        ...product,

        name: form.name,
        brand: form.brand,
        category: form.category,
        price: form.price,
        image_url: product.image_url,
        barcode: product.barcode,
      };

      const response = await fetch(
        "/api/analyze-product",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product: productForAnalysis,
          }),
        }
      );

      const analyzed = await response.json();

      if (!response.ok) {
        console.error(analyzed);

        throw new Error(
          analyzed.error ||
            "تعذر إعادة تحليل المنتج."
        );
      }

      // تحديث كل معلومات الذكاء في قاعدة البيانات
      const { data, error } = await supabase
        .from("products")
        .update({
          name:
            analyzed.product_name ||
            form.name,

          brand:
            analyzed.brand ||
            form.brand,

          category:
            analyzed.category ||
            form.category,

          description:
            analyzed.full_description ||
            analyzed.short_description ||
            form.description ||
            null,

          specifications:
            analyzed.specifications ||
            null,

          features:
            analyzed.features ||
            null,

          uses:
            analyzed.uses ||
            null,

          target_audience:
            analyzed.target_audience ||
            null,

          manufacturer:
            analyzed.manufacturer ||
            null,

          country_of_origin:
            analyzed.country_of_origin ||
            null,

          size_or_volume:
            analyzed.size_or_volume ||
            null,

          ingredients:
            analyzed.ingredients ||
            null,

          warnings:
            analyzed.warnings ||
            null,

          storage:
            analyzed.storage ||
            null,

          warranty:
            analyzed.warranty ||
            null,

          verification_notes:
            analyzed.verification_notes ||
            null,

          confidence:
            analyzed.confidence ||
            null,

          // مهم:
          // التحليل الجديد يحتاج مراجعة بشرية
          verification_status:
            "unverified",

          ai_status:
            "completed",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error(error);
        throw new Error(
          "تم التحليل لكن تعذر حفظ النتيجة."
        );
      }

      setProduct(data);

      setForm({
        name: data.name || "",
        brand: data.brand || "",
        category: data.category || "",
        price: data.price ?? "",
        description: data.description || "",
        specifications:
          data.specifications || "",
        features: data.features || "",
        uses: data.uses || "",
        target_audience:
          data.target_audience || "",
        manufacturer:
          data.manufacturer || "",
        country_of_origin:
          data.country_of_origin || "",
        size_or_volume:
          data.size_or_volume || "",
        ingredients:
          data.ingredients || "",
        warnings:
          data.warnings || "",
        storage:
          data.storage || "",
        warranty:
          data.warranty || "",
        verification_notes:
          data.verification_notes || "",
        confidence:
          data.confidence || "",
      });

      alert(
        "✅ تمت إعادة تحليل المنتج وحفظ النتائج.\n\n⚠️ راجع المعلومات قبل اعتمادها."
      );
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "حدث خطأ أثناء إعادة تحليل المنتج."
      );
    } finally {
      setReanalyzing(false);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={centerStyle}>
            جاري تحميل معلومات المنتج...
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={centerStyle}>
            <h2>المنتج غير موجود</h2>

            <Link href="/products">
              العودة إلى المنتجات
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>

        {/* HEADER */}

        <div style={cardStyle}>
          <div style={headerStyle}>
            <div>
              <h1 style={titleStyle}>
                🧠 ذكاء المنتج
              </h1>

              <p style={subtitleStyle}>
                تحليل ومراجعة معلومات المنتج قبل
                استخدامها في التسويق.
              </p>
            </div>

            <div
              style={{
                ...statusStyle,
                background:
                  product.verification_status ===
                  "verified"
                    ? "#e8f7ed"
                    : "#fff4d6",
                color:
                  product.verification_status ===
                  "verified"
                    ? "#16803c"
                    : "#9a6700",
              }}
            >
              {product.verification_status ===
              "verified"
                ? "✅ المعلومات معتمدة"
                : "⚠️ يحتاج مراجعة"}
            </div>
          </div>
        </div>

        {/* PRODUCT IMAGE */}

        {product.image_url && (
          <div style={cardStyle}>
            <div
              style={{
                textAlign: "center",
              }}
            >
              <img
                src={product.image_url}
                alt={product.name}
                style={{
                  width: 280,
                  maxWidth: "100%",
                  maxHeight: 350,
                  objectFit: "contain",
                  borderRadius: 15,
                }}
              />
            </div>
          </div>
        )}

        {/* REANALYZE */}

        <div
          style={{
            ...cardStyle,
            background: "#f8fbff",
            border:
              "1px solid #dcecff",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              fontSize: 20,
            }}
          >
            🔎 تحليل المنتج
          </h2>

          <p
            style={{
              color: "#666",
              lineHeight: 1.8,
              marginBottom: 15,
            }}
          >
            إذا كانت المعلومات الحالية ناقصة،
            يمكنك إعادة تحليل المنتج ليحاول الذكاء
            الاصطناعي البحث عن معلومات أكثر دقة.
          </p>

          <button
            onClick={reanalyzeProduct}
            disabled={reanalyzing}
            style={{
              width: "100%",
              padding: 16,
              border: "none",
              borderRadius: 14,
              background: reanalyzing
                ? "#999"
                : "#1769aa",
              color: "#fff",
              fontSize: 17,
              fontWeight: "bold",
              cursor: reanalyzing
                ? "not-allowed"
                : "pointer",
            }}
          >
            {reanalyzing
              ? "🔎 جاري البحث والتحليل..."
              : "🔄 إعادة تحليل المنتج"}
          </button>

          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#777",
              textAlign: "center",
            }}
          >
            ⚠️ إعادة التحليل تستخدم الذكاء الاصطناعي
            وقد تستهلك رصيدًا.
          </div>
        </div>

        {/* BASIC */}

        <Section title="📦 المعلومات الأساسية">

          <Field
            label="اسم المنتج"
            value={form.name}
            onChange={(v) =>
              updateField("name", v)
            }
          />

          <Field
            label="العلامة التجارية"
            value={form.brand}
            onChange={(v) =>
              updateField("brand", v)
            }
          />

          <Field
            label="التصنيف"
            value={form.category}
            onChange={(v) =>
              updateField("category", v)
            }
          />

          <Field
            label="السعر"
            type="number"
            value={form.price}
            onChange={(v) =>
              updateField("price", v)
            }
          />

        </Section>

        {/* DESCRIPTION */}

        <Section title="📝 وصف المنتج">

          <TextArea
            label="الوصف"
            value={form.description}
            onChange={(v) =>
              updateField("description", v)
            }
          />

          <TextArea
            label="المواصفات"
            value={form.specifications}
            onChange={(v) =>
              updateField(
                "specifications",
                v
              )
            }
          />

          <TextArea
            label="المميزات"
            value={form.features}
            onChange={(v) =>
              updateField("features", v)
            }
          />

        </Section>

        {/* INTELLIGENCE */}

        <Section title="🔎 معلومات إضافية">

          <TextArea
            label="الاستخدامات"
            value={form.uses}
            onChange={(v) =>
              updateField("uses", v)
            }
            placeholder="غير متوفر إذا لم يتم العثور على معلومات موثوقة"
          />

          <TextArea
            label="الجمهور المستهدف"
            value={form.target_audience}
            onChange={(v) =>
              updateField(
                "target_audience",
                v
              )
            }
          />

          <Field
            label="الشركة المصنعة"
            value={form.manufacturer}
            onChange={(v) =>
              updateField(
                "manufacturer",
                v
              )
            }
          />

          <Field
            label="بلد المنشأ"
            value={form.country_of_origin}
            onChange={(v) =>
              updateField(
                "country_of_origin",
                v
              )
            }
          />

          <Field
            label="الحجم / السعة"
            value={form.size_or_volume}
            onChange={(v) =>
              updateField(
                "size_or_volume",
                v
              )
            }
          />

          <TextArea
            label="المكونات"
            value={form.ingredients}
            onChange={(v) =>
              updateField(
                "ingredients",
                v
              )
            }
          />

          <TextArea
            label="التحذيرات"
            value={form.warnings}
            onChange={(v) =>
              updateField(
                "warnings",
                v
              )
            }
          />

          <TextArea
            label="طريقة التخزين"
            value={form.storage}
            onChange={(v) =>
              updateField(
                "storage",
                v
              )
            }
          />

          <TextArea
            label="الضمان"
            value={form.warranty}
            onChange={(v) =>
              updateField(
                "warranty",
                v
              )
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
            }}
          >
            <strong>
              ملاحظات التحقق
            </strong>

            <textarea
              value={form.verification_notes}
              onChange={(e) =>
                updateField(
                  "verification_notes",
                  e.target.value
                )
              }
              placeholder="ملاحظات حول المعلومات والمصادر..."
              style={{
                width: "100%",
                minHeight: 110,
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ddd",
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
                lineHeight: 1.7,
              }}
            />
          </div>

          <div
            style={{
              background: "#eef6ff",
              padding: 16,
              borderRadius: 14,
            }}
          >
            <strong>
              📊 درجة الثقة
            </strong>

            <div
              style={{
                marginTop: 8,
                fontWeight: "bold",
                fontSize: 18,
              }}
            >
              {form.confidence ||
                "غير محددة"}
            </div>
          </div>

        </Section>

        {/* ACTIONS */}

        <div style={cardStyle}>

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

const pageStyle = {
  minHeight: "100vh",
  background: "#f7f7f7",
  padding: "25px 16px 50px",
  direction: "rtl",
  fontFamily: "Arial, sans-serif",
};

const containerStyle = {
  maxWidth: 950,
  margin: "auto",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 22,
  padding: 22,
  marginBottom: 18,
  boxShadow:
    "0 4px 18px rgba(0,0,0,0.05)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: 28,
};

const subtitleStyle = {
  marginTop: 8,
  color: "#666",
  lineHeight: 1.7,
};

const statusStyle = {
  padding: "10px 15px",
  borderRadius: 12,
  fontWeight: "bold",
};

const centerStyle = {
  textAlign: "center",
  padding: 30,
};

function Section({ title, children }) {
  return (
    <section style={cardStyle}>
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
        onChange={(e) =>
          onChange(e.target.value)
        }
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
        onChange={(e) =>
          onChange(e.target.value)
        }
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
