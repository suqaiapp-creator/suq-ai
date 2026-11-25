"use client";

import { useRef, useState } from "react";

export default function AddProduct() {
  const fileInputRef = useRef(null);

  const [image, setImage] = useState(null);
  const [mode, setMode] = useState(null);

  function handleImage(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);
    setMode("photo");
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
            أضف صورة المنتج أو استخدم الباركود أو أدخل معلومات المنتج
            بنفسك.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImage}
            style={{ display: "none" }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%",
              border: "2px dashed #6246e5",
              background: "#f7f4ff",
              borderRadius: "20px",
              padding: "30px 20px",
              cursor: "pointer",
              marginBottom: "15px",
            }}
          >
            <div style={{ fontSize: "45px" }}>📷</div>

            <div
              style={{
                fontSize: "20px",
                fontWeight: "700",
                marginTop: "10px",
              }}
            >
              تصوير أو رفع صورة المنتج
            </div>

            <div
              style={{
                color: "#777",
                marginTop: "8px",
              }}
            >
              اضغط هنا لفتح الكاميرا أو اختيار صورة
            </div>
          </button>

          {image && (
            <div
              style={{
                marginTop: "20px",
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
                معاينة المنتج
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
                onClick={() => fileInputRef.current?.click()}
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

          <div
            style={{
              display: "grid",
              gap: "15px",
              marginTop: "25px",
            }}
          >
            <button
              onClick={() => setMode("barcode")}
              style={{
                textAlign: "right",
                border:
                  mode === "barcode"
                    ? "2px solid #6246e5"
                    : "1px solid #e3e3ea",
                background: "#fff",
                borderRadius: "18px",
                padding: "20px",
                cursor: "pointer",
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

            <button
              onClick={() => setMode("local")}
              style={{
                textAlign: "right",
                border:
                  mode === "local"
                    ? "2px solid #6246e5"
                    : "1px solid #e3e3ea",
                background: "#fff",
                borderRadius: "18px",
                padding: "20px",
                cursor: "pointer",
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
          </div>

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
                سنضيف هنا قارئ الباركود الحقيقي وربطه بقاعدة بيانات
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
                سنضيف هنا نموذجًا لإدخال اسم المنتج ومعلوماته وصوره
                ومواصفاته.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
