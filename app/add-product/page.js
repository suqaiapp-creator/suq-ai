"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
export default function AddProductPage() {
  const [image, setImage] = useState(null);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    barcode: "",
  });
  const [loading, setLoading] = useState(false);
  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("اكتب اسم المنتج أولاً.");
      return;
    }
    setLoading(true);
    try {
      // 1. إنشاء المنتج الأساسي
      const { data: createdProduct, error: insertError } =
        await supabase
          .from("products")
          .insert({
            name: form.name.trim(),
            brand: form.brand.trim() || null,
            category: form.category.trim() || null,
            price: form.price ? Number(form.price) : null,
            barcode: form.barcode.trim() || null,
            ai_status: "pending",
            verification_status: "unverified",
          })
          .select()
          .single();
      if (insertError) {
        console.error("PRODUCT INSERT ERROR:", insertError);
        throw new Error("تعذر إنشاء المنتج.");
      }
      let imageUrl = null;
      // 2. رفع صورة المنتج
      if (image) {
        const extension =
          image.name.split(".").pop() || "jpg";
        const fileName =
          `${createdProduct.id}-${Date.now()}.${extension}`;
        const { error: uploadError } =
          await supabase.storage
            .from("product-images")
            .upload(fileName, image, {
              cacheControl: "3600",
              upsert: true,
              contentType: image.type,
            });
        if (uploadError) {
          console.error("IMAGE UPLOAD ERROR:", uploadError);
          await supabase
            .from("products")
            .update({
              ai_status: "failed",
            })
            .eq("id", createdProduct.id);
          throw new Error("تعذر رفع صورة المنتج.");
        }
        const { data: publicUrlData } =
          supabase.storage
            .from("product-images")
            .getPublicUrl(fileName);
        imageUrl = publicUrlData.publicUrl;
        const { error: imageUpdateError } =
          await supabase
            .from("products")
            .update({
              image_url: imageUrl,
            })
            .eq("id", createdProduct.id);
        if (imageUpdateError) {
          console.error(
            "IMAGE URL SAVE ERROR:",
            imageUpdateError
          );
        }
      }
      // 3. تشغيل ذكاء المنتج
      const response = await fetch(
        "/api/analyze-product",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product: {
              ...createdProduct,
              image_url: imageUrl,
            },
          }),
        }
      );
      const analyzed = await response.json();
      console.log("ANALYZE RESPONSE:", analyzed);
      // 4. إذا فشل الذكاء
      if (!response.ok) {
        console.error(
          "ANALYZE PRODUCT ERROR:",
          analyzed
        );
        await supabase
          .from("products")
          .update({
            ai_status: "failed",
          })
          .eq("id", createdProduct.id);
        throw new Error(
          analyzed.error ||
            "تعذر تحليل المنتج."
        );
      }
      // 5. حفظ نتيجة ذكاء المنتج
      const { error: updateError } =
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
            product_type:
              analyzed.product_type ||
              createdProduct.product_type ||
              "local",
            description:
              analyzed.full_description ||
              analyzed.short_description ||
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
            ai_status: "completed",
            verification_status:
              "unverified",
          })
          .eq("id", createdProduct.id);
      if (updateError) {
        console.error(
          "SAVE ANALYSIS ERROR:",
          updateError
        );
        throw new Error(
          "تم تحليل المنتج لكن تعذر حفظ النتيجة."
        );
      }
      // 6. تصفير النموذج
      setForm({
        name: "",
        brand: "",
        category: "",
        price: "",
        barcode: "",
      });
      setImage(null);
      // 7. الانتقال مباشرة إلى ذكاء المنتج
      window.location.href =
        `/product-intelligence/${createdProduct.id}`;
    } catch (error) {
      console.error(
        "ADD PRODUCT ERROR:",
        error
      );
      alert(
        error.message ||
          "حدث خطأ أثناء إضافة المنتج."
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f7f7",
        padding: "25px 16px 50px",
        direction: "rtl",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: "auto",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 25,
            borderRadius: 22,
            boxShadow:
              "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h1
            style={{
              marginTop: 0,
              fontSize: 28,
            }}
          >
            🧠 ذكاء المنتج
          </h1>
          <p
            style={{
              color: "#666",
              lineHeight: 1.8,
            }}
          >
            أضف صورة المنتج والبيانات الأساسية فقط.
            سوق AI سيحاول تحليل المنتج وتجهيز معلوماته.
          </p>
          <form onSubmit={handleSubmit}>
            {/* الصورة */}
            <div
              style={{
                marginTop: 25,
                marginBottom: 20,
              }}
            >
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                📸 صورة المنتج
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setImage(
                    e.target.files?.[0] || null
                  )
                }
                style={{
                  width: "100%",
                }}
              />
            </div>
            {/* الاسم */}
            <Field
              label="اسم المنتج *"
              value={form.name}
              onChange={(value) =>
                updateField("name", value)
              }
              placeholder="مثال: Rosa Misl"
            />
            {/* العلامة */}
            <Field
              label="العلامة التجارية"
              value={form.brand}
              onChange={(value) =>
                updateField("brand", value)
              }
              placeholder="مثال: Ajmal"
            />
            {/* التصنيف */}
            <Field
              label="التصنيف"
              value={form.category}
              onChange={(value) =>
                updateField("category", value)
              }
              placeholder="مثال: عطور"
            />
            {/* السعر */}
            <Field
              label="السعر"
              type="number"
              value={form.price}
              onChange={(value) =>
                updateField("price", value)
              }
              placeholder="170"
            />
            {/* الباركود */}
            <Field
              label="الباركود"
              value={form.barcode}
              onChange={(value) =>
                updateField("barcode", value)
              }
              placeholder="اختياري"
            />
            <div
              style={{
                background: "#eef6ff",
                padding: 15,
                borderRadius: 14,
                marginTop: 20,
                marginBottom: 20,
                lineHeight: 1.8,
              }}
            >
              💡 <strong>ملاحظة:</strong>
              <br />
              لا تحتاج إلى كتابة الوصف أو المواصفات
              أو المميزات بنفسك.
              <br />
              🧠 ذكاء المنتج سيحاول جمع المعلومات
              وتجهيزها للمراجعة.
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: 17,
                border: "none",
                borderRadius: 14,
                background: loading
                  ? "#999"
                  : "#111",
                color: "#fff",
                fontSize: 17,
                fontWeight: "bold",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {loading
                ? "🧠 جاري تحليل المنتج..."
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
  placeholder = "",
  type = "text",
}) {
  return (
    <div
      style={{
        marginBottom: 18,
      }}
    >
      <label
        style={{
          display: "block",
          fontWeight: "bold",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #ddd",
          fontSize: 16,
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}
