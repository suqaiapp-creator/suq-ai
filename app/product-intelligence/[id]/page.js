"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

const supabase = createClient();

export default function ProductIntelligencePage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [product, setProduct] = useState(null);

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

  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUser(user);

      const { data: shopData, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        router.replace("/setup-shop");
        return;
      }

      setShop(shopData);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!productData) {
        router.replace("/products");
        return;
      }

      setProduct(productData);

      setForm({
        name: productData.name || "",
        brand: productData.brand || "",
        category: productData.category || "",
        price:
          productData.price !== null &&
          productData.price !== undefined
            ? productData.price
            : "",
        description: productData.description || "",
        specifications: productData.specifications || "",
        features: productData.features || "",
        uses: productData.uses || "",
        target_audience:
          productData.target_audience || "",
        manufacturer:
          productData.manufacturer || "",
        country_of_origin:
          productData.country_of_origin || "",
        size_or_volume:
          productData.size_or_volume || "",
        ingredients:
          productData.ingredients || "",
        warnings: productData.warnings || "",
        storage: productData.storage || "",
        warranty: productData.warranty || "",
        verification_notes:
          productData.verification_notes || "",
        confidence:
          productData.confidence || "",
      });
    } catch (error) {
      console.error(error);
      setMessage(
        error?.message ||
          "حدث خطأ أثناء تحميل معلومات المنتج."
      );
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

  async function saveProduct() {
    if (!product || !shop || saving) return;

    if (!form.name.trim()) {
      setMessage("اسم المنتج مطلوب.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const updateData = {
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

        uses:
          form.uses.trim() || null,

        target_audience:
          form.target_audience.trim() || null,

        manufacturer:
          form.manufacturer.trim() || null,

        country_of_origin:
          form.country_of_origin.trim() || null,

        size_or_volume:
          form.size_or_volume.trim() || null,

        ingredients:
          form.ingredients.trim() || null,

        warnings:
          form.warnings.trim() || null,

        storage:
          form.storage.trim() || null,

        warranty:
          form.warranty.trim() || null,

        verification_notes:
          form.verification_notes.trim() || null,

        confidence:
          form.confidence.trim() || null,

        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", product.id)
        .eq("shop_id", shop.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setProduct(data);

      setMessage(
        "تم حفظ معلومات المنتج بنجاح."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error?.message ||
          "حدث خطأ أثناء حفظ معلومات المنتج."
      );
    } finally {
      setSaving(false);
    }
  }

  async function reanalyzeProduct() {
    if (!product || !shop || reanalyzing) return;

    const isLocked =
      product.verification_status === "locked" ||
      product.safety_status === "locked";

    if (isLocked) {
      setMessage(
        "🔒 المنتج مقفول ولا يمكن إعادة تحليله حاليًا."
      );
      return;
    }

    const confirmed = window.confirm(
      "إعادة التحليل ستستخدم رصيد OpenAI. هل تريد المتابعة؟"
    );

    if (!confirmed) {
      return;
    }

    setReanalyzing(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/analyze-product",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_name: product.name,
            brand: product.brand,
            category: product.category,
            barcode: product.barcode,
            image_url: product.image_url,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "فشل إعادة تحليل المنتج."
        );
      }

      const analyzed =
        result.product ||
        result.data ||
        result;

      const updateData = {
        name:
          analyzed.product_name ||
          product.name,

        brand:
          analyzed.brand ||
          product.brand ||
          null,

        category:
          analyzed.category ||
          product.category ||
          null,

        description:
          analyzed.full_description ||
          analyzed.short_description ||
          product.description ||
          null,

        specifications:
          analyzed.specifications ||
          product.specifications ||
          null,

        features:
          analyzed.features ||
          product.features ||
          null,

        uses:
          analyzed.uses ||
          product.uses ||
          null,

        target_audience:
          analyzed.target_audience ||
          product.target_audience ||
          null,

        manufacturer:
          analyzed.manufacturer ||
          product.manufacturer ||
          null,

        country_of_origin:
          analyzed.country_of_origin ||
          product.country_of_origin ||
          null,

        size_or_volume:
          analyzed.size_or_volume ||
          product.size_or_volume ||
          null,

        ingredients:
          analyzed.ingredients ||
          product.ingredients ||
          null,

        warnings:
          analyzed.warnings ||
          product.warnings ||
          null,

        storage:
          analyzed.storage ||
          product.storage ||
          null,

        warranty:
          analyzed.warranty ||
          product.warranty ||
          null,

        verification_notes:
          analyzed.verification_notes ||
          product.verification_notes ||
          null,

        confidence:
          analyzed.confidence ||
          product.confidence ||
          null,

        ai_status: "completed",

        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", product.id)
        .eq("shop_id", shop.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setProduct(data);

      setForm({
        name: data.name || "",
        brand: data.brand || "",
        category: data.category || "",
        price:
          data.price !== null &&
          data.price !== undefined
            ? data.price
            : "",
        description:
          data.description || "",
        specifications:
          data.specifications || "",
        features:
          data.features || "",
        uses:
          data.uses || "",
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

      setMessage(
        "تم إعادة تحليل المنتج وحفظ المعلومات الجديدة."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error?.message ||
          "حدث خطأ أثناء إعادة تحليل المنتج."
      );
    } finally {
      setReanalyzing(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: 30,
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        جاري تحميل معلومات المنتج...
      </main>
    );
  }

  if (!product) {
    return null;
  }

  const isLocked =
    product.verification_status === "locked" ||
    product.safety_status === "locked";

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        padding: "24px 14px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 950,
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() =>
            router.push("/products")
          }
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 15,
            marginBottom: 15,
          }}
        >
          ← العودة للمنتجات
        </button>

        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            boxShadow:
              "0 5px 25px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            🧠 معلومات المنتج الذكية
          </h1>

          <p style={{ color: "#666" }}>
            المنتج:{" "}
            <strong>{product.name}</strong>
          </p>

          {isLocked && (
            <div
              style={{
                background: "#fff3cd",
                border:
                  "1px solid #ffe08a",
                borderRadius: 14,
                padding: 15,
                marginBottom: 20,
                lineHeight: 1.8,
              }}
            >
              🔒 <strong>المنتج مقفول</strong>
              <br />
              يمكن مراجعة المعلومات، لكن حالة
              القفل لن تتغير من هذه الصفحة.
            </div>
          )}

          {product.image_url && (
            <div
              style={{
                textAlign: "center",
                marginBottom: 25,
              }}
            >
              <img
                src={product.image_url}
                alt={product.name}
                style={{
                  width: "100%",
                  maxWidth: 300,
                  height: 300,
                  objectFit: "contain",
                  borderRadius: 18,
                  border: "1px solid #eee",
                  background: "#fafafa",
                }}
              />
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
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

            <Field
              label="السعر"
              type="number"
              value={form.price}
              onChange={(value) =>
                updateField("price", value)
              }
            />
          </div>

          <TextArea
            label="الوصف"
            value={form.description}
            onChange={(value) =>
              updateField("description", value)
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
              updateField("features", value)
            }
          />

          <TextArea
            label="الاستخدامات"
            value={form.uses}
            onChange={(value) =>
              updateField("uses", value)
            }
          />

          <TextArea
            label="الجمهور المستهدف"
            value={form.target_audience}
            onChange={(value) =>
              updateField(
                "target_audience",
                value
              )
            }
          />

          <TextArea
            label="الشركة المصنعة"
            value={form.manufacturer}
            onChange={(value) =>
              updateField(
                "manufacturer",
                value
              )
            }
          />

          <TextArea
            label="بلد المنشأ"
            value={form.country_of_origin}
            onChange={(value) =>
              updateField(
                "country_of_origin",
                value
              )
            }
          />

          <TextArea
            label="الحجم / السعة"
            value={form.size_or_volume}
            onChange={(value) =>
              updateField(
                "size_or_volume",
                value
              )
            }
          />

          <TextArea
            label="المكونات"
            value={form.ingredients}
            onChange={(value) =>
              updateField(
                "ingredients",
                value
              )
            }
          />

          <TextArea
            label="التحذيرات"
            value={form.warnings}
            onChange={(value) =>
              updateField(
                "warnings",
                value
              )
            }
          />

          <TextArea
            label="طريقة التخزين"
            value={form.storage}
            onChange={(value) =>
              updateField(
                "storage",
                value
              )
            }
          />

          <TextArea
            label="الضمان"
            value={form.warranty}
            onChange={(value) =>
              updateField(
                "warranty",
                value
              )
            }
          />

          <TextArea
            label="ملاحظات التحقق"
            value={form.verification_notes}
            onChange={(value) =>
              updateField(
                "verification_notes",
                value
              )
            }
          />

          <Field
            label="درجة الثقة"
            value={form.confidence}
            onChange={(value) =>
              updateField(
                "confidence",
                value
              )
            }
          />

          {message && (
            <div
              style={{
                marginTop: 20,
                padding: 14,
                borderRadius: 12,
                background: "#eef7ee",
                lineHeight: 1.7,
              }}
            >
              {message}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 25,
            }}
          >
            <button
              type="button"
              onClick={saveProduct}
              disabled={saving}
              style={{
                ...primaryButton,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving
                ? "جاري الحفظ..."
                : "💾 حفظ المعلومات"}
            </button>

            <button
              type="button"
              onClick={reanalyzeProduct}
              disabled={
                reanalyzing || isLocked
              }
              style={{
                ...secondaryButton,
                opacity:
                  reanalyzing || isLocked
                    ? 0.5
                    : 1,
              }}
            >
              {reanalyzing
                ? "جاري التحليل..."
                : "🔄 إعادة تحليل المنتج"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/edit-product/${product.id}`
                )
              }
              style={secondaryButton}
            >
              ✏️ تعديل المنتج
            </button>

            {!isLocked && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/marketing/${product.id}`
                  )
                }
                style={secondaryButton}
              >
                🚀 التسويق
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontWeight: "bold",
          marginBottom: 7,
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
          boxSizing: "border-box",
          padding: "12px 13px",
          border: "1px solid #ddd",
          borderRadius: 12,
          fontSize: 15,
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
    <div style={{ marginTop: 16 }}>
      <label
        style={{
          display: "block",
          fontWeight: "bold",
          marginBottom: 7,
        }}
      >
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 13px",
          border: "1px solid #ddd",
          borderRadius: 12,
          fontSize: 15,
          resize: "vertical",
        }}
      />
    </div>
  );
}

const primaryButton = {
  border: "none",
  background: "#111",
  color: "#fff",
  padding: "13px 17px",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #ddd",
  background: "#fff",
  color: "#111",
  padding: "13px 17px",
  borderRadius: 12,
  fontSize: 15,
  cursor: "pointer",
};
