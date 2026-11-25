"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [description, setDescription] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [features, setFeatures] = useState("");
  const [barcode, setBarcode] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

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

      if (error) throw error;

      setProduct(data);

      setName(data.name || "");
      setBrand(data.brand || "");
      setCategory(data.category || "");
      setPrice(data.price ?? "");
      setCurrency(data.currency || "AED");
      setDescription(data.description || "");
      setSpecifications(data.specifications || "");
      setFeatures(data.features || "");
      setBarcode(data.barcode || "");
      setImagePreview(data.image_url || "");
    } catch (error) {
      console.error(error);
      alert("تعذر تحميل المنتج");
    } finally {
      setLoading(false);
    }
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("اختر صورة صحيحة");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("حجم الصورة يجب ألا يتجاوز 10MB");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function saveProduct() {
    if (!name.trim()) {
      alert("اكتب اسم المنتج");
      return;
    }

    setSaving(true);

    try {
      let imageUrl = product.image_url || null;

      // رفع الصورة الجديدة إذا تم اختيارها
      if (imageFile) {
        const extension =
          imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

        const filePath = `${params.id}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageFile, {
            upsert: true,
            contentType: imageFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = publicData.publicUrl;
      }

      // تحديث بيانات المنتج
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          brand: brand.trim() || null,
          category: category.trim() || null,
          price: price === "" ? null : Number(price),
          currency: currency || "AED",
          description: description.trim() || null,
          specifications: specifications.trim() || null,
          features: features.trim() || null,
          barcode: barcode.trim() || null,
          image_url: imageUrl,
          ai_status: "pending",
          verification_status: "unverified",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);

      if (updateError) throw updateError;

      // مهم جدًا:
      // حذف أي محتوى تسويقي قديم حتى لا يظهر محتوى
      // مرتبط بالبيانات السابقة للمنتج.
      const { error: marketingDeleteError } = await supabase
        .from("marketing_contents")
        .delete()
        .eq("product_id", params.id);

      if (marketingDeleteError) {
        throw marketingDeleteError;
      }

      alert("تم تحديث المنتج وحذف المحتوى التسويقي القديم بنجاح");

      router.push("/products");
      router.refresh();
    } catch (error) {
      console.error("SAVE PRODUCT ERROR:", error);
      alert("حدث خطأ أثناء حفظ المنتج");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 20,
          fontFamily: "Arial",
        }}
      >
        <h2>جاري تحميل المنتج...</h2>
      </main>
    );
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 20,
          fontFamily: "Arial",
        }}
      >
        <h2>المنتج غير موجود</h2>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 900,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 25,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>✏️ تعديل المنتج</h1>
          <p style={{ color: "#666", margin: 0 }}>
            عدّل بيانات المنتج، وسيتم حذف التسويق القديم تلقائيًا.
          </p>
        </div>

        <button
          onClick={() => router.push("/products")}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ← رجوع
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 5px 20px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <label>صورة المنتج</label>

          {imagePreview && (
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <img
                src={imagePreview}
                alt={name}
                style={{
                  width: 180,
                  height: 180,
                  objectFit: "contain",
                  borderRadius: 14,
                  border: "1px solid #eee",
                  background: "#fafafa",
                }}
              />
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>

        <div style={{ display: "grid", gap: 15 }}>
          <Field
            label="اسم المنتج"
            value={name}
            onChange={setName}
            placeholder="مثال: عطر إماراتي خالص"
          />

          <Field
            label="العلامة التجارية"
            value={brand}
            onChange={setBrand}
            placeholder="مثال: عطر سلطان"
          />

          <Field
            label="التصنيف"
            value={category}
            onChange={setCategory}
            placeholder="مثال: عطور"
          />

          <Field
            label="السعر"
            value={price}
            onChange={setPrice}
            type="number"
            placeholder="150"
          />

          <Field
            label="العملة"
            value={currency}
            onChange={setCurrency}
            placeholder="AED"
          />

          <Field
            label="الباركود"
            value={barcode}
            onChange={setBarcode}
            placeholder="اختياري"
          />

          <TextArea
            label="وصف المنتج"
            value={description}
            onChange={setDescription}
            placeholder="اكتب وصف المنتج..."
          />

          <TextArea
            label="المواصفات"
            value={specifications}
            onChange={setSpecifications}
            placeholder="اكتب المواصفات المؤكدة فقط..."
          />

          <TextArea
            label="المميزات"
            value={features}
            onChange={setFeatures}
            placeholder="اكتب مميزات المنتج المؤكدة فقط..."
          />
        </div>

        <div
          style={{
            marginTop: 25,
            padding: 15,
            borderRadius: 12,
            background: "#fff8e1",
            border: "1px solid #ffe082",
          }}
        >
          ⚠️ عند حفظ التعديلات سيتم حذف المحتوى التسويقي السابق، لأن بيانات
          المنتج تغيرت.
        </div>

        <button
          onClick={saveProduct}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 20,
            padding: 15,
            border: "none",
            borderRadius: 12,
            background: saving ? "#999" : "#111",
            color: "#fff",
            fontSize: 17,
            fontWeight: "bold",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <div>
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
        placeholder={placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 13,
          borderRadius: 10,
          border: "1px solid #ddd",
          fontSize: 16,
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
    <div>
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
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 13,
          borderRadius: 10,
          border: "1px solid #ddd",
          fontSize: 16,
          resize: "vertical",
        }}
      />
    </div>
  );
}
