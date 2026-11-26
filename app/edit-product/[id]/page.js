"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [product, setProduct] = useState(null);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    currency: "AED",
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
    barcode: "",
    model_number: "",
    product_type: "local",
  });

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!data) {
        setError("المنتج غير موجود.");
        setLoading(false);
        return;
      }

      // التأكد أن المنتج تابع لمحل المستخدم
      const { data: shop, error: shopError } = await supabase
        .from("shops")
        .select("id, name")
        .eq("id", data.shop_id)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shop) {
        setError("غير مصرح لك بتعديل هذا المنتج.");
        setLoading(false);
        return;
      }

      setProduct({
        ...data,
        shop,
      });

      setForm({
        name: data.name || "",
        brand: data.brand || "",
        category: data.category || "",
        price:
          data.price !== null && data.price !== undefined
            ? String(data.price)
            : "",
        currency: data.currency || "AED",
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
        barcode: data.barcode || "",
        model_number: data.model_number || "",
        product_type: data.product_type || "local",
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء تحميل المنتج.");
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

  function isLocked() {
    return (
      product?.verification_status === "locked" ||
      product?.safety_status === "locked"
    );
  }

  function isViolation() {
    return (
      product?.safety_status === "violation" ||
      product?.safety_level === "critical"
    );
  }

  function isUnclear() {
    if (!product) return false;

    if (
      product.verification_status === "review" ||
      product.verification_status === "unverified"
    ) {
      return true;
    }

    if (
      product.confidence === "low" ||
      product.confidence === "منخفض" ||
      product.confidence === "medium" ||
      product.confidence === "متوسط"
    ) {
      return true;
    }

    if (
      product.name &&
      (!product.brand ||
        !product.category ||
        !product.description)
    ) {
      return true;
    }

    return false;
  }

  async function saveProduct() {
    setError("");
    setMessage("");

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
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        router.replace("/login");
        return;
      }

      const user = userData.user;

      // نتأكد مرة ثانية من ملكية المحل
      const { data: shop, error: shopError } = await supabase
        .from("shops")
        .select("id")
        .eq("id", product.shop_id)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shop) {
        throw new Error("غير مصرح لك بتعديل هذا المنتج.");
      }

      const updateData = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,
        price: form.price === "" ? null : Number(form.price),
        currency: form.currency || "AED",
        description: form.description.trim() || null,
        specifications: form.specifications.trim() || null,
        features: form.features.trim() || null,
        uses: form.uses.trim() || null,
        target_audience: form.target_audience.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        country_of_origin: form.country_of_origin.trim() || null,
        size_or_volume: form.size_or_volume.trim() || null,
        ingredients: form.ingredients.trim() || null,
        warnings: form.warnings.trim() || null,
        storage: form.storage.trim() || null,
        warranty: form.warranty.trim() || null,
        barcode: form.barcode.trim() || null,
        model_number: form.model_number.trim() || null,
        product_type: form.product_type || "local",
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", product.id)
        .eq("shop_id", shop.id);

      if (updateError) {
        throw updateError;
      }

      // تسجيل النشاط إذا أمكن
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        shop_id: shop.id,
        action: "update_product",
        entity_type: "product",
        entity_id: product.id,
        description: `تم تعديل المنتج: ${form.name.trim()}`,
        metadata: {
          product_id: product.id,
          product_name: form.name.trim(),
        },
      });

      setMessage("تم حفظ تعديلات المنتج بنجاح ✅");

      setProduct((current) => ({
        ...current,
        ...updateData,
      }));
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء حفظ التعديلات.");
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
            maxWidth: 1000,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 20,
            padding: 30,
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
          background: "#f6f8f7",
          padding: "40px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 20,
            padding: 30,
            textAlign: "center",
          }}
        >
          <h2 style={{ marginTop: 0 }}>المنتج غير موجود</h2>

          {error && (
            <p style={{ color: "#b42318" }}>
              {error}
            </p>
          )}

          <Link
            href="/products"
            style={{
              display: "inline-block",
              marginTop: 15,
              padding: "12px 20px",
              borderRadius: 10,
              background: "#16834b",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            العودة للمنتجات
          </Link>
        </div>
      </main>
    );
  }

  const locked = isLocked();
  const violation = isViolation();
  const unclear = isUnclear();

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
        {/* العنوان */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 15,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
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
              تعديل المنتج
            </h1>

            <p
              style={{
                margin: 0,
                color: "#666",
              }}
            >
              {product.shop?.name || "المحل"}
            </p>
          </div>

          {/* حالة المنتج */}
          <div
            style={{
              padding: "12px 18px",
              borderRadius: 14,
              fontWeight: 800,
              background: locked
                ? "#fee4e2"
                : unclear
                ? "#fff4cc"
                : "#e8f7ee",
              color: locked
                ? "#b42318"
                : unclear
                ? "#8a5a00"
                : "#16794a",
            }}
          >
            {locked
              ? "🔴 المنتج مقفل"
              : unclear
              ? "🟡 معلومات غير واضحة"
              : "🟢 المنتج واضح"}
          </div>
        </div>

        {/* تنبيهات */}
        {locked && (
          <div
            style={{
              background: "#fff1f0",
              border: "1px solid #f3b5b0",
              borderRadius: 16,
              padding: 18,
              marginBottom: 20,
              color: "#9f1c16",
            }}
          >
            <strong>🔒 هذا المنتج مقفل</strong>

            <p style={{ marginBottom: 0 }}>
              المنتج المقفل لا يمكن استخدامه في التسويق أو التصميم أو النشر
              حتى تتم مراجعته من Super Admin.
            </p>

            {product.safety_reason && (
              <p
                style={{
                  marginBottom: 0,
                  marginTop: 10,
                }}
              >
                <strong>سبب القفل:</strong>{" "}
                {product.safety_reason}
              </p>
            )}
          </div>
        )}

        {!locked && unclear && (
          <div
            style={{
              background: "#fff9e6",
              border: "1px solid #f0d98a",
              borderRadius: 16,
              padding: 18,
              marginBottom: 20,
              color: "#795500",
            }}
          >
            <strong>⚠️ معلومات المنتج غير مكتملة أو غير مؤكدة</strong>

            <p style={{ marginBottom: 0 }}>
              يمكنك تعديل البيانات وإكمالها. وعند استخدام المنتج للتسويق أو
              التصميم سيطلب منك النظام تأكيد مسؤوليتك عنه.
            </p>
          </div>
        )}

        {violation && !locked && (
          <div
            style={{
              background: "#fff1f0",
              border: "1px solid #f3b5b0",
              borderRadius: 16,
              padding: 18,
              marginBottom: 20,
              color: "#9f1c16",
            }}
          >
            <strong>⚠️ توجد ملاحظة على سلامة المنتج</strong>

            {product.safety_reason && (
              <p style={{ marginBottom: 0 }}>
                {product.safety_reason}
              </p>
            )}
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

        {/* الصورة */}
        {product.image_url && (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              marginBottom: 20,
              boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>صورة المنتج</h3>

            <img
              src={product.image_url}
              alt={product.name}
              style={{
                width: "100%",
                maxWidth: 320,
                height: 250,
                objectFit: "contain",
                borderRadius: 15,
                background: "#f7f7f7",
              }}
            />
          </div>
        )}

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
          <h2 style={{ marginTop: 0 }}>البيانات الأساسية</h2>

          <div className="form-grid">
            <Field
              label="اسم المنتج *"
              value={form.name}
              onChange={(value) => updateField("name", value)}
            />

            <Field
              label="العلامة التجارية"
              value={form.brand}
              onChange={(value) => updateField("brand", value)}
            />

            <Field
              label="التصنيف"
              value={form.category}
              onChange={(value) => updateField("category", value)}
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
              onChange={(value) => updateField("barcode", value)}
            />

            <Field
              label="السعر"
              type="number"
              value={form.price}
              onChange={(value) => updateField("price", value)}
            />

            <div>
              <label className="field-label">العملة</label>

              <select
                value={form.currency}
                onChange={(e) =>
                  updateField("currency", e.target.value)
                }
                className="field-input"
              >
                <option value="AED">AED - درهم إماراتي</option>
                <option value="SAR">SAR - ريال سعودي</option>
                <option value="KWD">KWD - دينار كويتي</option>
                <option value="QAR">QAR - ريال قطري</option>
                <option value="BHD">BHD - دينار بحريني</option>
                <option value="OMR">OMR - ريال عماني</option>
                <option value="USD">USD - دولار</option>
              </select>
            </div>

            <div>
              <label className="field-label">نوع المنتج</label>

              <select
                value={form.product_type}
                onChange={(e) =>
                  updateField("product_type", e.target.value)
                }
                className="field-input"
              >
                <option value="local">محلي</option>
                <option value="imported">مستورد</option>
              </select>
            </div>

            <Field
              label="بلد المنشأ"
              value={form.country_of_origin}
              onChange={(value) =>
                updateField("country_of_origin", value)
              }
            />

            <Field
              label="الحجم / الكمية"
              value={form.size_or_volume}
              onChange={(value) =>
                updateField("size_or_volume", value)
              }
            />
          </div>
        </section>

        {/* الوصف */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>وصف المنتج</h2>

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
              updateField("specifications", value)
            }
          />

          <TextArea
            label="المميزات"
            value={form.features}
            onChange={(value) =>
              updateField("features", value)
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
          <h2 style={{ marginTop: 0 }}>معلومات الاستخدام</h2>

          <TextArea
            label="الاستخدامات"
            value={form.uses}
            onChange={(value) => updateField("uses", value)}
          />

          <TextArea
            label="الفئة المستهدفة"
            value={form.target_audience}
            onChange={(value) =>
              updateField("target_audience", value)
            }
          />

          <TextArea
            label="المكونات"
            value={form.ingredients}
            onChange={(value) =>
              updateField("ingredients", value)
            }
          />

          <TextArea
            label="التحذيرات"
            value={form.warnings}
            onChange={(value) =>
              updateField("warnings", value)
            }
          />

          <TextArea
            label="طريقة التخزين"
            value={form.storage}
            onChange={(value) =>
              updateField("storage", value)
            }
          />

          <TextArea
            label="الضمان"
            value={form.warranty}
            onChange={(value) =>
              updateField("warranty", value)
            }
          />
        </section>

        {/* أزرار */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 30,
          }}
        >
          <button
            onClick={saveProduct}
            disabled={saving}
            style={{
              flex: 1,
              minWidth: 220,
              border: "none",
              borderRadius: 14,
              padding: "15px 20px",
              background: saving ? "#8db8a0" : "#16834b",
              color: "#fff",
              fontSize: 17,
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "جاري الحفظ..." : "💾 حفظ التعديلات"}
          </button>

          <Link
            href="/products"
            style={{
              minWidth: 160,
              textAlign: "center",
              borderRadius: 14,
              padding: "15px 20px",
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
      <label className="field-label">{label}</label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
    <div style={{ marginBottom: 16 }}>
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
        onChange={(e) => onChange(e.target.value)}
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
