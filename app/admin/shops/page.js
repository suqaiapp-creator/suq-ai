"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminShopsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        router.replace("/dashboard");
        return;
      }

      if (
        profile.is_super_admin !== true &&
        profile.role !== "super_admin"
      ) {
        router.replace("/dashboard");
        return;
      }

      const { data: shopsData, error: shopsError } = await supabase
        .from("shops")
        .select("*")
        .order("created_at", { ascending: false });

      if (shopsError) {
        throw shopsError;
      }

      const shopList = shopsData || [];

      const shopsWithDetails = await Promise.all(
        shopList.map(async (shop) => {
          const { data: owner } = await supabase
            .from("profiles")
            .select(
              "id, full_name, role, account_status, suspension_reason"
            )
            .eq("id", shop.owner_id)
            .maybeSingle();

          let productCount = 0;

          if (shop.id) {
            const { count } = await supabase
              .from("products")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("shop_id", shop.id);

            productCount = count || 0;
          }

          return {
            ...shop,
            owner,
            productCount,
          };
        })
      );

      setShops(shopsWithDetails);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل المحلات.");
    } finally {
      setLoading(false);
    }
  }

  const filteredShops = shops.filter((shop) => {
    const text = search.trim().toLowerCase();

    if (!text) return true;

    return (
      (shop.name || "").toLowerCase().includes(text) ||
      (shop.owner?.full_name || "").toLowerCase().includes(text) ||
      (shop.emirate || "").toLowerCase().includes(text) ||
      (shop.country || "").toLowerCase().includes(text) ||
      (shop.status || "").toLowerCase().includes(text) ||
      (shop.phone || "").toLowerCase().includes(text) ||
      (shop.whatsapp || "").toLowerCase().includes(text) ||
      (shop.email || "").toLowerCase().includes(text) ||
      (shop.website || "").toLowerCase().includes(text)
    );
  });

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
            maxWidth: 1200,
            margin: "80px auto",
            background: "#fff",
            borderRadius: 20,
            padding: 40,
            textAlign: "center",
          }}
        >
          جاري تحميل المحلات...
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
              إدارة المحلات
            </h1>
          </div>

          <Link
            href="/admin"
            style={{
              color: "#fff",
              textDecoration: "none",
              border: "1px solid #555",
              borderRadius: 10,
              padding: "9px 14px",
              fontSize: 14,
            }}
          >
            ← لوحة الإدارة
          </Link>
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
            border: "1px solid #e8e8e8",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: 22,
            }}
          >
            جميع المحلات
          </h2>

          <p
            style={{
              margin: 0,
              color: "#777",
              fontSize: 14,
            }}
          >
            إدارة ومتابعة المحلات المسجلة في سوق AI.
          </p>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم المحل أو المالك أو الحالة..."
              style={{
                flex: 1,
                minWidth: 220,
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: "13px 14px",
                fontSize: 15,
                outline: "none",
              }}
            />

            <button
              onClick={loadShops}
              style={{
                border: "none",
                background: "#111",
                color: "#fff",
                borderRadius: 12,
                padding: "13px 18px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              تحديث
            </button>
          </div>
        </section>

        {error && (
          <section
            style={{
              background: "#fff0f0",
              border: "1px solid #f0bcbc",
              color: "#9b1c1c",
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
            }}
          >
            {error}
          </section>
        )}

        <section
          style={{
            background: "#fff",
            borderRadius: 20,
            border: "1px solid #e8e8e8",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 20,
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <strong>
              إجمالي المحلات: {shops.length}
            </strong>

            <span
              style={{
                color: "#777",
                fontSize: 14,
              }}
            >
              الظاهر: {filteredShops.length}
            </span>
          </div>

          {filteredShops.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#777",
              }}
            >
              لا توجد محلات مطابقة للبحث.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 1250,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#fafafa",
                    }}
                  >
                    <th style={thStyle}>المحل</th>
                    <th style={thStyle}>المالك</th>
                    <th style={thStyle}>حالة المالك</th>
                    <th style={thStyle}>التواصل</th>
                    <th style={thStyle}>الموقع</th>
                    <th style={thStyle}>المنتجات</th>
                    <th style={thStyle}>حالة المحل</th>
                    <th style={thStyle}>تاريخ الإنشاء</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredShops.map((shop) => {
                    const ownerStatus =
                      shop.owner?.account_status || "active";

                    return (
                      <tr key={shop.id}>
                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: "bold",
                              fontSize: 15,
                            }}
                          >
                            {shop.name || "بدون اسم"}
                          </div>

                          <div
                            style={{
                              color: "#999",
                              fontSize: 11,
                              marginTop: 5,
                              direction: "ltr",
                              textAlign: "right",
                            }}
                          >
                            {shop.id}
                          </div>

                          {shop.description && (
                            <div
                              style={{
                                color: "#888",
                                fontSize: 12,
                                marginTop: 7,
                                lineHeight: 1.5,
                                maxWidth: 240,
                              }}
                            >
                              {shop.description.length > 100
                                ? shop.description.slice(0, 100) + "..."
                                : shop.description}
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: "bold",
                            }}
                          >
                            {shop.owner?.full_name ||
                              "غير معروف"}
                          </div>

                          <div
                            style={{
                              color: "#888",
                              fontSize: 12,
                              marginTop: 5,
                            }}
                          >
                            {shop.owner?.role || "owner"}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <AccountStatusBadge
                            status={ownerStatus}
                          />

                          {ownerStatus !== "active" &&
                            shop.owner?.suspension_reason && (
                              <div
                                style={{
                                  marginTop: 7,
                                  color: "#888",
                                  fontSize: 12,
                                  maxWidth: 190,
                                  lineHeight: 1.5,
                                }}
                              >
                                السبب:{" "}
                                {shop.owner.suspension_reason}
                              </div>
                            )}
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              lineHeight: 1.7,
                            }}
                          >
                            {shop.phone && (
                              <div>
                                📞 {shop.phone}
                              </div>
                            )}

                            {shop.whatsapp && (
                              <div>
                                💬 {shop.whatsapp}
                              </div>
                            )}

                            {shop.email && (
                              <div
                                style={{
                                  direction: "ltr",
                                  textAlign: "right",
                                  fontSize: 12,
                                  color: "#777",
                                }}
                              >
                                {shop.email}
                              </div>
                            )}

                            {!shop.phone &&
                              !shop.whatsapp &&
                              !shop.email && (
                                <span
                                  style={{
                                    color: "#999",
                                  }}
                                >
                                  لا توجد بيانات
                                </span>
                              )}
                          </div>

                          {(shop.website ||
                            shop.instagram ||
                            shop.tiktok ||
                            shop.snapchat) && (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "#777",
                              }}
                            >
                              الشبكات والروابط متوفرة
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: "bold",
                            }}
                          >
                            {shop.emirate || "-"}
                          </div>

                          <div
                            style={{
                              color: "#888",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            {shop.country ||
                              "United Arab Emirates"}
                          </div>

                          {shop.address && (
                            <div
                              style={{
                                color: "#888",
                                fontSize: 12,
                                marginTop: 5,
                                maxWidth: 180,
                              }}
                            >
                              {shop.address}
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <strong
                            style={{
                              fontSize: 17,
                            }}
                          >
                            {shop.productCount}
                          </strong>

                          <div
                            style={{
                              color: "#888",
                              fontSize: 12,
                              marginTop: 3,
                            }}
                          >
                            منتج
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <ShopStatusBadge
                            status={shop.status}
                          />
                        </td>

                        <td style={tdStyle}>
                          {formatDate(shop.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AccountStatusBadge({ status }) {
  if (status === "blocked") {
    return (
      <StatusBadge
        text="محظور"
        background="#ffe8e8"
        color="#a51d1d"
      />
    );
  }

  if (status === "suspended") {
    return (
      <StatusBadge
        text="موقوف"
        background="#fff4d8"
        color="#956600"
      />
    );
  }

  return (
    <StatusBadge
      text="نشط"
      background="#eef7ee"
      color="#277227"
    />
  );
}

function ShopStatusBadge({ status }) {
  if (status === "suspended") {
    return (
      <StatusBadge
        text="موقوف"
        background="#fff4d8"
        color="#956600"
      />
    );
  }

  if (status === "blocked") {
    return (
      <StatusBadge
        text="محظور"
        background="#ffe8e8"
        color="#a51d1d"
      />
    );
  }

  if (status === "pending") {
    return (
      <StatusBadge
        text="قيد المراجعة"
        background="#eef2ff"
        color="#4056a1"
      />
    );
  }

  if (status === "inactive") {
    return (
      <StatusBadge
        text="غير نشط"
        background="#f0f0f0"
        color="#666"
      />
    );
  }

  return (
    <StatusBadge
      text="نشط"
      background="#eef7ee"
      color="#277227"
    />
  );
}

function StatusBadge({
  text,
  background,
  color,
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        background,
        color,
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      {text}
    </span>
  );
}

function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

const thStyle = {
  padding: "14px 16px",
  textAlign: "right",
  fontSize: 13,
  color: "#555",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "15px 16px",
  textAlign: "right",
  fontSize: 14,
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};
