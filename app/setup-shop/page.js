"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function SetupShopPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    whatsapp: "",
    email: "",
    instagram: "",
    tiktok: "",
    snapchat: "",
    website: "",
    address: "",
    emirate: "",
    working_hours: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadShop();
  }, []);

  async function loadShop() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data: shop, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopError) {
        console.error(shopError);
        setError("تعذر تحميل بيانات المحل.");
        return;
      }

      if (shop) {
        setForm({
          name: shop.name || "",
          description: shop.description || "",
          phone: shop.phone || "",
          whatsapp: shop.whatsapp || "",
          email: shop.email || user.email || "",
          instagram: shop.instagram || "",
          tiktok: shop.tiktok || "",
          snapchat: shop.snapchat || "",
          website: shop.website || "",
          address: shop.address || "",
          emirate: shop.emirate || "",
          working_hours: shop.working_hours || "",
        });
      } else {
        setForm((current) => ({
          ...current,
          email: user.email || "",
        }));
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveShop(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!form.name.trim()) {
      setError("اكتب اسم المحل.");
      return;
    }

    if (!userId) {
      setError("لم يتم التعرف على الحساب.");
      return;
    }

    setSaving(true);

    try {
      const shopData = {
        owner_id: userId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        instagram: form.instagram.trim() || null,
        tiktok: form.tiktok.trim() || null,
        snapchat: form.snapchat.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        emirate: form.emirate.trim() || null,
        country: "United Arab Emirates",
        currency: "AED",
        working_hours: form.working_hours.trim() || null,
        status: "active",
        updated_at: new Date().toISOString(),
      };

      const { data: existingShop, error: existingError } =
        await supabase
          .from("shops")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();

      if (existingError) {
        console.error(existingError);
        setError("تعذر التحقق من بيانات المحل.");
        setSaving(false);
        return;
      }

      if (existingShop) {
        const { error: updateError } = await supabase
          .from("shops")
          .update(shopData)
          .eq("id", existingShop.id)
          .eq("owner_id", userId);

        if (updateError) {
          console.error(updateError);
          setError("تعذر تحديث بيانات المحل.");
          setSaving(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("shops")
          .insert(shopData);

        if (insertError) {
          console.error(insertError);
          setError("تعذر إنشاء بيانات المحل.");
          setSaving(false);
          return;
        }
      }

      setMessage("تم حفظ بيانات المحل بنجاح.");

      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حفظ البيانات.");
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
          background: "#f7f8fa",
          fontFamily: "Arial, sans-serif",
          color: "#374151",
        }}
      >
        جاري تحميل بيانات المحل...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "28px",
            boxShadow: "0 10px 35px rgba(0,0,0,0.07)",
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <div style={{ fontSize: "40px", marginBottom: "8px" }}>
              🏪
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                color: "#111827",
              }}
            >
              بيانات المحل
            </h1>

            <p
              style={{
                color: "#6b7280",
                lineHeight: "1.8",
                marginBottom: 0,
              }}
            >
              هذه البيانات ستكون مرتبطة بحسابك وتستخدم تلقائياً في
              المنتجات والتصاميم والمحتوى التسويقي.
            </p>
          </div>

          <form onSubmit={saveShop}>
            <SectionTitle title="المعلومات الأساسية" />

            <label style={labelStyle}>اسم المحل *</label>

            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="مثال: عطور سلطان"
              style={inputStyle}
            />

            <label style={labelStyle}>وصف المحل</label>

            <textarea
              value={form.description}
              onChange={(e) =>
                updateField("description", e.target.value)
              }
              placeholder="نبذة مختصرة عن المحل ونشاطه..."
              rows={4}
              style={textareaStyle}
            />

            <SectionTitle title="بيانات التواصل" />

            <label style={labelStyle}>رقم الهاتف</label>

            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="05xxxxxxxx"
              style={inputStyle}
            />

            <label style={labelStyle}>واتساب</label>

            <input
              type="tel"
              value={form.whatsapp}
              onChange={(e) =>
                updateField("whatsapp", e.target.value)
              }
              placeholder="05xxxxxxxx"
              style={inputStyle}
            />

            <label style={labelStyle}>البريد الإلكتروني</label>

            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="shop@example.com"
              style={inputStyle}
            />

            <SectionTitle title="الحسابات والمواقع" />

            <label style={labelStyle}>Instagram</label>

            <input
              value={form.instagram}
              onChange={(e) =>
                updateField("instagram", e.target.value)
              }
              placeholder="@username أو رابط الحساب"
              style={inputStyle}
            />

            <label style={labelStyle}>TikTok</label>

            <input
              value={form.tiktok}
              onChange={(e) => updateField("tiktok", e.target.value)}
              placeholder="@username أو رابط الحساب"
              style={inputStyle}
            />

            <label style={labelStyle}>Snapchat</label>

            <input
              value={form.snapchat}
              onChange={(e) =>
                updateField("snapchat", e.target.value)
              }
              placeholder="@username أو رابط الحساب"
              style={inputStyle}
            />

            <label style={labelStyle}>الموقع الإلكتروني</label>

            <input
              value={form.website}
              onChange={(e) =>
                updateField("website", e.target.value)
              }
              placeholder="https://example.com"
              style={inputStyle}
            />

            <SectionTitle title="الموقع وساعات العمل" />

            <label style={labelStyle}>الإمارة</label>

            <select
              value={form.emirate}
              onChange={(e) =>
                updateField("emirate", e.target.value)
              }
              style={inputStyle}
            >
              <option value="">اختر الإمارة</option>
              <option value="أبوظبي">أبوظبي</option>
              <option value="دبي">دبي</option>
              <option value="الشارقة">الشارقة</option>
              <option value="عجمان">عجمان</option>
              <option value="أم القيوين">أم القيوين</option>
              <option value="رأس الخيمة">رأس الخيمة</option>
              <option value="الفجيرة">الفجيرة</option>
            </select>

            <label style={labelStyle}>العنوان</label>

            <textarea
              value={form.address}
              onChange={(e) =>
                updateField("address", e.target.value)
              }
              placeholder="عنوان المحل..."
              rows={3}
              style={textareaStyle}
            />

            <label style={labelStyle}>ساعات العمل</label>

            <input
              value={form.working_hours}
              onChange={(e) =>
                updateField("working_hours", e.target.value)
              }
              placeholder="مثال: يومياً 10 صباحاً - 10 مساءً"
              style={inputStyle}
            />

            {error && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "13px",
                  borderRadius: "12px",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  lineHeight: "1.7",
                }}
              >
                {error}
              </div>
            )}

            {message && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "13px",
                  borderRadius: "12px",
                  background: "#ecfdf5",
                  color: "#047857",
                  lineHeight: "1.7",
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                marginTop: "24px",
                padding: "16px",
                border: "none",
                borderRadius: "14px",
                background: saving ? "#9ca3af" : "#111827",
                color: "#ffffff",
                fontSize: "17px",
                fontWeight: "bold",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "جاري الحفظ..." : "حفظ بيانات المحل"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ title }) {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "6px",
        paddingBottom: "8px",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "18px",
          color: "#111827",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginTop: "18px",
  marginBottom: "8px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "#374151",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "#ffffff",
  fontSize: "16px",
  outline: "none",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  lineHeight: "1.7",
};
