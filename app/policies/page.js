"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function PoliciesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [accepted, setAccepted] = useState({});

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: activePolicies, error } = await supabase
      .from("legal_policies")
      .select("id, policy_type, version, title, content")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      alert("تعذر تحميل السياسات");
      return;
    }

    const { data: acceptances } = await supabase
      .from("policy_acceptances")
      .select("policy_id, policy_version")
      .eq("user_id", user.id);

    const acceptedMap = {};

    (acceptances || []).forEach((item) => {
      acceptedMap[item.policy_id] = item.policy_version;
    });

    setPolicies(activePolicies || []);
    setAccepted(acceptedMap);
    setLoading(false);
  }

  function isAccepted(policy) {
    return accepted[policy.id] === policy.version;
  }

  function allAccepted() {
    return policies.every((policy) => isAccepted(policy));
  }

  async function acceptPolicies() {
    if (!allAccepted()) {
      alert("يجب الموافقة على جميع السياسات");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const rows = policies.map((policy) => ({
        user_id: user.id,
        policy_id: policy.id,
        policy_version: policy.version,
      }));

      const { error } = await supabase
        .from("policy_acceptances")
        .upsert(rows, {
          onConflict: "user_id,policy_id",
        });

      if (error) {
        throw error;
      }

      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      alert("تعذر حفظ الموافقة");
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        جاري تحميل السياسات...
      </main>
    );
  }

  if (policies.length === 0) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f6f7f9",
          padding: 20,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "80px auto",
            background: "#fff",
            borderRadius: 20,
            padding: 30,
            textAlign: "center",
          }}
        >
          <h1>السياسات</h1>

          <p style={{ color: "#666", lineHeight: 1.8 }}>
            لا توجد سياسات فعّالة حاليًا.
          </p>

          <button
            onClick={() => router.replace("/dashboard")}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "13px 25px",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            العودة للوحة التحكم
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f6f7f9",
        padding: "25px 16px 50px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 850,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#111",
            color: "#fff",
            borderRadius: 20,
            padding: 25,
            marginBottom: 20,
          }}
        >
          <h1 style={{ margin: 0 }}>
            تحديث السياسات
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.85,
              lineHeight: 1.8,
            }}
          >
            توجد سياسات محدثة تحتاج إلى موافقتك قبل متابعة استخدام سوق AI.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 15,
          }}
        >
          {policies.map((policy) => (
            <section
              key={policy.id}
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 20,
                boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 15,
                  alignItems: "center",
                  marginBottom: 15,
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>
                    {policy.title}
                  </h2>

                  <div
                    style={{
                      marginTop: 6,
                      color: "#777",
                      fontSize: 14,
                    }}
                  >
                    الإصدار {policy.version}
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 20,
                    background: isAccepted(policy)
                      ? "#e8f7ed"
                      : "#fff3cd",
                    color: isAccepted(policy)
                      ? "#18743b"
                      : "#856404",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isAccepted(policy)
                    ? "تمت الموافقة"
                    : "تحتاج موافقة"}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 15,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.9,
                  color: "#444",
                  maxHeight: 300,
                  overflowY: "auto",
                }}
              >
                {policy.content}
              </div>

              {!isAccepted(policy) && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    marginTop: 15,
                    cursor: "pointer",
                    lineHeight: 1.7,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!accepted[policy.id]}
                    onChange={(e) =>
                      setAccepted({
                        ...accepted,
                        [policy.id]: e.target.checked
                          ? policy.version
                          : null,
                      })
                    }
                    style={{
                      marginTop: 5,
                    }}
                  />

                  أوافق على هذه السياسة وإصدارها الحالي.
                </label>
              )}
            </section>
          ))}
        </div>

        <button
          onClick={acceptPolicies}
          disabled={saving || !allAccepted()}
          style={{
            width: "100%",
            marginTop: 20,
            border: "none",
            borderRadius: 14,
            padding: 16,
            background:
              saving || !allAccepted()
                ? "#aaa"
                : "#111",
            color: "#fff",
            fontSize: 17,
            fontWeight: "bold",
            cursor:
              saving || !allAccepted()
                ? "default"
                : "pointer",
          }}
        >
          {saving
            ? "جاري حفظ الموافقة..."
            : "الموافقة والمتابعة"}
        </button>
      </div>
    </main>
  );
}
