"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
        return;
      }

      setChecking(false);
    }

    checkSession();
  }, [router, supabase]);

  async function handleLogin(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("اكتب البريد الإلكتروني.");
      return;
    }

    if (!password) {
      setError("اكتب كلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError("حدث خطأ غير متوقع. حاول مرة أخرى.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("اكتب بريدك الإلكتروني أولاً.");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
          }
        );

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setMessage(
        "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني."
      );
    } catch (err) {
      console.error(err);
      setError("تعذر إرسال رابط إعادة تعيين كلمة المرور.");
    }

    setLoading(false);
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
          background: "#f7f8fa",
          fontFamily: "Arial, sans-serif",
          color: "#374151",
        }}
      >
        جاري التحقق...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px 24px",
          boxShadow: "0 10px 35px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "42px",
              marginBottom: "8px",
            }}
          >
            🛍️
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              color: "#111827",
            }}
          >
            تسجيل الدخول
          </h1>

          <p
            style={{
              marginTop: "10px",
              color: "#6b7280",
              fontSize: "15px",
              lineHeight: "1.7",
            }}
          >
            ادخل إلى سوق AI لإدارة متجرك ومنتجاتك وتسويقك.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <label style={labelStyle}>
            البريد الإلكتروني
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
            style={inputStyle}
          />

          <label style={labelStyle}>
            كلمة المرور
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            autoComplete="current-password"
            style={inputStyle}
          />

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            style={{
              display: "block",
              marginTop: "12px",
              marginRight: "auto",
              border: "none",
              background: "transparent",
              color: "#4b5563",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            نسيت كلمة المرور؟
          </button>

          {error && (
            <div
              style={{
                marginTop: "18px",
                padding: "12px",
                borderRadius: "12px",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: "14px",
                lineHeight: "1.7",
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                marginTop: "18px",
                padding: "12px",
                borderRadius: "12px",
                background: "#ecfdf5",
                color: "#047857",
                fontSize: "14px",
                lineHeight: "1.7",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "22px",
              padding: "15px",
              border: "none",
              borderRadius: "14px",
              background: loading ? "#9ca3af" : "#111827",
              color: "#ffffff",
              fontSize: "17px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "22px",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          ما عندك حساب؟

          <button
            type="button"
            onClick={() => router.push("/register")}
            style={{
              border: "none",
              background: "none",
              color: "#111827",
              fontWeight: "bold",
              cursor: "pointer",
              marginRight: "6px",
            }}
          >
            إنشاء حساب
          </button>
        </div>
      </div>
    </main>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  marginTop: "16px",
  color: "#374151",
  fontSize: "14px",
  fontWeight: "bold",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  fontSize: "16px",
  outline: "none",
  background: "#ffffff",
};
