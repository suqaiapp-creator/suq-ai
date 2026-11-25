"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function AddProductPage() {
  const fileInputRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [product, setProduct] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    barcode: "",
  });

  function updateField(field, value) {
    setProduct((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("❌ الملف المختار ليس صورة.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("❌ حجم الصورة أكبر من 10MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMessage("");
  }

  async function uploadImage(productId) {
    if (!imageFile) return null;

    const fileExtension =
      imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${productId}/${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, imageFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: imageFile.type,
      });

    if (uploadError) {
      console.error("IMAGE UPLOAD ERROR:", uploadError);
      throw new Error("تعذر رفع صورة المنتج.");
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function analyzeProduct(productData) {
    const response = await fetch("/api/analyze-product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product: productData,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "تعذر تحليل المنتج."
      );
    }

    return result;
  }

  async function saveProduct(event) {
    event.preventDefault();

    if (!product.name.trim()) {
      setMessage("❌ اسم المنتج مطلوب.");
      return;
    }

    setSaving(true);
    setMessage("⏳ جاري حفظ المنتج وتشغيل ذكاء المنتج...");

    try {
      // 1️⃣ حفظ المنتج الأساسي
      const { data: createdProduct, error: productError } =
        await supabase
          .from("products")
          .insert({
            name: product.name.trim(),
            brand: product.brand.trim() || null,
            category: product.category.trim() || null,
            price:
              product.price === ""
                ? null
                : Number(product.price),
            currency: "AED",
            barcode: product.barcode.trim() || null,

            description: null,
            specifications: null,
            features: null,

            product_type: "local",
            verification_status: "unverified",
            ai_status: "pending",
          })
          .select()
          .single();

      if (productError) {
        console.error("CREATE PRODUCT ERROR:", productError);
        throw new Error("تعذر حفظ المنتج.");
      }

      // 2️⃣ رفع الصورة
      let imageUrl = null;

      if (imageFile) {
        setMessage(
          "📸 تم حفظ المنتج. جاري رفع الصورة..."
        );

        imageUrl = await uploadImage(createdProduct.id);

        const { error: imageUpdateError } =
          await supabase
            .from("products")
            .update({
              image_url: imageUrl,
            })
            .eq("id", createdProduct.id);

        if (imageUpdateError) {
          console.error(
            "SAVE IMAGE URL ERROR:",
            imageUpdateError
          );

          throw new Error(
            "تم حفظ المنتج ولكن تعذر ربط الصورة به."
          );
        }
      }

      // 3️⃣ تشغيل ذكاء المنتج
      setMessage(
        "🧠 جاري تحليل المنتج وتجهيز معلوماته..."
      );

      const analyzed = await analyzeProduct({
        ...createdProduct,
        image_url: imageUrl,
      });

      // 4️⃣ تحديث المنتج بالمعلومات التي تم تحليلها
      const { error: analysisUpdateError } =
        await supabase
          .from("products")
          .update({
            name:
              analyzed.product_name ||
              createdProduct.name,

            brand:
              analyzed.brand ||
              createdProduct.brand,

            category:
              analyzed.category ||
              createdProduct.category,

            description:
              analyzed.full_description ||
              analyzed.short_description ||
              null,

            specifications:
              analyzed.specifications || null,

            features:
              analyzed.features || null,

            ai_status: "completed",

            verification_status: "unverified",
          })
          .eq("id", createdProduct.id);

      if (analysisUpdateError) {
        console.error(
          "ANALYSIS UPDATE ERROR:",
          analysisUpdateError
        );

        throw new Error(
          "تم تحليل المنتج ولكن تعذر حفظ معلومات الذكاء."
        );
      }

      // 5️⃣ نجاح العملية
      setMessage(
        "✅ تم حفظ المنتج وتحليل معلوماته بنجاح."
      );

      setProduct({
        name: "",
        brand: "",
        category: "",
        price: "",
        barcode: "",
      });

      setImageFile(null);
      setImagePreview("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("SAVE PRODUCT ERROR:", error);

      setMessage(
        `❌ ${error.message || "حدث خطأ غير متوقع."}`
      );
    } finally {
      setSaving(false);
    }
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
          ← إدارة المنتجات
        </a>

        <div
          style={{
            background: "#fff",
            borderRadius: "22px",
            padding: "25px",
            boxShadow: "0 5px 20px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              padding: "18px",
              background:
                "linear-gradient(135deg, #f3efff, #fafafa)",
              borderRadius: "18px",
              marginBottom: "25px",
              border: "1px solid #e6e0ff",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                marginBottom: "6px",
              }}
            >
              🧠
            </div>

            <h1
              style={{
                margin: 0,
                marginBottom: "8px",
                fontSize: "28px",
              }}
            >
              ذكاء المنتج
            </h1>

            <p
              style={{
                margin: 0,
                color: "#666",
                lineHeight: "1.7",
              }}
            >
              أدخل المعلومات الأساسية فقط، وسوق AI
              سيجهز لك ملف المنتج تلقائيًا.
            </p>
          </div>

          <form onSubmit={saveProduct}>
            <div
              style={{
                marginBottom: "25px",
                padding: "20px",
                background: "#fafafa",
                border: "1px solid #eee",
                borderRadius: "18px",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontWeight: "800",
                  fontSize: "18px",
                }}
              >
                📸 صورة المنتج
              </label>

              {imagePreview ? (
                <div
                  style={{
                    marginBottom: "15px",
                  }}
                >
                  <img
                    src={imagePreview}
                    alt="معاينة المنتج"
                    style={{
                      width: "100%",
                      maxHeight: "320px",
                      objectFit: "contain",
                      borderRadius: "16px",
                      background: "#fff",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    padding: "35px 20px",
                    textAlign: "center",
                    background: "#fff",
                    border: "2px dashed #ddd",
                    borderRadius: "16px",
                    marginBottom: "15px",
                    color: "#777",
                  }}
                >
                  <div
                    style={{
                      fontSize: "45px",
                      marginBottom: "8px",
                    }}
                  >
                    📦
                  </div>

                  <div>
                    اختر صورة واضحة للمنتج
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{
                  width: "100%",
                  fontSize: "16px",
                }}
              />

              <div
                style={{
                  marginTop: "8px",
                  color: "#777",
                  fontSize: "13px",
                }}
              >
                الحد الأقصى للصورة: 10MB
              </div>
            </div>

            <Field
              label="اسم المنتج *"
              value={product.name}
              onChange={(value) =>
                updateField("name", value)
              }
              placeholder="مثال: عطر إماراتي"
            />

            <Field
              label="العلامة التجارية"
              value={product.brand}
              onChange={(value) =>
                updateField("brand", value)
              }
              placeholder="مثال: عطر سلطان"
            />

            <Field
              label="التصنيف"
              value={product.category}
              onChange={(value) =>
                updateField("category", value)
              }
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
                    updateField(
                      "price",
                      e.target.value
                    )
                  }
                  placeholder="مثال: 150"
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
              onChange={(value) =>
                updateField("barcode", value)
              }
              placeholder="أدخل الباركود إذا كان موجودًا"
            />

            <div
              style={{
                marginTop: "8px",
                marginBottom: "20px",
                padding: "15px",
                background: "#fff8e7",
                border: "1px solid #f1dfaa",
                borderRadius: "14px",
                color: "#765d00",
                lineHeight: "1.7",
                fontSize: "14px",
              }}
            >
              💡 لا تحتاج تكتب الوصف والمواصفات
              والمميزات بنفسك. ذكاء المنتج سيجهزها
              لك بناءً على المعلومات المتوفرة، ثم
              نضيف مرحلة المراجعة والتحقق.
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
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                border: "none",
                background: saving
                  ? "#999"
                  : "#6246e5",
                color: "#fff",
                padding: "16px",
                borderRadius: "14px",
                fontSize: "18px",
                fontWeight: "800",
                cursor: saving
                  ? "default"
                  : "pointer",
              }}
            >
              {saving
                ? "🧠 جاري تجهيز المنتج..."
                : "🧠 حفظ وتحليل المنتج"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
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
