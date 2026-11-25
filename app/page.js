"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      router.replace("/dashboard");
    } else {
      setChecking(false);
    }
  }

  if (checking) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          background: "#f7f7f7",
        }}
      >
        جاري التحميل...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f7f7",
        fontFamily: "Arial, sans-serif",
        padding: "30px 18px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          minHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: "40px 24px",
            textAlign: "center",
            boxShadow: "0 8px 35px rgba(0,0,0,0.07)",
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 12,
            }}
          >
            🛍️
          </div>

          <h1
            style={{
              margin: "0 0 12px",
              fontSize: 34,
            }}
          >
            سوق AI
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.8,
              color: "#555",
              margin: "0 auto 28px",
              maxWidth: 650,
            }}
          >
            من منتجك إلى تسويقه وإعلانه بالذكاء الاصطناعي
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            <button
              onClick={() => router.push("/login")}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 14,
                padding: "15px",
                background: "#111",
                color: "#fff",
                fontSize: 17,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              تسجيل الدخول
            </button>

            <button
              onClick={() => router.push("/register")}
              style={{
                width: "100%",
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: "15px",
                background: "#fff",
                color: "#111",
                fontSize: 17,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              إنشاء حساب جديد
            </button>
          </div>

          <p
            style={{
              marginTop: 25,
              fontSize: 14,
              color: "#777",
            }}
          >
            ابدأ بإنشاء حسابك ومعلومات محلك، ثم أضف منتجاتك.
          </p>
        </div>
      </div>
    </main>
  );
}
