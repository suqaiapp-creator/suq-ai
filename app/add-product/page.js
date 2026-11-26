"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function AddProductPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    currency: "AED",
    description: "",
    specifications: "",
    features: "",
    barcode: "",
    model_number: "",
    product_type: "local",
    manufacturer: "",
    country_of_origin: "",
    size_or_volume: "",
    ingredients: "",
    warnings: "",
    storage: "",
    warranty: "",
    uses: "",
    target_audience: "",
  });

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUser(user);

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("account_status, is_super_admin")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (
        profile &&
        !profile.is_super_admin &&
        profile.account_status !== "active"
      ) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const { data: shopData, error: shopError } =
        await supabase
          .from("shops")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", {
            ascending: true,
          })
          .limit(1)
          .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        setError(
          "لا يوجد محل مرتبط بحسابك. أنشئ بيانات المحل أولاً."
        );
        setLoading(false);
        return;
      }

      setShop(shopData);

      if (shopData.currency) {
        setForm((current) => ({
          ...current,
          currency: shopData.currency,
        }));
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || "حدث خطأ أثناء تحميل بيانات الحساب."
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

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");

    if (!file.type.startsWith("image/")) {
      setError("الملف يجب أن يكون صورة.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 10MB.");
      return;
    }

    setImageFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function uploadImage(file, userId) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `${userId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("products")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function createProduct() {
    setError("");
    setMessage("");

    if (!shop) {
      setError("لا يوجد محل مرتبط بحسابك.");
      return;
    }

    if (!form.name.trim()) {
      setError("اسم المنتج مطلوب.");
      return;
    }

    if (form.price !== "") {
      const numericPrice = Number(form.price);

      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        setError("السعر غير صحيح.");
        return;
      }
    }

    setSaving(true);

    try {
      let imageUrl = null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile, user.id);
      }

      const productData = {
        shop_id: shop.id,

        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,

        price:
          form.price === ""
            ? null
            : Number(form.price),

        currency: form.currency || "AED",

        description:
          form.description.trim() || null,

        specifications:
          form.specifications.trim() || null,

        features:
          form.features.trim() || null,

        barcode:
          form.barcode.trim() || null,

        model_number:
          form.model_number.trim() || null,

        product_type:
          form.product_type || "local",

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

        uses:
          form.uses.trim() || null,

        target_audience:
          form.target_audience.trim() || null,

        image_url: imageUrl,

        verification_status: "unverified",
        ai_status: "pending",
        safety_status: "clear",
        safety_level: "low",
      };

      const { data: product, error: productError } =
        await supabase
          .from("products")
          .insert(productData)
          .select("*")
          .single();

      if (productError) {
        throw productError;
      }

      // تسجيل إنشاء المنتج
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        shop_id: shop.id,
        action: "create_product",
        entity_type: "product",
        entity_id: product.id,
        description: `تمت إضافة المنتج: ${product.name}`,
        metadata: {
          product_id: product.id,
          product_name: product.name,
          product_type: product.product_type,
        },
      });

      setMessage(
        "تمت إضافة المنتج بنجاح. جاري الانتقال إلى تحليل المنتج..."
      );

      /*
       * لا نستدعي OpenAI من هذه الصفحة.
       * التحليل يتم من صفحة الذكاء/المسار المخصص له
       * حتى لا نكرر استهلاك API.
       */

      setTimeout(() => {
        router.push(`/product-intelligence/${product.id}`);
      }, 500);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "حدث خطأ أثناء إضافة المنتج."
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
          background: "#f6f8f7",
          padding: "40px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 20,
            padding: 30,
            textAlign: "center",
          }}
        >
          جاري تحميل بيانات المحل...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f6f8f7",
        padding: "25px 16px 50px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1050,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: 20,
          }}
        >
          <Link
            href="/products"
            style={{
              color: "#16834b",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← العودة للمنتجات
          </Link>

          <h1
            style={{
              margin: "12px 0 5px",
              fontSize: 30,
            }}
          >
            إضافة منتج جديد
          </h1>

          <p
            style={{
              margin: 0,
              color: "#666",
            }}
          >
            المحل: {shop?.name || "—"}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fff1f0",
              border: "1px solid #f3b5b0",
              color: "#a61b13",
              borderRadius: 14,
              padding: 15,
              marginBottom: 20,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              background: "#e8f7ee",
              border: "1px solid #9ad5b4",
              color: "#146c40",
              borderRadius: 14,
              padding: 15,
              marginBottom: 20,
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        )}

        {/* الصورة */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            صورة المنتج
          </h2>

          <p
            style={{
              color: "#666",
              marginTop: 0,
            }}
          >
            الصورة تساعد الذكاء الاصطناعي على التعرف على المنتج والتحقق
            من معلوماته.
          </p>

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{
              width: "100%",
              padding: 12,
              border: "1px dashed #b9c5be",
              borderRadius: 12,
              background: "#fafcfb",
            }}
          />

          {previewUrl && (
            <div
              style={{
                marginTop: 18,
              }}
            >
              <img
                src={previewUrl}
                alt="معاينة المنتج"
                style={{
                  width: "100%",
                  maxWidth: 350,
                  height: 280,
                  objectFit: "contain",
                  background: "#f7f7f7",
                  borderRadius: 15,
                }}
              />
            </div>
          )}
        </section>

        {/* البيانات الأساسية */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            البيانات الأساسية
          </h2>

          <div className="form-grid">
            <Field
              label="اسم المنتج *"
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
              label="الشركة المصنعة"
              value={form.manufacturer}
              onChange={(value) =>
                updateField("manufacturer", value)
              }
            />

            <Field
              label="رقم الموديل"
              value={form.model_number}
              onChange={(value) =>
                updateField("model_number", value)
              }
            />

            <Field
              label="الباركود"
              value={form.barcode}
              onChange={(value) =>
                updateField("barcode", value)
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

            <div>
              <label className="field-label">
                العملة
              </label>

              <select
                value={form.currency}
                onChange={(e) =>
                  updateField(
                    "currency",
                    e.target.value
                  )
                }
                className="field-input"
              >
                <option value="AED">
                  AED - درهم إماراتي
                </option>
                <option value="SAR">
                  SAR - ريال سعودي
                </option>
                <option value="KWD">
                  KWD - دينار كويتي
                </option>
                <option value="QAR">
                  QAR - ريال قطري
                </option>
                <option value="BHD">
                  BHD - دينار بحريني
                </option>
                <option value="OMR">
                  OMR - ريال عماني
                </option>
                <option value="USD">
                  USD - دولار
                </option>
              </select>
            </div>

            <div>
              <label className="field-label">
                نوع المنتج
              </label>

              <select
                value={form.product_type}
                onChange={(e) =>
                  updateField(
                    "product_type",
                    e.target.value
                  )
                }
                className="field-input"
              >
                <option value="local">
                  محلي
                </option>

                <option value="imported">
                  مستورد
                </option>
              </select>
            </div>

            <Field
              label="بلد المنشأ"
              value={form.country_of_origin}
              onChange={(value) =>
                updateField(
                  "country_of_origin",
                  value
                )
              }
            />

            <Field
              label="الحجم / الكمية"
              value={form.size_or_volume}
              onChange={(value) =>
                updateField(
                  "size_or_volume",
                  value
                )
              }
            />
          </div>
        </section>

        {/* وصف المنتج */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            وصف المنتج
          </h2>

          <TextArea
            label="الوصف"
            value={form.description}
            onChange={(value) =>
              updateField(
                "description",
                value
              )
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
              updateField(
                "features",
                value
              )
            }
          />
        </section>

        {/* معلومات الاستخدام */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            معلومات إضافية
          </h2>

          <TextArea
            label="الاستخدامات"
            value={form.uses}
            onChange={(value) =>
              updateField("uses", value)
            }
          />

          <TextArea
            label="الفئة المستهدفة"
            value={form.target_audience}
            onChange={(value) =>
              updateField(
                "target_audience",
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
        </section>

        {/* زر الحفظ */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={createProduct}
            disabled={saving}
            style={{
              flex: 1,
              minWidth: 220,
              border: "none",
              borderRadius: 14,
              padding: "16px 20px",
              background: saving
                ? "#8db8a0"
                : "#16834b",
              color: "#fff",
              fontSize: 17,
              fontWeight: 800,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
          >
            {saving
              ? "جاري إضافة المنتج..."
              : "➕ إضافة المنتج"}
          </button>

          <Link
            href="/products"
            style={{
              minWidth: 160,
              textAlign: "center",
              borderRadius: 14,
              padding: "16px 20px",
              background: "#eef1ef",
              color: "#333",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            إلغاء
          </Link>
        </div>
      </div>

      <style jsx>{`
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .field-label {
          display: block;
          margin-bottom: 7px;
          font-weight: 700;
          color: #333;
        }

        .field-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9dedb;
          border-radius: 11px;
          padding: 12px 13px;
          font-size: 15px;
          outline: none;
          background: #fff;
        }

        .field-input:focus {
          border-color: #16834b;
        }

        @media (max-width: 700px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
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
      <label className="field-label">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="field-input"
      />

      <style jsx>{`
        .field-label {
          display: block;
          margin-bottom: 7px;
          font-weight: 700;
          color: #333;
        }

        .field-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9dedb;
          border-radius: 11px;
          padding: 12px 13px;
          font-size: 15px;
          outline: none;
          background: #fff;
        }

        .field-input:focus {
          border-color: #16834b;
        }
      `}</style>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}) {
  return (
    <div
      style={{
        marginBottom: 16,
      }}
    >
      <label
        style={{
          display: "block",
          marginBottom: 7,
          fontWeight: 700,
          color: "#333",
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
          border: "1px solid #d9dedb",
          borderRadius: 11,
          padding: 13,
          fontSize: 15,
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}
