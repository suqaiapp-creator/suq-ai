"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const productId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [product, setProduct] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    barcode: "",
    description: "",
    specifications: "",
    features: "",
    image_url: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) {
      console.error(error);
      setMessage("❌ تعذر تحميل المنتج");
      setLoading(false);
      return;
    }

    setProduct({
      name: data.name || "",
      brand: data.brand || "",
      category: data.category || "",
      price: data.price || "",
      barcode: data.barcode || "",
      description: data.description || "",
      specifications: data.specifications || "",
      features: data.features || "",
      image_url: data.image_url || "",
    });

    setImagePreview(data.image_url || "");

    setLoading(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setProduct((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("❌ الملف المختار ليس صورة");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("❌ حجم الصورة يجب أن يكون أقل من 10MB");
      return;
    }

    setImageFile(file);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    setMessage("");
  }

  async function uploadImage(file) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${productId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new Error("تعذر رفع الصورة");
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!product.name.trim()) {
      setMessage("❌ اسم المنتج مطلوب");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let imageUrl = product.image_url;

      // إذا اختار المستخدم صورة جديدة
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      // تحديث بيانات المنتج
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: product.price
            ? Number(product.price)
            : null,
          barcode: product.barcode,
          description: product.description,
          specifications: product.specifications,
          features: product.features,
          image_url: imageUrl,
          ai_status: "pending",
          verification_status: "unverified",
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (updateError) {
        console.error(updateError);
        throw new Error("تعذر تحديث المنتج");
      }

      // حذف التسويق القديم لأنه أصبح مبنيًا على البيانات القديمة
      const { error: marketingDeleteError } = await supabase
        .from("marketing_contents")
        .delete()
        .eq("product_id", productId);

      if (marketingDeleteError) {
        console.error(marketingDeleteError);
      }

      setProduct((prev) => ({
        ...prev,
        image_url: imageUrl,
      }));

      setImageFile(null);

      setMessage(
        "✅ تم حفظ التعديلات والصورة بنجاح. يمكنك الآن إنشاء تسويق جديد."
      );

      setTimeout(() => {
        router.push("/products");
      }, 1500);
    } catch (error) {
      console.error(error);
      setMessage(
        `❌ ${error.message || "حدث خطأ أثناء حفظ المنتج"}`
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
          maxWidth: 800,
          margin: "40px auto",
          padding: 20,
          fontFamily: "Arial",
        }}
      >
        <h2>جاري تحميل المنتج...</h2>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 800,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      <h1>✏️ تعديل المنتج</h1>

      <p style={{ color: "#666" }}>
        عدّل بيانات المنتج أو غيّر صورته.
      </p>

      <form onSubmit={handleSave}>

        {/* الصورة */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <h3>📷 صورة المنتج</h3>

          {imagePreview ? (
            <img
              src={imagePreview}
              alt={product.name}
              style={{
                width: "100%",
                maxWidth: 350,
                maxHeight: 350,
                objectFit: "contain",
                borderRadius: 12,
                marginBottom: 15,
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 70,
                padding: 30,
              }}
            >
              📦
            </div>
          )}

          <br />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: "none" }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            📷 تغيير الصورة
          </button>

          {imageFile && (
            <p style={{ color: "green", marginTop: 10 }}>
              ✅ الصورة الجديدة جاهزة للرفع
            </p>
          )}
        </div>

        {/* اسم المنتج */}
        <label>اسم المنتج</label>
        <input
          name="name"
          value={product.name}
          onChange={handleChange}
          placeholder="مثال: عطر اماراتي خالص"
          style={inputStyle}
        />

        {/* العلامة التجارية */}
        <label>العلامة التجارية</label>
        <input
          name="brand"
          value={product.brand}
          onChange={handleChange}
          placeholder="مثال: عطر سلطان خاص"
          style={inputStyle}
        />

        {/* التصنيف */}
        <label>التصنيف</label>
        <input
          name="category"
          value={product.category}
          onChange={handleChange}
          placeholder="مثال: عطر رجالي"
          style={inputStyle}
        />

        {/* السعر */}
        <label>السعر</label>
        <input
          name="price"
          type="number"
          value={product.price}
          onChange={handleChange}
          placeholder="150"
          style={inputStyle}
        />

        {/* الباركود */}
        <label>الباركود</label>
        <input
          name="barcode"
          value={product.barcode}
          onChange={handleChange}
          placeholder="اختياري"
          style={inputStyle}
        />

        {/* الوصف */}
        <label>الوصف</label>
        <textarea
          name="description"
          value={product.description}
          onChange={handleChange}
          placeholder="اكتب وصف المنتج..."
          rows={5}
          style={textareaStyle}
        />

        {/* المواصفات */}
        <label>المواصفات</label>
        <textarea
          name="specifications"
          value={product.specifications}
          onChange={handleChange}
          placeholder="مثال: الحجم، المكونات، الخامة..."
          rows={5}
          style={textareaStyle}
        />

        {/* المميزات */}
        <label>المميزات</label>
        <textarea
          name="features"
          value={product.features}
          onChange={handleChange}
          placeholder="اكتب مميزات المنتج..."
          rows={5}
          style={textareaStyle}
        />

        {/* الرسالة */}
        {message && (
          <div
            style={{
              padding: 15,
              marginTop: 20,
              marginBottom: 20,
              borderRadius: 8,
              background: "#f5f5f5",
              fontWeight: "bold",
            }}
          >
            {message}
          </div>
        )}

        {/* الأزرار */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: 8,
              border: "none",
              background: saving ? "#999" : "#16a34a",
              color: "#fff",
              fontSize: 17,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/products")}
            style={{
              padding: "15px 20px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            رجوع
          </button>
        </div>
      </form>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  marginBottom: 18,
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 16,
  boxSizing: "border-box",
};

const textareaStyle = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  marginBottom: 18,
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 16,
  boxSizing: "border-box",
  resize: "vertical",
};
