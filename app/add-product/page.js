"use client";

import { useRef, useState } from "react";

export default function AddProduct() {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [image, setImage] = useState(null);
  const [mode, setMode] = useState(null);
  const [saved, setSaved] = useState(false);

  const [product, setProduct] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    description: "",
    specifications: "",
    features: "",
  });

  function handleImage(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    setImage(imageUrl);
    setSaved(false);

    event.target.value = "";
  }

  function updateProduct(field, value) {
    setProduct((current) => ({
      ...current,
      [field]: value,
    }));

    setSaved(false);
  }

  function saveProduct() {
    if (!product.name.trim()) {
      alert("اكتب اسم المنتج أولاً");
      return;
    }

    setSaved(true);
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fc",
        fontFamily: "Arial, sans-serif",
        color: "#171923",
        padding: "25px 18px",
      }}
    >
      <div
        style={{
          maxWidth: "850px",
          margin: "0 auto",
        }}
      >
        <a
          href="/"
          style={{
            textDecoration: "none",
            color: "#333",
            fontSize: "16px",
            display: "inline-block",
            marginBottom: "20px",
          }}
        >
          ← الرئيسية
        </a>

        <div
          style={{
            background: "#fff",
            borderRadius: "25px",
            padding: "30px 20px",
            border: "1px solid #e8e8ef",
          }}
        >
          <h1
            style={{
              fontSize: "34px",
              margin: "0 0 10px",
            }}
          >
            أضف منتجك 🚀
          </h1>

          <p
            style={{
              color: "#666",
              lineHeight: "1.8",
              marginBottom: "30px",
            }}
          >
            أضف صورة المنتج أو أدخل معلوماته، وسوق AI سيجهزه
            للتحليل والتسويق.
          </p>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImage}
            style={{ display: "none" }}
          />

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            style={{ display: "none" }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <button
              onClick={() => cameraInputRef.current?.click()}
              style={{
                border: "none",
                background: "#6246e5",
                color: "#fff",
                borderRadius: "18px",
                padding: "25px 15px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: "38px" }}>📷</div>

              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  marginTop: "8px",
                }}
              >
                تصوير المنتج
              </div>

              <div
                style={{
                  fontSize: "13px",
                  marginTop: "6px",
                }}
              >
                افتح الكاميرا
              </div>
            </button>

            <button
              onClick={() => galleryInputRef.current?.click()}
              style={{
                border: "1px solid #dedee8",
                background: "#fff",
                color: "#171923",
                borderRadius: "18px",
                padding: "25px 15px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: "38px" }}>🖼️</div>

              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  marginTop: "8px",
                }}
              >
                اختيار صورة
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#777",
                  marginTop: "6px",
                }}
              >
                من ألبوم الصور
              </div>
            </button>
          </div>

          {image && (
            <div
              style={{
                marginTop: "25px",
                background: "#fafafa",
                borderRadius: "20px",
                padding: "15px",
                border: "1px solid #e8e8ee",
              }}
            >
              <div
                style={{
                  fontWeight: "700",
                  marginBottom: "12px",
                }}
              >
                ✅ صورة المنتج
              </div>

              <img
                src={image}
                alt="صورة المنتج"
                style={{
                  width: "100%",
                  maxHeight: "400px",
                  objectFit: "contain",
                  borderRadius: "15px",
                  background: "#fff",
                }}
              />
            </div>
          )}

          <button
            onClick={() => setMode("local")}
            style={{
              width: "100%",
              textAlign: "right",
              border:
                mode === "local"
                  ? "2px solid #6246e5"
                  : "1px solid #e3e3ea",
              background: "#fff",
              borderRadius: "18px",
              padding: "20px",
              cursor: "pointer",
              marginTop: "25px",
            }}
          >
            <div style={{ fontSize: "32px" }}>✍️</div>

            <strong
              style={{
                display: "block",
                fontSize: "18px",
                marginTop: "8px",
              }}
            >
              منتج محلي / غير موجود
            </strong>

            <span
              style={{
                display: "block",
                color: "#777",
                marginTop: "6px",
              }}
            >
              أدخل معلومات المنتج بنفسك
            </span>
          </button>

          {mode === "local" && (
            <section
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "#f8f8fb",
                borderRadius: "18px",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  fontSize: "24px",
                }}
              >
                معلومات المنتج
              </h2>

              <Field
                label="اسم المنتج *"
                placeholder="مثال: عطر إماراتي فاخر"
                value={product.name}
                onChange={(value) =>
                  updateProduct("name", value)
                }
              />

              <Field
                label="العلامة التجارية"
                placeholder="اسم العلامة التجارية"
                value={product.brand}
                onChange={(value) =>
                  updateProduct("brand", value)
                }
              />

              <Field
                label="الفئة"
                placeholder="مثال: عطور، ملابس، إلكترونيات"
                value={product.category}
                onChange={(value) =>
                  updateProduct("category", value)
                }
              />

              <Field
                label="السعر"
                placeholder="مثال: 149"
                value={product.price}
                onChange={(value) =>
                  updateProduct("price", value)
                }
                type="number"
              />

              <TextArea
                label="وصف المنتج"
                placeholder="اكتب وصفًا مختصرًا عن المنتج..."
                value={product.description}
                onChange={(value) =>
                  updateProduct("description", value)
                }
              />

              <TextArea
                label="المواصفات"
                placeholder={
                  "مثال:\nالحجم: 100 مل\nاللون: أسود\nالمادة: ..."
                }
                value={product.specifications}
                onChange={(value) =>
                  updateProduct("specifications", value)
                }
              />

              <TextArea
                label="المميزات"
                placeholder={
                  "مثال:\nجودة عالية\nصناعة محلية\nتصميم فاخر"
                }
                value={product.features}
                onChange={(value) =>
                  updateProduct("features", value)
                }
              />

              <button
                onClick={saveProduct}
                style={{
                  width: "100%",
                  marginTop: "10px",
                  border: "none",
                  background: "#111827",
                  color: "#fff",
                  padding: "16px",
                  borderRadius: "14px",
                  fontSize: "17px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                💾 حفظ المنتج
              </button>

              {saved && (
                <div
                  style={{
                    marginTop: "15px",
                    padding: "15px",
                    background: "#ecfdf5",
                    borderRadius: "12px",
                    color: "#166534",
                    fontWeight: "700",
                  }}
                >
                  ✅ تم حفظ المنتج مؤقتًا بنجاح
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontWeight: "700",
          marginBottom: "8px",
        }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid #ddd",
          borderRadius: "12px",
          padding: "14px",
          fontSize: "16px",
          background: "#fff",
        }}
      />
    </div>
  );
}

function TextArea({
  label,
  placeholder,
  value,
  onChange,
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontWeight: "700",
          marginBottom: "8px",
        }}
      >
        {label}
      </label>

      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid #ddd",
          borderRadius: "12px",
          padding: "14px",
          fontSize: "16px",
          background: "#fff",
          resize: "vertical",
          lineHeight: "1.7",
        }}
      />
    </div>
  );
}
