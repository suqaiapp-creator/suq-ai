"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    locked: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      const { data: currentShop, error: shopError } =
        await supabase
          .from("shops")
          .select("*")
          .eq("owner_id", currentUser.id)
          .maybeSingle();

      if (shopError) {
        console.error(shopError);
      }

      if (!currentShop) {
        router.replace("/setup-shop");
        return;
      }

      setShop(currentShop);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

      if (productError) {
        console.error(productError);
        setProducts([]);
        setStats({
          total: 0,
          completed: 0,
          pending: 0,
          locked: 0,
        });
        return;
      }

      const list = productData || [];

      setProducts(list.slice(0, 5));

      const completed = list.filter(
        (product) => product.ai_status === "completed"
      ).length;

      const locked = list.filter(
        (product) =>
          product.verification_status === "locked" ||
          product.safety_status === "locked"
      ).length;

      setStats({
        total: list.length,
        completed,
        pending: list.length - completed,
        locked,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f7f8fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          color: "#374151",
        }}
      >
        جاري تحميل لوحة التحكم...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        fontFamily: "Arial, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "#111827",
              }}
            >
              سوق AI
            </div>

            <div
              style={{
                marginTop: "3px",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              لوحة التحكم
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#374151",
              borderRadius: "10px",
              padding: "9px 14px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "24px 20px",
        }}
      >
        {/* Welcome */}
        <section
          style={{
            background: "#111827",
            color: "#ffffff",
            borderRadius: "22px",
            padding: "26px",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              opacity: 0.75,
              marginBottom: "7px",
            }}
          >
            أهلاً بك 👋
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            {shop?.name || "متجرك"}
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#d1d5db",
              lineHeight: "1.7",
            }}
          >
            من هنا تدير منتجاتك وتسويقك وتصاميمك بالذكاء الاصطناعي.
          </p>

          {user?.email && (
            <div
              style={{
                marginTop: "12px",
                fontSize: "13px",
                color: "#9ca3af",
              }}
            >
              {user.email}
            </div>
          )}
        </section>

        {/* Stats */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          <StatCard
            icon="📦"
            title="إجمالي المنتجات"
            value={stats.total}
          />

          <StatCard
            icon="✅"
            title="منتجات مكتملة"
            value={stats.completed}
          />

          <StatCard
            icon="⏳"
            title="تحتاج معالجة"
            value={stats.pending}
          />

          <StatCard
            icon="🔒"
            title="منتجات مقفلة"
            value={stats.locked}
          />
        </section>

        {/* Actions */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "22px",
            marginBottom: "24px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: "20px",
              color: "#111827",
            }}
          >
            ماذا تريد أن تفعل؟
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
            }}
          >
            <ActionLink
              href="/add-product"
              icon="➕"
              title="إضافة منتج"
              description="أضف منتجاً جديداً"
            />

            <ActionLink
              href="/products"
              icon="📦"
              title="إدارة المنتجات"
              description="عرض وتعديل منتجاتك"
            />

            <ActionLink
              href="/designs"
              icon="🎨"
              title="تصاميم الإعلانات"
              description="إنشاء تصاميم تسويقية"
            />

            <ActionLink
              href="/setup-shop"
              icon="🏪"
              title="بيانات المحل"
              description="تعديل معلومات متجرك"
            />
          </div>
        </section>

        {/* Latest products */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "22px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                color: "#111827",
              }}
            >
              آخر المنتجات
            </h2>

            <Link
              href="/products"
              style={{
                color: "#374151",
                fontSize: "14px",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              عرض الكل
            </Link>
          </div>

          {products.length === 0 ? (
            <div
              style={{
                padding: "30px 10px",
                textAlign: "center",
                color: "#6b7280",
                lineHeight: "1.8",
              }}
            >
              لا توجد منتجات حتى الآن.
              <br />
              ابدأ بإضافة أول منتج لمتجرك.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "16px",
                  }}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name || "منتج"}
                      style={{
                        width: "68px",
                        height: "68px",
                        objectFit: "cover",
                        borderRadius: "12px",
                        background: "#f3f4f6",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "68px",
                        height: "68px",
                        borderRadius: "12px",
                        background: "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "25px",
                      }}
                    >
                      📦
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#111827",
                        marginBottom: "5px",
                      }}
                    >
                      {product.name || "منتج بدون اسم"}
                    </div>

                    {product.brand && (
                      <div
                        style={{
                          color: "#6b7280",
                          fontSize: "13px",
                        }}
                      >
                        {product.brand}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "12px",
                        color:
                          product.ai_status === "completed"
                            ? "#047857"
                            : "#b45309",
                      }}
                    >
                      {product.ai_status === "completed"
                        ? "✓ مكتمل"
                        : "⏳ يحتاج معالجة"}
                    </div>
                  </div>

                  <Link
                    href={`/marketing/${product.id}`}
                    style={{
                      textDecoration: "none",
                      background: "#111827",
                      color: "#ffffff",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    🚀 سوّق
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "20px",
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ fontSize: "26px", marginBottom: "10px" }}>
        {icon}
      </div>

      <div
        style={{
          color: "#6b7280",
          fontSize: "14px",
          marginBottom: "5px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ActionLink({ href, icon, title, description }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "16px",
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: "25px", marginBottom: "8px" }}>
        {icon}
      </div>

      <div
        style={{
          fontWeight: "bold",
          color: "#111827",
          marginBottom: "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "13px",
          color: "#6b7280",
        }}
      >
        {description}
      </div>
    </Link>
  );
}
