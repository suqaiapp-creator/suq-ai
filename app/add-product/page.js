"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function AddProductPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    barcode: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!form.name.trim()) {
      setError("اكتب اسم المنتج.");
      return;
    }

    if (!imageFile) {
      setError("أضف صورة المنتج.");
      return;
    }

    setLoading(true);

    try {
      // 1. التأكد من تسجيل الدخول
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // 2. الحصول على محل المستخدم
      const { data: shop, error: shopError } = await supabase
        .from("shops")
        .select("id, name, status")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopError) {
        console.error(shopError);
        setError("تعذر الوصول إلى بيانات المحل.");
        setLoading(false);
        return;
      }

      if (!shop) {
        setError("لم يتم العثور على المحل. أكمل بيانات المحل أولاً.");
        setLoading(false);
        return;
      }

      if (shop.status !== "active") {
        setError("حساب المحل غير نشط حالياً.");
        setLoading(false);
        return;
      }

      // 3. رفع صورة المنتج
      const fileExtension =
        imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const safeExtension =
        fileExtension.replace(/[^a-z0-9]/g, "") || "jpg";

      const fileName = `${crypto.randomUUID()}.${safeExtension}`;

      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: imageFile.type || "image/jpeg",
        });

      if (uploadError) {
        console.error(uploadError);
        setError("تعذر رفع صورة المنتج.");
        setLoading(false);
        return;
      }

      // 4. الحصول على رابط الصورة
      const { data: publicImage } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const imageUrl = publicImage?.publicUrl || "";

      if (!imageUrl) {
        setError("تعذر إنشاء رابط صورة المنتج.");
        setLoading(false);
        return;
      }

      // 5. إنشاء المنتج وربطه بالمحل
      const productData = {
        shop_id: shop.id,

        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,

        price: form.price
          ? Number(form.price)
          : null,

        currency: "AED",

        barcode: form.barcode.trim() || null,

        image_url: imageUrl,

        product_type: "local",

        verification_status: "unverified",
        ai_status: "pending",
      };

      const { data: createdProduct, error: productError } =
        await supabase
          .from("products")
          .insert(productData)
          .select("*")
          .single();

      if (productError) {
        console.error(productError);

        // نحاول حذف الصورة إذا فشل إنشاء المنتج
        await supabase.storage
          .from("product-images")
          .remove([filePath]);

        setError(
          productError.message ||
            "تعذر إنشاء المنتج."
        );

        setLoading(false);
        return;
      }

      // 6. إرسال المنتج للتحليل الذكي
      const analyzeResponse = await fetch(
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

      const analyzeResult =
        await analyzeResponse.json();

      if (!analyzeResponse.ok) {
        console.error(analyzeResult);

        setError(
          "تم حفظ المنتج، لكن تعذر إكمال التحليل الذكي."
        );

        setLoading(false);

        router.push(
          `/product-intelligence/${createdProduct.id}`
        );

        return;
      }

      // 7. حفظ نتيجة التحليل
      const analyzed = analyzeResult?.product || analyzeResult;

      const updateData = {
        name:
          analyzed?.product_name ||
          analyzed?.name ||
          createdProduct.name,

        brand:
          analyzed?.brand ||
          createdProduct.brand,

        category:
          analyzed?.category ||
          createdProduct.category,

        description:
          analyzed?.short_description ||
          analyzed?.description ||
          null,

        specifications:
          analyzed?.specifications ||
          null,

        features:
          analyzed?.features ||
          null,

        uses:
          analyzed?.uses ||
          null,

        target_audience:
          analyzed?.target_audience ||
          null,

        manufacturer:
          analyzed?.manufacturer ||
          null,

        country_of_origin:
          analyzed?.country_of_origin ||
          null,

        size_or_volume:
          analyzed?.size_or_volume ||
          null,

        ingredients:
          analyzed?.ingredients ||
          null,

        warnings:
          analyzed?.warnings ||
          null,

        storage:
          analyzed?.storage ||
          null,

        warranty:
          analyzed?.warranty ||
          null,

        verification_notes:
          analyzed?.verification_notes ||
          null,

        confidence:
          analyzed?.confidence ||
          null,

        ai_status: "completed",

        verification_status: "verified",

        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", createdProduct.id)
        .eq("shop_id", shop.id);

      if (updateError) {
        console.error(updateError);

        setError(
          "تم التحليل، لكن تعذر حفظ بعض بيانات التحليل."
        );

        setLoading(false);

        router.push(
          `/product-intelligence/${createdProduct.id}`
        );

        return;
      }

      // 8. الانتقال إلى صفحة ذكاء المنتج
      router.push(
        `/product-intelligence/${createdProduct.id}`
      );
    } catch (err) {
      console.error(err);

      setError(
        "حدث خطأ غير متوقع. حاول مرة أخرى."
      );

      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "28px",
            boxShadow:
              "0 10px 35px rgba(0,0,0,0.07)",
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: "none",
              background: "transparent",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: "14px",
              marginBottom: "18px",
            }}
          >
            ← رجوع
          </button>

          <div style={{ marginBottom: "26px" }}>
            <div
              style={{
                fontSize: "40px",
                marginBottom: "8px",
              }}
            >
              📦
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                color: "#111827",
              }}
            >
              إضافة منتج
            </h1>

            <p
              style={{
                color: "#6b7280",
                lineHeight: "1.8",
              }}
            >
              أضف المنتج وسيتعرف عليه سوق AI
              ويجمع معلوماته قبل إنشاء المحتوى
              التسويقي.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>
              اسم المنتج *
            </label>

            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                updateField(
                  "name",
                  e.target.value
                )
              }
              placeholder="مثال: HUAWEI FreeClip"
              style={inputStyle}
            />

            <label style={labelStyle}>
              العلامة التجارية
            </label>

            <input
              type="text"
              value={form.brand}
              onChange={(e) =>
                updateField(
                  "brand",
                  e.target.value
                )
              }
              placeholder="مثال: Huawei"
              style={inputStyle}
            />

            <label style={labelStyle}>
              التصنيف
            </label>

            <input
              type="text"
              value={form.category}
              onChange={(e) =>
                updateField(
                  "category",
                  e.target.value
                )
              }
              placeholder="مثال: إلكترونيات"
              style={inputStyle}
            />

            <label style={labelStyle}>
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
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  updateField(
                    "price",
                    e.target.value
                  )
                }
                placeholder="0.00"
                style={{
                  ...inputStyle,
                  flex: 1,
                }}
              />

              <div
                style={{
                  minWidth: "70px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #d1d5db",
                  borderRadius: "12px",
                  color: "#374151",
                  background: "#f9fafb",
                  fontWeight: "bold",
                }}
              >
                AED
              </div>
            </div>

            <label style={labelStyle}>
              الباركود
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={form.barcode}
              onChange={(e) =>
                updateField(
                  "barcode",
                  e.target.value
                )
              }
              placeholder="اختياري"
              style={inputStyle}
            />

            <label style={labelStyle}>
              صورة المنتج *
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px",
                border:
                  "1px solid #d1d5db",
                borderRadius: "12px",
                background: "#ffffff",
              }}
            />

            {imagePreview && (
              <div
                style={{
                  marginTop: "16px",
                  textAlign: "center",
                }}
              >
                <img
                  src={imagePreview}
                  alt="معاينة المنتج"
                  style={{
                    width: "100%",
                    maxWidth: "300px",
                    maxHeight: "300px",
                    objectFit: "contain",
                    borderRadius: "16px",
                    border:
                      "1px solid #e5e7eb",
                  }}
                />
              </div>
            )}

            <div
              style={{
                marginTop: "18px",
                padding: "14px",
                borderRadius: "14px",
                background: "#f9fafb",
                color: "#6b7280",
                fontSize: "14px",
                lineHeight: "1.8",
              }}
            >
              🔎 سيتم استخدام صورة المنتج
              والاسم والعلامة التجارية والباركود
              عند توفره للتعرف على المنتج وجمع
              معلومات موثوقة عنه.
            </div>

            {error && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "13px",
                  borderRadius: "12px",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  lineHeight: "1.7",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "22px",
                padding: "16px",
                border: "none",
                borderRadius: "14px",
                background: loading
                  ? "#9ca3af"
                  : "#111827",
                color: "#ffffff",
                fontSize: "17px",
                fontWeight: "bold",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {loading
                ? "جاري إضافة وتحليل المنتج..."
                : "إضافة وتحليل المنتج"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

const labelStyle = {
  display: "block",
  marginTop: "18px",
  marginBottom: "8px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "#374151",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "#ffffff",
  fontSize: "16px",
  outline: "none",
};
