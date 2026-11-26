"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [accepted, setAccepted] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function handleRegister(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!fullName.trim()) {
      setError("اكتب اسمك الكامل.");
      return;
    }

    if (!email.trim()) {
      setError("اكتب البريد الإلكتروني.");
      return;
    }

    if (password.length < 6) {
      setError(
        "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "كلمتا المرور غير متطابقتين."
      );
      return;
    }

    if (!accepted) {
      setError(
        "يجب الموافقة على الشروط والسياسات."
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: email
            .trim()
            .toLowerCase(),

          password,

          options: {
            data: {
              full_name:
                fullName.trim(),

              /*
               * نستخدم هذه القيمة داخل
               * Trigger إنشاء المستخدم
               * لتسجيل الموافقة على
               * السياسات النشطة.
               */
              accepted_policies: true,
            },

            emailRedirectTo:
              `${window.location.origin}/login`,
          },
        });

      if (signUpError) {
        setError(
          signUpError.message
        );
        setLoading(false);
        return;
      }

      /*
       * إذا تم إنشاء جلسة مباشرة
       */
      if (data?.session) {
        router.push(
          "/setup-shop"
        );
        return;
      }

      /*
       * إذا كان تأكيد البريد مفعلاً
       */
      setMessage(
        "تم إنشاء الحساب بنجاح. افتح بريدك الإلكتروني لتأكيد الحساب، وبعدها سجل الدخول."
      );

      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err) {
      console.error(err);

      setError(
        "حدث خطأ غير متوقع. حاول مرة أخرى."
      );

      setLoading(false);
    }
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
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "24px",
          padding:
            "32px 24px",
          boxShadow:
            "0 10px 35px rgba(0,0,0,0.08)",
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
            إنشاء حساب
          </h1>

          <p
            style={{
              marginTop: "10px",
              color: "#6b7280",
              fontSize: "15px",
              lineHeight: "1.7",
            }}
          >
            ابدأ بإدارة متجرك وتسويق
            منتجاتك بالذكاء الاصطناعي
          </p>
        </div>

        <form
          onSubmit={handleRegister}
        >
          <label
            style={labelStyle}
          >
            الاسم الكامل
          </label>

          <input
            type="text"
            value={fullName}
            onChange={(e) =>
              setFullName(
                e.target.value
              )
            }
            placeholder="مثال: أحمد محمد"
            autoComplete="name"
            style={inputStyle}
          />

          <label
            style={labelStyle}
          >
            البريد الإلكتروني
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            placeholder="example@email.com"
            autoComplete="email"
            style={inputStyle}
          />

          <label
            style={labelStyle}
          >
            كلمة المرور
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            placeholder="6 أحرف على الأقل"
            autoComplete="new-password"
            style={inputStyle}
          />

          <label
            style={labelStyle}
          >
            تأكيد كلمة المرور
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
            placeholder="أعد كتابة كلمة المرور"
            autoComplete="new-password"
            style={inputStyle}
          />

          <label
            style={{
              display: "flex",
              alignItems:
                "flex-start",
              gap: "10px",
              marginTop: "18px",
              fontSize: "14px",
              color: "#4b5563",
              lineHeight: "1.7",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) =>
                setAccepted(
                  e.target.checked
                )
              }
              style={{
                marginTop: "5px",
                width: "18px",
                height: "18px",
              }}
            />

            <span>
              أوافق على شروط الاستخدام
              وسياسة الخصوصية وسياسة
              المحتوى والاستخدام
              بالذكاء الاصطناعي.
            </span>
          </label>

          {error && (
            <div
              style={{
                marginTop: "18px",
                padding: "12px",
                borderRadius: "12px",
                background:
                  "#fef2f2",
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
                background:
                  "#ecfdf5",
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
              background: loading
                ? "#9ca3af"
                : "#111827",
              color: "#ffffff",
              fontSize: "17px",
              fontWeight: "bold",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "جاري إنشاء الحساب..."
              : "إنشاء الحساب"}
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
          لديك حساب بالفعل؟

          <button
            type="button"
            onClick={() =>
              router.push(
                "/login"
              )
            }
            style={{
              border: "none",
              background: "none",
              color: "#111827",
              fontWeight: "bold",
              cursor: "pointer",
              marginRight: "6px",
            }}
          >
            تسجيل الدخول
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
  border:
    "1px solid #d1d5db",
  borderRadius: "12px",
  fontSize: "16px",
  outline: "none",
  background: "#ffffff",
};
