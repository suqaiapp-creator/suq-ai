"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function AdminPoliciesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [policies, setPolicies] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    policy_type: "terms",
    version: "1.0",
    title: "شروط الاستخدام",
    content: "",
    is_active: false,
  });

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setUser(user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_super_admin) {
      router.replace("/dashboard");
      return;
    }

    await loadPolicies();

    setLoading(false);
  }

  async function loadPolicies() {
    const { data, error } = await supabase
      .from("legal_policies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر تحميل السياسات");
      return;
    }

    setPolicies(data || []);
  }

  function startEdit(policy) {
    setEditingId(policy.id);

    setForm({
      policy_type: policy.policy_type || "terms",
      version: policy.version || "1.0",
      title: policy.title || "",
      content: policy.content || "",
      is_active: policy.is_active || false,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function startNew() {
    setEditingId(null);

    setForm({
      policy_type: "terms",
      version: "1.0",
      title: "شروط الاستخدام",
      content: "",
      is_active: false,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function savePolicy(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      alert("اكتب عنوان السياسة");
      return;
    }

    if (!form.version.trim()) {
      alert("اكتب رقم الإصدار");
      return;
    }

    if (!form.content.trim()) {
      alert("اكتب محتوى السياسة");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("legal_policies")
          .update({
            policy_type: form.policy_type,
            version: form.version.trim(),
            title: form.title.trim(),
            content: form.content.trim(),
            is_active: form.is_active,
          })
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        alert("تم تحديث السياسة بنجاح");
      } else {
        const { error } = await supabase
          .from("legal_policies")
          .insert({
            policy_type: form.policy_type,
            version: form.version.trim(),
            title: form.title.trim(),
            content: form.content.trim(),
            is_active: false,
          });

        if (error) {
          throw error;
        }

        alert("تم إنشاء السياسة بنجاح");
      }

      await loadPolicies();
      startNew();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ السياسة");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(policy) {
    if (!policy.is_active) {
      const confirmActive = window.confirm(
        `هل تريد تفعيل "${policy.title}"؟\n\nيفضل تفعيل السياسة بعد التأكد من أن النص قانوني ومعتمد.`
      );

      if (!confirmActive) {
        return;
      }
    }

    const { error } = await supabase
      .from("legal_policies")
      .update({
        is_active: !policy.is_active,
      })
      .eq("id", policy.id);

    if (error) {
      alert("تعذر تغيير حالة السياسة");
      return;
    }

    await loadPolicies();
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          padding: "30px 16px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          جاري تحميل السياسات...
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
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#111",
            color: "#fff",
            borderRadius: 20,
            padding: "22px 20px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 14,
              opacity: 0.7,
              marginBottom: 5,
            }}
          >
            سوق AI
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
            }}
          >
            إدارة السياسات القانونية
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.85,
              lineHeight: 1.7,
            }}
          >
            إدارة نسخ شروط الاستخدام وسياسة الخصوصية وسياسة المحتوى
            واستخدام الذكاء الاصطناعي.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 20,
          }}
        >
          <section
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 5px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0 }}>
                {editingId ? "تعديل السياسة" : "إضافة سياسة جديدة"}
              </h2>

              {editingId && (
                <button
                  type="button"
                  onClick={startNew}
                  style={{
                    border: "1px solid #ddd",
                    background: "#fff",
                    borderRadius: 10,
                    padding: "9px 13px",
                    cursor: "pointer",
                  }}
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <form onSubmit={savePolicy}>
              <label style={{ display: "block", marginBottom: 8 }}>
                نوع السياسة
              </label>

              <select
                value={form.policy_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    policy_type: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: 13,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  marginBottom: 15,
                  fontSize: 16,
                }}
              >
                <option value="terms">شروط الاستخدام</option>
                <option value="privacy">سياسة الخصوصية</option>
                <option value="content">
                  سياسة المحتوى والمنتجات الممنوعة
                </option>
                <option value="ai">
                  سياسة استخدام الذكاء الاصطناعي
                </option>
              </select>

              <label style={{ display: "block", marginBottom: 8 }}>
                رقم الإصدار
              </label>

              <input
                value={form.version}
                onChange={(e) =>
                  setForm({
                    ...form,
                    version: e.target.value,
                  })
                }
                placeholder="مثال: 1.0"
                style={{
                  width: "100%",
                  padding: 13,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  marginBottom: 15,
                  fontSize: 16,
                  boxSizing: "border-box",
                }}
              />

              <label style={{ display: "block", marginBottom: 8 }}>
                العنوان
              </label>

              <input
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
                placeholder="عنوان السياسة"
                style={{
                  width: "100%",
                  padding: 13,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  marginBottom: 15,
                  fontSize: 16,
                  boxSizing: "border-box",
                }}
              />

              <label style={{ display: "block", marginBottom: 8 }}>
                محتوى السياسة
              </label>

              <textarea
                value={form.content}
                onChange={(e) =>
                  setForm({
                    ...form,
                    content: e.target.value,
                  })
                }
                placeholder="ضع النص القانوني هنا..."
                rows={12}
                style={{
                  width: "100%",
                  padding: 13,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  marginBottom: 15,
                  fontSize: 16,
                  resize: "vertical",
                  boxSizing: "border-box",
                  lineHeight: 1.8,
                }}
              />

              {editingId && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 15,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        is_active: e.target.checked,
                      })
                    }
                  />

                  تفعيل هذه السياسة
                </label>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 12,
                  padding: 14,
                  background: saving ? "#999" : "#111",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: "bold",
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving
                  ? "جاري الحفظ..."
                  : editingId
                  ? "حفظ التعديلات"
                  : "إضافة السياسة"}
              </button>
            </form>
          </section>

          <section
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 5px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                gap: 10,
              }}
            >
              <h2 style={{ margin: 0 }}>
                السياسات الحالية
              </h2>

              <button
                onClick={startNew}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                + سياسة جديدة
              </button>
            </div>

            {policies.length === 0 ? (
              <div
                style={{
                  padding: 25,
                  textAlign: "center",
                  color: "#777",
                }}
              >
                لا توجد سياسات.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {policies.map((policy) => (
                  <div
                    key={policy.id}
                    style={{
                      border: "1px solid #e5e5e5",
                      borderRadius: 15,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 15,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: 18,
                            marginBottom: 7,
                          }}
                        >
                          {policy.title}
                        </div>

                        <div
                          style={{
                            color: "#777",
                            fontSize: 14,
                            lineHeight: 1.7,
                          }}
                        >
                          النوع: {policy.policy_type}
                          <br />
                          الإصدار: {policy.version}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 20,
                          background: policy.is_active
                            ? "#e8f7ed"
                            : "#f1f1f1",
                          color: policy.is_active
                            ? "#18743b"
                            : "#777",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {policy.is_active
                          ? "مفعّلة"
                          : "غير مفعّلة"}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: "#fafafa",
                        borderRadius: 10,
                        color: "#555",
                        fontSize: 14,
                        lineHeight: 1.8,
                        maxHeight: 100,
                        overflow: "hidden",
                      }}
                    >
                      {policy.content}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 14,
                      }}
                    >
                      <button
                        onClick={() => startEdit(policy)}
                        style={{
                          border: "1px solid #ddd",
                          background: "#fff",
                          borderRadius: 9,
                          padding: "9px 13px",
                          cursor: "pointer",
                        }}
                      >
                        تعديل
                      </button>

                      <button
                        onClick={() => toggleActive(policy)}
                        style={{
                          border: "none",
                          background: policy.is_active
                            ? "#eee"
                            : "#111",
                          color: policy.is_active
                            ? "#111"
                            : "#fff",
                          borderRadius: 9,
                          padding: "9px 13px",
                          cursor: "pointer",
                        }}
                      >
                        {policy.is_active
                          ? "إيقاف التفعيل"
                          : "تفعيل"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div
          style={{
            marginTop: 20,
            background: "#fff8e6",
            border: "1px solid #f0d98c",
            borderRadius: 15,
            padding: 16,
            lineHeight: 1.8,
            color: "#6b5200",
          }}
        >
          <strong>تنبيه:</strong> لا تفعّل أي سياسة قانونية قبل مراجعة
          النص واعتماده قانونيًا. النظام هنا فقط لإدارة النسخ
          والتفعيل وقبول المستخدمين.
        </div>

        <button
          onClick={() => router.push("/admin")}
          style={{
            marginTop: 18,
            width: "100%",
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 12,
            padding: 13,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          العودة إلى لوحة Super Admin
        </button>
      </div>
    </main>
  );
}
