"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [stats, setStats] = useState({
    users: 0,
    shops: 0,
    products: 0,
    marketing: 0,
    designs: 0,
    ai: 0,
    locked: 0,
    review: 0,
  });

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUser(user);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        router.replace("/dashboard");
        return;
      }

      if (
        profileData.is_super_admin !== true &&
        profileData.role !== "super_admin"
      ) {
        router.replace("/dashboard");
        return;
      }

      setProfile(profileData);

      const [
        usersResult,
        shopsResult,
        productsResult,
        marketingResult,
        designsResult,
        lockedResult,
        reviewResult,
        aiResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id", {
          count: "exact",
          head: true,
        }),

        supabase.from("shops").select("id", {
          count: "exact",
          head: true,
        }),

        supabase.from("products").select("id", {
          count: "exact",
          head: true,
        }),

        supabase.from("marketing_contents").select("id", {
          count: "exact",
          head: true,
        }),

        supabase.from("ad_images").select("id", {
          count: "exact",
          head: true,
        }),

        supabase
          .from("products")
          .select("id", {
            count: "exact",
            head: true,
          })
          .or("verification_status.eq.locked,safety_status.eq.locked"),

        supabase
          .from("products")
          .select("id", {
            count: "exact",
            head: true,
          })
          .or(
            "verification_status.eq.review,safety_status.eq.review"
          ),

        supabase.from("ai_usage").select("id", {
          count: "exact",
          head: true,
        }),
      ]);

      setStats({
        users: usersResult.count || 0,
        shops: shopsResult.count || 0,
        products: productsResult.count || 0,
        marketing: marketingResult.count || 0,
        designs: designsResult.count || 0,
        ai: aiResult.count || 0,
        locked: lockedResult.count || 0,
        review: reviewResult.count || 0,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f5f6f8",
          fontFamily: "Arial, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "80px auto",
            background: "#fff",
            borderRadius: 20,
            padding: 40,
            textAlign: "center",
          }}
        >
          جاري تحميل لوحة الإدارة...
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
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#111",
          color: "#fff",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              سوق AI
            </div>

            <h1
              style={{
                margin: "5px 0 0",
                fontSize: 25,
              }}
            >
              لوحة Super Admin
            </h1>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/"
              style={{
                background: "#fff",
                color: "#111",
                borderRadius: 10,
                padding: "9px 13px",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: "bold",
              }}
            >
              🏠 الصفحة الرئيسية
            </Link>

            <span
              style={{
                background: "#fff",
                color: "#111",
                borderRadius: 999,
                padding: "8px 13px",
                fontSize: 13,
                fontWeight: "bold",
              }}
            >
              Super Admin
            </span>

            <button
              onClick={logout}
              style={{
                border: "1px solid #555",
                background: "transparent",
                color: "#fff",
                borderRadius: 10,
                padding: "9px 13px",
                cursor: "pointer",
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "25px 18px 50px",
        }}
      >
        {/* Welcome */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            border: "1px solid #e8e8e8",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#777",
            }}
          >
            مرحبًا بك
          </div>

          <h2
            style={{
              margin: "6px 0",
              fontSize: 24,
            }}
          >
            {profile?.full_name || "Super Admin"}
          </h2>

          <div
            style={{
              color: "#666",
              fontSize: 14,
              direction: "ltr",
              textAlign: "right",
            }}
          >
            {user?.email}
          </div>
        </section>

        {/* Statistics */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
            marginBottom: 25,
          }}
        >
          <StatCard
            title="المستخدمون"
            value={stats.users}
            icon="👥"
            href="/admin/users"
          />

          <StatCard
            title="المحلات"
            value={stats.shops}
            icon="🏪"
            href="/admin/shops"
          />

          <StatCard
            title="المنتجات"
            value={stats.products}
            icon="📦"
            href="/admin/products"
          />

          <StatCard
            title="التسويق"
            value={stats.marketing}
            icon="📣"
            href="/dashboard"
          />

          <StatCard
            title="التصاميم"
            value={stats.designs}
            icon="🎨"
            href="/designs"
          />

          <StatCard
            title="عمليات AI"
            value={stats.ai}
            icon="🤖"
            href="/admin/ai-usage"
          />

          <StatCard
            title="مراجعة"
            value={stats.review}
            icon="⚠️"
            href="/admin/review"
          />

          <StatCard
            title="مقفلة"
            value={stats.locked}
            icon="🔒"
            href="/admin/review"
          />
        </section>

        {/* Administration */}
        <section>
          <h2
            style={{
              fontSize: 21,
              margin: "0 0 15px",
            }}
          >
            الإدارة
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 15,
            }}
          >
            <AdminCard
              icon="👥"
              title="المستخدمون"
              description="إدارة الحسابات وحالات المستخدمين"
              href="/admin/users"
            />

            <AdminCard
              icon="🏪"
              title="المحلات"
              description="عرض وإدارة جميع المحلات"
              href="/admin/shops"
            />

            <AdminCard
              icon="📦"
              title="المنتجات"
              description="مراجعة المنتجات وحالات التحقق"
              href="/admin/products"
            />

            <AdminCard
              icon="🔒"
              title="المراجعة والمخالفات"
              description="المنتجات التي تحتاج مراجعة أو قفل"
              href="/admin/review"
            />

            <AdminCard
              icon="🤖"
              title="استخدام الذكاء الاصطناعي"
              description="العمليات والتكلفة والاستهلاك"
              href="/admin/ai-usage"
            />

            <AdminCard
              icon="📋"
              title="سجل النشاط"
              description="متابعة عمليات المستخدمين والإدارة"
              href="/admin/activity"
            />

            <AdminCard
              icon="⚖️"
              title="السياسات القانونية"
              description="الشروط والخصوصية وسياسات المحتوى"
              href="/admin/policies"
            />

            <AdminCard
              icon="⚙️"
              title="إعدادات النظام"
              description="إعدادات سوق AI والإدارة"
              href="/admin/settings"
            />
          </div>
        </section>

        {/* Quick Links */}
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginTop: 25,
            border: "1px solid #e8e8e8",
          }}
        >
          <h2
            style={{
              fontSize: 20,
              marginTop: 0,
            }}
          >
            اختصارات
          </h2>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link href="/" style={linkStyle}>
              🏠 الصفحة الرئيسية
            </Link>

            <Link href="/dashboard" style={linkStyle}>
              لوحة المحل
            </Link>

            <Link href="/admin/users" style={linkStyle}>
              المستخدمون
            </Link>

            <Link href="/admin/shops" style={linkStyle}>
              المحلات
            </Link>

            <Link href="/admin/products" style={linkStyle}>
              المنتجات
            </Link>

            <Link href="/admin/review" style={linkStyle}>
              المراجعة
            </Link>

            <Link href="/admin/activity" style={linkStyle}>
              سجل النشاط
            </Link>

            <Link href="/admin/ai-usage" style={linkStyle}>
              استخدام AI
            </Link>

            <Link href="/admin/policies" style={linkStyle}>
              السياسات
            </Link>
          </div>
        </section>

        {/* System note */}
        <section
          style={{
            marginTop: 20,
            padding: 18,
            borderRadius: 16,
            background: "#fff8e6",
            border: "1px solid #f0dfad",
            color: "#6b571d",
            lineHeight: 1.8,
            fontSize: 14,
          }}
        >
          <strong>حالة النظام:</strong> لوحة Super Admin مرتبطة
          ببيانات النظام الحقيقية، ويمكن الوصول إلى أقسام الإدارة
          مباشرة من هذه الصفحة.
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon, href }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e8e8e8",
          borderRadius: 18,
          padding: 18,
          cursor: "pointer",
          transition: "0.2s",
          height: "100%",
        }}
      >
        <div style={{ fontSize: 26 }}>{icon}</div>

        <div
          style={{
            fontSize: 28,
            fontWeight: "bold",
            marginTop: 8,
          }}
        >
          {value}
        </div>

        <div
          style={{
            color: "#666",
            fontSize: 14,
            marginTop: 4,
          }}
        >
          {title}
        </div>
      </div>
    </Link>
  );
}

function AdminCard({ icon, title, description, href }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e8e8e8",
          borderRadius: 18,
          padding: 20,
          minHeight: 125,
          cursor: "pointer",
          transition: "0.2s",
        }}
      >
        <div style={{ fontSize: 28 }}>{icon}</div>

        <h3
          style={{
            margin: "10px 0 5px",
            fontSize: 17,
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: 0,
            color: "#777",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      </div>
    </Link>
  );
}

const linkStyle = {
  display: "inline-block",
  padding: "10px 15px",
  borderRadius: 10,
  background: "#111",
  color: "#fff",
  textDecoration: "none",
  fontSize: 14,
};
