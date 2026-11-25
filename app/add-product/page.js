"use client";

import { useState } from "react";

export default function AddProduct() {
  const [selected, setSelected] = useState("");

  const options = [
    {
      id: "photo",
      icon: "📷",
      title: "تصوير أو رفع المنتج",
      text: "صوّر المنتج أو اختر صورة من جهازك",
    },
    {
      id: "barcode",
      icon: "📦",
      title: "مسح الباركود",
      text: "امسح الباركود لمعرفة معلومات المنتج",
    },
    {
      id: "local",
      icon: "✍️",
      title: "منتج محلي / غير موجود",
      text: "أدخل معلومات منتجك بنفسك",
    },
  ];

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fc",
        fontFamily: "Arial, sans-serif",
        color: "#171923",
        padding: "30px 20px",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <button
          onClick={() => window.history.back()}
          style={{
            border: "none",
            background: "transparent",
            fontSize: "16px",
            cursor: "pointer",
            marginBottom: "25px",
          }}
        >
          ← رجوع
        </button>

        <div
          style={{
            background: "#fff",
            borderRadius: "25px",
            padding: "35px 25px",
            border: "1px solid #e8e8ef",
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: "34px" }}>
            أضف منتجك 🚀
          </h1>

          <p
            style={{
              color: "#666",
              fontSize: "17px",
              lineHeight: "1.8",
            }}
          >
            اختر الطريقة المناسبة لإضافة المنتج، وسوق AI سيتولى الباقي.
          </p>

          <div
            style={{
              display: "grid",
              gap: "15px",
              marginTop: "30px",
            }}
          >
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                style={{
                  textAlign: "right",
                  border:
                    selected === option.id
                      ? "2px solid #6246e5"
                      : "1px solid #e3e3ea",
                  background:
                    selected === option.id ? "#f3f0ff" : "#fff",
                  borderRadius: "18px",
                  padding: "22px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                  {option.icon}
                </div>

                <div
                  style={{
                    fontSize: "19px",
                    fontWeight: "700",
                    marginBottom: "7px",
                  }}
                >
                  {option.title}
                </div>

                <div style={{ color: "#777", fontSize: "14px" }}>
                  {option.text}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div
              style={{
                marginTop: "25px",
                padding: "20px",
                background: "#f8f8fb",
                borderRadius: "16px",
              }}
            >
              <strong>
                {selected === "photo" && "📷 سيتم تجهيز رفع صورة المنتج"}
                {selected === "barcode" && "📦 سيتم تجهيز قارئ الباركود"}
                {selected === "local" && "✍️ سيتم تجهيز بيانات المنتج المحلي"}
              </strong>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
