"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCheckingSession(false);
        return;
      }

      const allowed = await checkAccountStatus(user.id);

      if (!allowed) {
        await supabase.auth.signOut();
        setCheckingSession(false);
        return;
      }

      await checkPolicies(user.id);
    } catch (err) {
      console.error(err);
      setCheckingSession(false);
    }
  }

  async function checkAccountStatus(userId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, role, is_super_admin, account_status, suspension_reason"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      setError("تعذر التحقق من حالة الحساب.");
      return false;
    }

    if (!profile) {
      setError("لم يتم العثور على بيانات الحساب.");
      return false;
    }

    if (
      profile.is_super_admin === true ||
      profile.role === "super_admin"
    ) {
      return true;
    }

    const status = profile.account_status || "active";

    if (status === "blocked") {
      setError(
        profile.suspension_reason
          ? `تم حظر حسابك. السبب: ${profile.suspension_reason}`
          : "تم حظر حسابك. يرجى التواصل مع إدارة سوق AI."
      );

      return false;
    }

    if (status === "suspended") {
      setError(
        profile.suspension_reason
          ? `تم إيقاف حسابك مؤقتًا. السبب: ${profile.suspension_reason}`
          : "تم إيقاف حسابك مؤقتًا. يرجى التواصل مع إدارة سوق AI."
      );

      return false;
    }

    if (status !== "active") {
      setError(
        "حسابك غير متاح حاليًا. يرجى التواصل مع إدارة سوق AI."
      );

      return false;
    }

    return true;
  }

  async function checkPolicies(userId) {
    try {
      const { data: policies, error: policiesError } =
        await supabase
          .from("legal_policies")
          .select("id, version, title, policy_type")
          .eq("is_active", true);

      if (policiesError) {
        throw policiesError;
      }

      if (!policies || policies.length === 0) {
        router.replace("/dashboard");
        return;
      }

      const { data: acceptances, error: acceptancesError } =
        await supabase
          .from("policy_acceptances")
          .select("policy_id, policy_version")
          .eq("user_id", userId);

      if (acceptancesError) {
        throw acceptancesError;
      }

      const acceptedMap = new Map(
        (acceptances || []).map((item) => [
          item.policy_id,
          item.policy_version,
        ])
      );

      const missingPolicy = policies.some((policy) => {
        const acceptedVersion = acceptedMap.get(policy.id);

        return acceptedVersion !== policy.version;
      });

      if (missingPolicy) {
        router.replace("/policies");
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      console.error(err);

      // في حال وجود خطأ في فحص السياسات
      // نمنع الانتقال التلقائي ونوضح للمستخدم المشكلة.
      setError(
        "تعذر التحقق من السياسات الحالية. حاول مرة أخرى."
      );
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    setError("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data?.user) {
        throw new Error("تعذر تسجيل الدخول.");
      }

      const allowed = await checkAccountStatus(
        data.user.id
      );

      if (!allowed) {
        await supabase.auth.signOut();
        return;
      }

      await supabase
        .from("profiles")
        .update({
          last_login_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);

      await checkPolicies(data.user.id);
    } catch (err) {
      console.error(err);

      let message = "تعذر تسجيل الدخول.";

      if (err?.message) {
        if (
          err.message.toLowerCase().includes("invalid login credentials")
        ) {
          message =
            "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        } else if (
          err.message.toLowerCase().includes("email not confirmed")
        ) {
          message =
            "يرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول.";
        } else {
          message = err.message;
        }
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f5f6f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 35,
            borderRadius: 20,
            width: "100%",
            maxWidth: 430,
            textAlign: "center",
            border: "1px solid #e8e8e8",
          }}
        >
          جاري التحقق من الحساب...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: "#fff",
          borderRadius: 24,
          padding: 30,
          border: "1px solid #e8e8e8",
          boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 25,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#777",
              marginBottom: 6,
            }}
          >
            سوق AI
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              color: "#111",
            }}
          >
            تسجيل الدخول
          </h1>

          <p
            style={{
              color: "#777",
              fontSize: 14,
              marginTop: 9,
            }}
          >
            ادخل إلى حسابك لإدارة متجرك ومنتجاتك.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fff0f0",
              border: "1px solid #f0bcbc",
              color: "#9b1c1c",
              borderRadius: 14,
              padding: 14,
              marginBottom: 18,
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                marginBottom: 7,
                fontSize: 14,
                fontWeight: "bold",
              }}
            >
              البريد الإلكتروني
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: "13px 14px",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label
              style={{
                display: "block",
                marginBottom: 7,
                fontSize: 14,
                fontWeight: "bold",
              }}
            >
              كلمة المرور
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              autoComplete="current-password"
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: "13px 14px",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              textAlign: "left",
              marginBottom: 20,
            }}
          >
            <Link
              href="/forgot-password"
              style={{
                color: "#555",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              نسيت كلمة المرور؟
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: "none",
              background: "#111",
              color: "#fff",
              borderRadius: 12,
              padding: "14px 18px",
              fontSize: 16,
              fontWeight: "bold",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: 22,
            paddingTop: 20,
            borderTop: "1px solid #eee",
            fontSize: 14,
            color: "#777",
          }}
        >
          ليس لديك حساب؟{" "}
          <Link
            href="/register"
            style={{
              color: "#111",
              fontWeight: "bold",
              textDecoration: "none",
            }}
          >
            إنشاء حساب
          </Link>
        </div>
      </div>
    </main>
  );
}
