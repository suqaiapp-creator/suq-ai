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
        supabase.from("profiles").select("id", { count: "exact", head: true }),

        supabase.from("shops").select("id", { count: "exact", head: true }),

        supabase.from("products").select("id", { count: "exact", head: true }),

        supabase
          .from("marketing_contents")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("ad_images")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .or("verification_status.eq.locked,safety_status.eq.locked"),

        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .or(
            "verification_status.eq.review,safety_status.eq.review"
          ),

        supabase
          .from("ai_usage")
          .select("id", { count: "exact", head: true }),
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
            <div style={{ fontSize: 13, opacity: 0.7 }}>
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
            }}
          >
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
        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            border: "1px solid #e8e8e8",
          }}
        >
          <div style={{ fontSize: 13, color: "#777" }}>
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

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
            marginBottom: 25,
          }}
        >
          <StatCard title="المستخدمون" value={stats.users} icon="👥" />
          <StatCard title="المحلات" value={stats.shops} icon="🏪" />
          <StatCard title="المنتجات" value={stats.products} icon="📦" />
          <StatCard title="التسويق" value={stats.marketing} icon="📣" />
          <StatCard title="التصاميم" value={stats.designs} icon="🎨" />
          <StatCard title="عمليات AI" value={stats.ai} icon="🤖" />
          <StatCard title="مراجعة" value={stats.review} icon="⚠️" />
          <StatCard title="مقفلة" value={stats.locked} icon="🔒" />
        </section>

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
            />

            <AdminCard
              icon="🏪"
              title="المحلات"
              description="عرض وإدارة جميع المحلات"
            />

            <AdminCard
              icon="📦"
              title="المنتجات"
              description="مراجعة المنتجات وحالات التحقق"
            />

            <AdminCard
              icon="🔒"
              title="المراجعة والمخالفات"
              description="المنتجات التي تحتاج مراجعة أو قفل"
            />

            <AdminCard
              icon="🤖"
              title="استخدام الذكاء الاصطناعي"
              description="العمليات والتكلفة والاستهلاك"
            />

            <AdminCard
              icon="📋"
              title="سجل النشاط"
              description="متابعة عمليات المستخدمين والإدارة"
            />

            <AdminCard
              icon="⚖️"
              title="السياسات القانونية"
              description="الشروط والخصوصية وسياسات المحتوى"
            />

            <AdminCard
              icon="⚙️"
              title="إعدادات النظام"
              description="إعدادات سوق AI والإدارة"
            />
          </div>
        </section>

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
            <Link href="/dashboard" style={linkStyle}>
              لوحة المحل
            </Link>

            <Link href="/products" style={linkStyle}>
              المنتجات
            </Link>

            <Link href="/designs" style={linkStyle}>
              التصاميم
            </Link>

            <Link href="/setup-shop" style={linkStyle}>
              بيانات المحل
            </Link>
          </div>
        </section>

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
          <strong>ملاحظة:</strong> لوحة Super Admin أصبحت مرتبطة
          ببيانات النظام الحقيقية. سنضيف لاحقًا صفحات الإدارة التفصيلية
          للمستخدمين والمحلات والمنتجات والمراجعة وسجل النشاط.
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8e8e8",
        borderRadius: 18,
        padding: 18,
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
  );
}

function AdminCard({ icon, title, description }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8e8e8",
        borderRadius: 18,
        padding: 20,
        minHeight: 125,
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
