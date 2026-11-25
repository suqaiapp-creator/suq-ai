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
    description: "",
    specifications: "",
    features: "",
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

  async function saveProduct(event) {
    event.preventDefault();

    if (!product.name.trim()) {
      setMessage("❌ اسم المنتج مطلوب.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      // 1. إنشاء المنتج أولاً للحصول على ID
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
            description:
              product.description.trim() || null,
            specifications:
              product.specifications.trim() || null,
            features:
              product.features.trim() || null,
            barcode:
              product.barcode.trim() || null,
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

      // 2. رفع الصورة إذا تم اختيارها
      let imageUrl = null;

      if (imageFile) {
        imageUrl = await uploadImage(createdProduct.id);

        // 3. حفظ رابط الصورة داخل المنتج
        const { error: imageUpdateError } = await supabase
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

      setMessage("✅ تم حفظ المنتج والصورة بنجاح.");

      // تنظيف النموذج
      setProduct({
        name: "",
        brand: "",
        category: "",
        price: "",
        description: "",
        specifications: "",
        features: "",
        barcode: "",
      });

      setImageFile(null);
      setImagePreview("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("SAVE ERROR:", error);
      setMessage(`❌ ${error.message}`);
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
          <h1
            style={{
              marginTop: 0,
              marginBottom: "8px",
              fontSize: "30px",
            }}
          >
            ➕ إضافة منتج
          </h1>

          <p
            style={{
              color: "#666",
              marginBottom: "25px",
            }}
          >
            أضف بيانات المنتج وصورته ليصبح جاهزًا للتسويق بالذكاء
            الاصطناعي.
          </p>

          <form onSubmit={saveProduct}>
            {/* صورة المنتج */}
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

            <TextArea
              label="وصف المنتج"
              value={product.description}
              onChange={(value) =>
                updateField(
                  "description",
                  value
                )
              }
              placeholder="اكتب وصف المنتج..."
            />

            <TextArea
              label="المواصفات"
              value={product.specifications}
              onChange={(value) =>
                updateField(
                  "specifications",
                  value
                )
              }
              placeholder="مثال: الحجم، المادة، السعة، المقاس..."
            />

            <TextArea
              label="المميزات"
              value={product.features}
              onChange={(value) =>
                updateField(
                  "features",
                  value
                )
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
                ? "⏳ جاري حفظ المنتج..."
                : "💾 حفظ المنتج"}
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

function TextArea({
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

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
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
