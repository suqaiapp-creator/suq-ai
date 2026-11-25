"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();

  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [product, setProduct] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [description, setDescription] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [features, setFeatures] = useState("");
  const [uses, setUses] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [sizeOrVolume, setSizeOrVolume] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [warnings, setWarnings] = useState("");
  const [storage, setStorage] = useState("");
  const [warranty, setWarranty] = useState("");
  const [barcode, setBarcode] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    loadData();
  }, [params.id]);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);

      const { data: currentShop, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", currentUser.id)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!currentShop) {
        router.push("/setup-shop");
        return;
      }

      if (currentShop.status !== "active") {
        setMessage("حساب المحل غير نشط حاليًا.");
        return;
      }

      setShop(currentShop);

      const { data: currentProduct, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", params.id)
        .eq("shop_id", currentShop.id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!currentProduct) {
        router.push("/products");
        return;
      }

      setProduct(currentProduct);

      setName(currentProduct.name || "");
      setBrand(currentProduct.brand || "");
      setCategory(currentProduct.category || "");
      setPrice(
        currentProduct.price !== null &&
        currentProduct.price !== undefined
          ? String(currentProduct.price)
          : ""
      );
      setCurrency(currentProduct.currency || "AED");

      setDescription(currentProduct.description || "");
      setSpecifications(currentProduct.specifications || "");
      setFeatures(currentProduct.features || "");
      setUses(currentProduct.uses || "");
      setTargetAudience(currentProduct.target_audience || "");
      setManufacturer(currentProduct.manufacturer || "");
      setCountryOfOrigin(currentProduct.country_of_origin || "");
      setSizeOrVolume(currentProduct.size_or_volume || "");
      setIngredients(currentProduct.ingredients || "");
      setWarnings(currentProduct.warnings || "");
      setStorage(currentProduct.storage || "");
      setWarranty(currentProduct.warranty || "");

      setBarcode(currentProduct.barcode || "");
      setModelNumber(currentProduct.model_number || "");
      setImageUrl(currentProduct.image_url || "");
    } catch (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحميل المنتج.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage() {
    if (!imageFile || !user) {
      return imageUrl;
    }

    const fileExt =
      imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, imageFile, {
        upsert: false,
        contentType: imageFile.type || "image/jpeg",
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveProduct() {
    if (!user || !shop || !product) {
      return;
    }

    if (!name.trim()) {
      setMessage("اكتب اسم المنتج.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const newImageUrl = await uploadImage();

      const productUpdate = {
        name: name.trim(),
        brand: brand.trim() || null,
        category: category.trim() || null,
        price: price === "" ? null : Number(price),
        currency: currency.trim() || "AED",

        description: description.trim() || null,
        specifications: specifications.trim() || null,
        features: features.trim() || null,
        uses: uses.trim() || null,
        target_audience: targetAudience.trim() || null,
        manufacturer: manufacturer.trim() || null,
        country_of_origin: countryOfOrigin.trim() || null,
        size_or_volume: sizeOrVolume.trim() || null,
        ingredients: ingredients.trim() || null,
        warnings: warnings.trim() || null,
        storage: storage.trim() || null,
        warranty: warranty.trim() || null,

        barcode: barcode.trim() || null,
        model_number: modelNumber.trim() || null,

        image_url: newImageUrl || null,

        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("products")
        .update(productUpdate)
        .eq("id", product.id)
        .eq("shop_id", shop.id);

      if (updateError) {
        throw updateError;
      }

      // إعادة المحتوى التسويقي القديم إلى حالة عدم الاعتماد
      // لأن بيانات المنتج تغيرت.
      await supabase
        .from("marketing_contents")
        .delete()
        .eq("product_id", product.id)
        .eq("shop_id", shop.id);

      setMessage("تم حفظ تعديلات المنتج بنجاح.");

      setTimeout(() => {
        router.push(`/product-intelligence/${product.id}`);
      }, 800);
    } catch (error) {
      console.error(error);
      setMessage(
        error?.message || "حدث خطأ أثناء حفظ المنتج."
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
          minHeight: "100vh",
          padding: "30px 16px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          جاري تحميل المنتج...
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: "30px 16px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          المنتج غير موجود.
        </div>
      </main>
    );
  }

  const isLocked =
    product.verification_status === "locked" ||
    product.safety_status === "locked";

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        padding: "24px 16px 60px",
        background: "#f7f7f7",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => router.push("/products")}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            marginBottom: 20,
            fontSize: 15,
          }}
        >
          ← العودة للمنتجات
        </button>

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 22,
            boxShadow: "0 5px 25px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            تعديل المنتج
          </h1>

          {isLocked && (
            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffe69c",
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                lineHeight: 1.8,
              }}
            >
              🔒 هذا المنتج مقفل حاليًا للمراجعة.
              <br />
              يمكنك تعديل بياناته، لكن حالة القفل لا يمكن تغييرها من هنا.
            </div>
          )}

          {message && (
            <div
              style={{
                background: "#eef7ee",
                borderRadius: 10,
                padding: 12,
                marginBottom: 18,
              }}
            >
              {message}
            </div>
          )}

          <div style={{ display: "grid", gap: 14 }}>
            <Field
              label="اسم المنتج"
              value={name}
              onChange={setName}
              required
            />

            <Field
              label="العلامة التجارية"
              value={brand}
              onChange={setBrand}
            />

            <Field
              label="التصنيف"
              value={category}
              onChange={setCategory}
            />

            <Field
              label="السعر"
              value={price}
              onChange={setPrice}
              type="number"
            />

            <Field
              label="العملة"
              value={currency}
              onChange={setCurrency}
            />

            <Field
              label="الباركود"
              value={barcode}
              onChange={setBarcode}
            />

            <Field
              label="رقم الموديل"
              value={modelNumber}
              onChange={setModelNumber}
            />

            <Field
              label="وصف مختصر"
              value={description}
              onChange={setDescription}
              textarea
            />

            <Field
              label="المواصفات"
              value={specifications}
              onChange={setSpecifications}
              textarea
            />

            <Field
              label="المميزات"
              value={features}
              onChange={setFeatures}
              textarea
            />

            <Field
              label="الاستخدامات"
              value={uses}
              onChange={setUses}
              textarea
            />

            <Field
              label="الفئة المستهدفة"
              value={targetAudience}
              onChange={setTargetAudience}
              textarea
            />

            <Field
              label="الشركة المصنعة"
              value={manufacturer}
              onChange={setManufacturer}
            />

            <Field
              label="بلد المنشأ"
              value={countryOfOrigin}
              onChange={setCountryOfOrigin}
            />

            <Field
              label="الحجم / السعة"
              value={sizeOrVolume}
              onChange={setSizeOrVolume}
            />

            <Field
              label="المكونات"
              value={ingredients}
              onChange={setIngredients}
              textarea
            />

            <Field
              label="التحذيرات"
              value={warnings}
              onChange={setWarnings}
              textarea
            />

            <Field
              label="التخزين"
              value={storage}
              onChange={setStorage}
              textarea
            />

            <Field
              label="الضمان"
              value={warranty}
              onChange={setWarranty}
              textarea
            />

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 7,
                  fontWeight: "bold",
                }}
              >
                صورة المنتج
              </label>

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={name || "صورة المنتج"}
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    maxHeight: 320,
                    objectFit: "contain",
                    display: "block",
                    borderRadius: 14,
                    marginBottom: 12,
                    background: "#f5f5f5",
                  }}
                />
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  setImageFile(
                    event.target.files?.[0] || null
                  );
                }}
              />
            </div>

            <button
              onClick={saveProduct}
              disabled={saving}
              style={{
                marginTop: 10,
                border: "none",
                borderRadius: 12,
                padding: "14px 18px",
                background: saving ? "#999" : "#111",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
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
  textarea = false,
  type = "text",
  required = false,
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
        {required ? " *" : ""}
      </label>

      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            resize: "vertical",
            fontFamily: "inherit",
            fontSize: 15,
          }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            fontFamily: "inherit",
            fontSize: 15,
          }}
        />
      )}
    </div>
  );
}
