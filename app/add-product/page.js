"use client";

import { useRef, useState } from "react";

export default function AddProduct() {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [image, setImage] = useState(null);
  const [mode, setMode] = useState(null);

  function handleImage(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);
    setMode("photo");

    event.target.value = "";
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
      <div style={{ maxWidth: "850px", margin: "0 auto" }}>
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
            صوّر منتجك أو اختر صورة من الألبوم، وبعدها سوق AI يحلل
            المنتج ويجهزه للتسويق.
          </p>

          {/* ملفات الإدخال */}
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

          {/* الكاميرا والألبوم */}
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
                  opacity: 0.9,
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

          {/* معاينة الصورة */}
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
                ✅ تم اختيار صورة المنتج
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

              <button
                onClick={() => galleryInputRef.current?.click()}
                style={{
                  width: "100%",
                  marginTop: "12px",
                  border: "none",
                  background: "#111827",
                  color: "#fff",
                  padding: "13px",
                  borderRadius: "12px",
                  cursor: "pointer",
                }}
              >
                تغيير الصورة
              </button>
            </div>
          )}

          {/* الباركود */}
          <button
            onClick={() => setMode("barcode")}
            style={{
              width: "100%",
              textAlign: "right",
              border:
                mode === "barcode"
                  ? "2px solid #6246e5"
                  : "1px solid #e3e3ea",
              background: "#fff",
              borderRadius: "18px",
              padding: "20px",
              cursor: "pointer",
              marginTop: "25px",
            }}
          >
            <div style={{ fontSize: "32px" }}>📦</div>

            <strong
              style={{
                display: "block",
                fontSize: "18px",
                marginTop: "8px",
              }}
            >
              مسح الباركود
            </strong>

            <span
              style={{
                display: "block",
                color: "#777",
                marginTop: "6px",
              }}
            >
              ابحث عن المنتج عن طريق الباركود
            </span>
          </button>

          {/* المنتج المحلي */}
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
              marginTop: "15px",
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

          {mode === "barcode" && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "#f5f5f8",
                borderRadius: "16px",
              }}
            >
              <strong>📦 قارئ الباركود</strong>

              <p style={{ color: "#666", lineHeight: "1.7" }}>
                سنربط هذه الصفحة لاحقًا بقارئ باركود وقاعدة بيانات
                المنتجات.
              </p>
            </div>
          )}

          {mode === "local" && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "#f5f5f8",
                borderRadius: "16px",
              }}
            >
              <strong>✍️ منتج محلي</strong>

              <p style={{ color: "#666", lineHeight: "1.7" }}>
                سنضيف هنا نموذجًا كاملًا لاسم المنتج ومواصفاته
                وصوره ومعلوماته.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
