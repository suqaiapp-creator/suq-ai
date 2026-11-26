"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [actionUserId, setActionUserId] = useState(null);

  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
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

      setCurrentUserId(user.id);

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

      const { data, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) {
        throw usersError;
      }

      const profiles = data || [];

      const usersWithShops = await Promise.all(
        profiles.map(async (profile) => {
          const { data: shop } = await supabase
            .from("shops")
            .select("id, name, status")
            .eq("owner_id", profile.id)
            .maybeSingle();

          let productCount = 0;

          if (shop?.id) {
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
            ...profile,
            shop,
            productCount,
          };
        })
      );

      setUsers(usersWithShops);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل المستخدمين.");
    } finally {
      setLoading(false);
    }
  }

  async function changeAccountStatus(targetUser, newStatus) {
    if (!targetUser?.id) return;

    if (targetUser.id === currentUserId) {
      alert("لا يمكنك تغيير حالة حساب Super Admin الحالي.");
      return;
    }

    let reason = null;

    if (newStatus === "suspended") {
      reason = window.prompt(
        "اكتب سبب إيقاف الحساب:"
      );

      if (reason === null) {
        return;
      }

      reason = reason.trim();

      if (!reason) {
        alert("يجب كتابة سبب الإيقاف.");
        return;
      }
    }

    if (newStatus === "blocked") {
      reason = window.prompt(
        "اكتب سبب حظر الحساب:"
      );

      if (reason === null) {
        return;
      }

      reason = reason.trim();

      if (!reason) {
        alert("يجب كتابة سبب الحظر.");
        return;
      }
    }

    if (newStatus === "active") {
      const confirmed = window.confirm(
        `هل تريد إعادة تفعيل حساب "${targetUser.full_name || "هذا المستخدم"}"؟`
      );

      if (!confirmed) {
        return;
      }
    }

    if (newStatus === "suspended") {
      const confirmed = window.confirm(
        `هل تريد إيقاف حساب "${targetUser.full_name || "هذا المستخدم"}"؟`
      );

      if (!confirmed) {
        return;
      }
    }

    if (newStatus === "blocked") {
      const confirmed = window.confirm(
        `هل تريد حظر حساب "${targetUser.full_name || "هذا المستخدم"}"؟`
      );

      if (!confirmed) {
        return;
      }
    }

    setActionUserId(targetUser.id);
    setError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "set_account_status",
        {
          p_user_id: targetUser.id,
          p_status: newStatus,
          p_reason: reason,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      const {
        data: { user: adminUser },
      } = await supabase.auth.getUser();

      const actionText =
        newStatus === "active"
          ? "تفعيل حساب مستخدم"
          : newStatus === "suspended"
          ? "إيقاف حساب مستخدم"
          : "حظر حساب مستخدم";

      await supabase.from("activity_logs").insert({
        user_id: targetUser.id,
        action: "account_status_changed",
        entity_type: "profile",
        entity_id: targetUser.id,
        description: actionText,
        metadata: {
          actor_id: adminUser?.id || null,
          target_user_id: targetUser.id,
          target_user_name: targetUser.full_name || null,
          status: newStatus,
          reason: reason || null,
        },
      });

      await loadUsers();

      alert(
        newStatus === "active"
          ? "تم تفعيل الحساب بنجاح."
          : newStatus === "suspended"
          ? "تم إيقاف الحساب بنجاح."
          : "تم حظر الحساب بنجاح."
      );
    } catch (err) {
      console.error(err);

      const message =
        err?.message ||
        err?.error_description ||
        "تعذر تغيير حالة الحساب.";

      setError(message);
      alert("تعذر تغيير حالة الحساب.");
    } finally {
      setActionUserId(null);
    }
  }

  const filteredUsers = users.filter((user) => {
    const text = search.trim().toLowerCase();

    if (!text) return true;

    return (
      (user.full_name || "").toLowerCase().includes(text) ||
      (user.role || "").toLowerCase().includes(text) ||
      (user.account_status || "").toLowerCase().includes(text) ||
      (user.shop?.name || "").toLowerCase().includes(text)
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
          جاري تحميل المستخدمين...
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
              إدارة المستخدمين
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
            المستخدمون
          </h2>

          <p
            style={{
              margin: 0,
              color: "#777",
              fontSize: 14,
            }}
          >
            عرض وإدارة جميع الحسابات المسجلة في سوق AI.
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
              placeholder="بحث بالاسم أو المحل أو الحالة..."
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
              onClick={loadUsers}
              disabled={loading}
              style={{
                border: "none",
                background: "#111",
                color: "#fff",
                borderRadius: 12,
                padding: "13px 18px",
                fontSize: 14,
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
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
              إجمالي الحسابات: {users.length}
            </strong>

            <span
              style={{
                color: "#777",
                fontSize: 14,
              }}
            >
              الظاهر: {filteredUsers.length}
            </span>
          </div>

          {filteredUsers.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#777",
              }}
            >
              لا يوجد مستخدمون مطابقون للبحث.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 1150,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#fafafa",
                    }}
                  >
                    <th style={thStyle}>المستخدم</th>
                    <th style={thStyle}>المحل</th>
                    <th style={thStyle}>الدور</th>
                    <th style={thStyle}>الحالة</th>
                    <th style={thStyle}>تفاصيل الحالة</th>
                    <th style={thStyle}>المنتجات</th>
                    <th style={thStyle}>تاريخ التسجيل</th>
                    <th style={thStyle}>الإدارة</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const isCurrentAdmin =
                      user.id === currentUserId;

                    const status =
                      user.account_status || "active";

                    const isActionLoading =
                      actionUserId === user.id;

                    return (
                      <tr key={user.id}>
                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: "bold",
                            }}
                          >
                            {user.full_name || "بدون اسم"}
                          </div>

                          <div
                            style={{
                              color: "#888",
                              fontSize: 12,
                              marginTop: 4,
                              direction: "ltr",
                              textAlign: "right",
                            }}
                          >
                            {user.id}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          {user.shop?.name || "لم ينشئ محل"}
                        </td>

                        <td style={tdStyle}>
                          <StatusBadge
                            text={
                              user.is_super_admin
                                ? "Super Admin"
                                : user.role || "owner"
                            }
                            type={
                              user.is_super_admin
                                ? "admin"
                                : "default"
                            }
                          />
                        </td>

                        <td style={tdStyle}>
                          <AccountStatusBadge
                            status={status}
                          />
                        </td>

                        <td style={tdStyle}>
                          {status === "active" ? (
                            <span
                              style={{
                                color: "#777",
                                fontSize: 13,
                              }}
                            >
                              لا توجد ملاحظات
                            </span>
                          ) : (
                            <div>
                              {user.suspension_reason && (
                                <div
                                  style={{
                                    color: "#555",
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    maxWidth: 230,
                                  }}
                                >
                                  <strong>السبب:</strong>{" "}
                                  {user.suspension_reason}
                                </div>
                              )}

                              {user.suspended_at && (
                                <div
                                  style={{
                                    color: "#888",
                                    fontSize: 12,
                                    marginTop: 5,
                                  }}
                                >
                                  {status === "blocked"
                                    ? "تاريخ الحظر: "
                                    : "تاريخ الإيقاف: "}
                                  {formatDateTime(
                                    user.suspended_at
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {user.productCount}
                        </td>

                        <td style={tdStyle}>
                          {formatDate(user.created_at)}
                        </td>

                        <td style={tdStyle}>
                          {isCurrentAdmin ? (
                            <span
                              style={{
                                display: "inline-block",
                                background: "#f1f1f1",
                                color: "#777",
                                padding: "7px 10px",
                                borderRadius: 9,
                                fontSize: 12,
                              }}
                            >
                              حسابك الحالي
                            </span>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                gap: 7,
                                flexWrap: "wrap",
                                minWidth: 240,
                              }}
                            >
                              {status !== "active" && (
                                <button
                                  onClick={() =>
                                    changeAccountStatus(
                                      user,
                                      "active"
                                    )
                                  }
                                  disabled={isActionLoading}
                                  style={actionButtonStyle(
                                    "#277227"
                                  )}
                                >
                                  {isActionLoading
                                    ? "..."
                                    : "تفعيل"}
                                </button>
                              )}

                              {status !== "suspended" && (
                                <button
                                  onClick={() =>
                                    changeAccountStatus(
                                      user,
                                      "suspended"
                                    )
                                  }
                                  disabled={isActionLoading}
                                  style={actionButtonStyle(
                                    "#9a6700"
                                  )}
                                >
                                  {isActionLoading
                                    ? "..."
                                    : "إيقاف"}
                                </button>
                              )}

                              {status !== "blocked" && (
                                <button
                                  onClick={() =>
                                    changeAccountStatus(
                                      user,
                                      "blocked"
                                    )
                                  }
                                  disabled={isActionLoading}
                                  style={actionButtonStyle(
                                    "#a51d1d"
                                  )}
                                >
                                  {isActionLoading
                                    ? "..."
                                    : "حظر"}
                                </button>
                              )}
                            </div>
                          )}
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

function StatusBadge({
  text,
  type = "default",
}) {
  const styles = {
    admin: {
      background: "#eee8ff",
      color: "#5b35a8",
    },
    default: {
      background: "#eef2f7",
      color: "#45515f",
    },
  };

  const current = styles[type] || styles.default;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        background: current.background,
        color: current.color,
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      {text}
    </span>
  );
}

function AccountStatusBadge({ status }) {
  if (status === "blocked") {
    return (
      <StatusBadge
        text="محظور"
        type="blocked"
      />
    );
  }

  if (status === "suspended") {
    return (
      <StatusBadge
        text="موقوف"
        type="suspended"
      />
    );
  }

  return (
    <StatusBadge
      text="نشط"
      type="active"
    />
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

function formatDateTime(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("ar-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function actionButtonStyle(color) {
  return {
    border: `1px solid ${color}`,
    background: "#fff",
    color,
    borderRadius: 9,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: "bold",
    cursor: "pointer",
  };
}

const thStyle = {
  padding: "14px 16px",
  textAlign: "right",
  fontSize: 13,
  color: "#555",
  borderBottom: "1px solid #eee",
};

const tdStyle = {
  padding: "15px 16px",
  textAlign: "right",
  fontSize: 14,
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};
