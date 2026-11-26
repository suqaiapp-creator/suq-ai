"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function AdminUsersPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("يجب تسجيل الدخول أولاً.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        setError("هذه الصفحة مخصصة لـ Super Admin فقط.");
        return;
      }

      setAuthorized(true);

      const [usersResult, shopsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, phone, role, account_status, is_super_admin, last_login_at, created_at, updated_at, suspension_reason, suspended_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("shops")
          .select(
            "id, owner_id, name, status, emirate, country, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (shopsResult.error) throw shopsResult.error;

      setUsers(usersResult.data || []);
      setShops(shopsResult.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || "حدث خطأ أثناء تحميل المستخدمين.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const shopsByOwner = useMemo(() => {
    const map = {};

    for (const shop of shops) {
      if (!map[shop.owner_id]) {
        map[shop.owner_id] = [];
      }

      map[shop.owner_id].push(shop);
    }

    return map;
  }, [shops]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const userShops = shopsByOwner[user.id] || [];

      const searchText = [
        user.full_name,
        user.phone,
        user.role,
        ...userShops.map((shop) => shop.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchText.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        user.account_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, shopsByOwner, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(
        (item) => item.account_status === "active"
      ).length,
      suspended: users.filter(
        (item) => item.account_status === "suspended"
      ).length,
      blocked: users.filter(
        (item) => item.account_status === "blocked"
      ).length,
      admins: users.filter(
        (item) => item.is_super_admin
      ).length,
    };
  }, [users]);

  const formatDate = (date) => {
    if (!date) return "—";

    try {
      return new Date(date).toLocaleString("ar-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "—";
    }
  };

  const getStatusLabel = (status) => {
    if (status === "active") return "نشط";
    if (status === "suspended") return "موقوف";
    if (status === "blocked") return "محظور";
    return status || "غير محدد";
  };

  const getStatusStyle = (status) => {
    if (status === "active") {
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (status === "suspended") {
      return {
        background: "#fef3c7",
        color: "#92400e",
      };
    }

    if (status === "blocked") {
      return {
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    return {
      background: "#f1f5f9",
      color: "#475569",
    };
  };

  const changeStatus = async (userId, status) => {
    if (!userId || !status) return;

    const target = users.find((item) => item.id === userId);

    if (!target) return;

    if (target.is_super_admin) {
      setActionError(
        "لا يمكن تغيير حالة حساب Super Admin."
      );
      return;
    }

    let reason = null;

    if (status === "suspended" || status === "blocked") {
      reason =
        window.prompt(
          status === "blocked"
            ? "اكتب سبب حظر الحساب:"
            : "اكتب سبب إيقاف الحساب:"
        ) || "";

      if (!reason.trim()) {
        setActionError("يجب كتابة سبب الإجراء.");
        return;
      }
    }

    const confirmed = window.confirm(
      status === "active"
        ? "هل تريد إعادة تفعيل هذا الحساب؟"
        : status === "blocked"
        ? "هل أنت متأكد من حظر هذا الحساب؟"
        : "هل أنت متأكد من إيقاف هذا الحساب؟"
    );

    if (!confirmed) return;

    setActionLoading(true);
    setActionError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "set_account_status",
        {
          p_user_id: userId,
          p_status: status,
          p_reason: reason,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      await supabase.from("activity_logs").insert({
        user_id: userId,
        action:
          status === "active"
            ? "admin_activate_user"
            : status === "suspended"
            ? "admin_suspend_user"
            : "admin_block_user",
        entity_type: "user",
        entity_id: userId,
        description:
          status === "active"
            ? "تم تفعيل حساب المستخدم"
            : status === "suspended"
            ? "تم إيقاف حساب المستخدم"
            : "تم حظر حساب المستخدم",
        metadata: {
          reason: reason || null,
        },
      });

      setSelectedUser(null);

      await loadUsers();
    } catch (err) {
      console.error(err);
      setActionError(
        err?.message || "تعذر تنفيذ الإجراء."
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.loadingIcon}>⟳</div>
          <h2>جاري تحميل المستخدمين</h2>
          <p>يرجى الانتظار...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <div style={styles.denied}>
          <div style={styles.deniedIcon}>🔒</div>

          <h1>غير مصرح</h1>

          <p>
            {error ||
              "ليس لديك صلاحية الدخول لهذه الصفحة."}
          </p>

          <Link href="/admin" style={styles.primaryButton}>
            العودة إلى Super Admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              SUQ AI · USER MANAGEMENT
            </div>

            <h1 style={styles.title}>
              إدارة المستخدمين
            </h1>

            <p style={styles.subtitle}>
              إدارة الحسابات والحالات والصلاحيات من مكان واحد.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={loadUsers}
              style={styles.secondaryButton}
            >
              ↻ تحديث
            </button>

            <Link
              href="/admin"
              style={styles.primaryButton}
            >
              ← Super Admin
            </Link>
          </div>
        </header>

        {/* Stats */}
        <section style={styles.statsGrid}>
          <Stat
            icon="👥"
            title="إجمالي المستخدمين"
            value={stats.total}
          />

          <Stat
            icon="🟢"
            title="نشط"
            value={stats.active}
          />

          <Stat
            icon="🟡"
            title="موقوف"
            value={stats.suspended}
          />

          <Stat
            icon="🔴"
            title="محظور"
            value={stats.blocked}
          />

          <Stat
            icon="👑"
            title="Super Admin"
            value={stats.admins}
          />
        </section>

        {/* Filters */}
        <section style={styles.filterCard}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث بالاسم أو الهاتف أو اسم المتجر..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterButtons}>
            <FilterButton
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              label={`الكل (${stats.total})`}
            />

            <FilterButton
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
              label={`نشط (${stats.active})`}
            />

            <FilterButton
              active={statusFilter === "suspended"}
              onClick={() =>
                setStatusFilter("suspended")
              }
              label={`موقوف (${stats.suspended})`}
            />

            <FilterButton
              active={statusFilter === "blocked"}
              onClick={() => setStatusFilter("blocked")}
              label={`محظور (${stats.blocked})`}
            />
          </div>
        </section>

        {actionError && (
          <div style={styles.errorBox}>
            ⚠️ {actionError}

            <button
              onClick={() => setActionError("")}
              style={styles.errorClose}
            >
              ×
            </button>
          </div>
        )}

        {/* Users */}
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                الحسابات
              </h2>

              <p style={styles.sectionSubtitle}>
                عرض {filteredUsers.length} من أصل{" "}
                {users.length} مستخدم
              </p>
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>المستخدم</th>
                  <th style={styles.th}>المتجر</th>
                  <th style={styles.th}>الدور</th>
                  <th style={styles.th}>الحالة</th>
                  <th style={styles.th}>آخر دخول</th>
                  <th style={styles.th}>الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const userShops =
                    shopsByOwner[user.id] || [];

                  return (
                    <tr key={user.id}>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <div style={styles.avatar}>
                            {(user.full_name || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div style={styles.userName}>
                              {user.full_name ||
                                "بدون اسم"}
                            </div>

                            <div style={styles.muted}>
                              {user.phone ||
                                "لا يوجد رقم"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        {userShops.length > 0 ? (
                          <div>
                            <strong>
                              {userShops[0].name}
                            </strong>

                            {userShops.length > 1 && (
                              <div style={styles.muted}>
                                +{" "}
                                {userShops.length - 1} متجر
                                إضافي
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={styles.muted}>
                            لا يوجد متجر
                          </span>
                        )}
                      </td>

                      <td style={styles.td}>
                        {user.is_super_admin ? (
                          <span style={styles.adminBadge}>
                            👑 Super Admin
                          </span>
                        ) : (
                          <span>
                            {user.role || "owner"}
                          </span>
                        )}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...getStatusStyle(
                              user.account_status
                            ),
                          }}
                        >
                          {getStatusLabel(
                            user.account_status
                          )}
                        </span>
                      </td>

                      <td style={styles.td}>
                        {formatDate(
                          user.last_login_at
                        )}
                      </td>

                      <td style={styles.td}>
                        {user.is_super_admin ? (
                          <span style={styles.protected}>
                            🔐 محمي
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              setSelectedUser(user)
                            }
                            style={styles.manageButton}
                          >
                            إدارة
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={styles.empty}
                    >
                      لا توجد نتائج مطابقة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Selected user */}
        {selectedUser && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.eyebrow}>
                    USER CONTROL
                  </div>

                  <h2 style={styles.modalTitle}>
                    إدارة الحساب
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  style={styles.closeButton}
                >
                  ×
                </button>
              </div>

              <div style={styles.profileBox}>
                <div style={styles.bigAvatar}>
                  {(selectedUser.full_name || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <h3 style={styles.profileName}>
                    {selectedUser.full_name ||
                      "بدون اسم"}
                  </h3>

                  <div style={styles.muted}>
                    {selectedUser.phone ||
                      "لا يوجد رقم"}
                  </div>
                </div>
              </div>

              <div style={styles.infoGrid}>
                <Info
                  label="الدور"
                  value={
                    selectedUser.role || "owner"
                  }
                />

                <Info
                  label="الحالة"
                  value={getStatusLabel(
                    selectedUser.account_status
                  )}
                />

                <Info
                  label="تاريخ التسجيل"
                  value={formatDate(
                    selectedUser.created_at
                  )}
                />

                <Info
                  label="آخر دخول"
                  value={formatDate(
                    selectedUser.last_login_at
                  )}
                />
              </div>

              {selectedUser.suspension_reason && (
                <div style={styles.reasonBox}>
                  <strong>سبب الإجراء:</strong>

                  <div>
                    {selectedUser.suspension_reason}
                  </div>

                  {selectedUser.suspended_at && (
                    <small>
                      {formatDate(
                        selectedUser.suspended_at
                      )}
                    </small>
                  )}
                </div>
              )}

              <div style={styles.actionsTitle}>
                إجراءات الحساب
              </div>

              <div style={styles.actionGrid}>
                {selectedUser.account_status !==
                  "active" && (
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      changeStatus(
                        selectedUser.id,
                        "active"
                      )
                    }
                    style={styles.activateButton}
                  >
                    🟢 تفعيل الحساب
                  </button>
                )}

                {selectedUser.account_status !==
                  "suspended" && (
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      changeStatus(
                        selectedUser.id,
                        "suspended"
                      )
                    }
                    style={styles.suspendButton}
                  >
                    🟡 إيقاف الحساب
                  </button>
                )}

                {selectedUser.account_status !==
                  "blocked" && (
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      changeStatus(
                        selectedUser.id,
                        "blocked"
                      )
                    }
                    style={styles.blockButton}
                  >
                    🔴 حظر الحساب
                  </button>
                )}
              </div>

              <div style={styles.warning}>
                <strong>تنبيه:</strong>

                <span>
                  تغيير حالة الحساب إجراء إداري وسيتم
                  تسجيله في سجل النشاط.
                </span>
              </div>
            </div>
          </div>
        )}

        <footer style={styles.footer}>
          <Link href="/admin" style={styles.footerLink}>
            ← العودة إلى Super Admin
          </Link>

          <span>
            SUQ AI · User Management
          </span>
        </footer>
      </div>
    </main>
  );
}

function Stat({ icon, title, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statIcon}>{icon}</div>

      <div>
        <div style={styles.statTitle}>{title}</div>
        <div style={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.filterButton,
        ...(active
          ? styles.filterButtonActive
          : {}),
      }}
    >
      {label}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 42%, #ffffff 100%)",
    direction: "rtl",
    color: "#17211b",
    fontFamily: "Arial, Tahoma, sans-serif",
  },

  container: {
    maxWidth: "1450px",
    margin: "0 auto",
    padding: "28px 18px 60px",
  },

  loading: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },

  loadingIcon: {
    fontSize: "44px",
    color: "#16a34a",
    marginBottom: "12px",
  },

  denied: {
    maxWidth: "500px",
    margin: "100px auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "35px",
    textAlign: "center",
    boxShadow: "0 15px 50px rgba(0,0,0,0.08)",
  },

  deniedIcon: {
    fontSize: "52px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "25px",
  },

  eyebrow: {
    color: "#16a34a",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "1.4px",
    marginBottom: "7px",
    direction: "ltr",
  },

  title: {
    margin: 0,
    color: "#14532d",
    fontSize: "34px",
    fontWeight: "900",
  },

  subtitle: {
    color: "#64748b",
    margin: "9px 0 0",
    fontSize: "14px",
  },

  headerActions: {
    display: "flex",
    gap: "9px",
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#16a34a",
    color: "#ffffff",
    textDecoration: "none",
    padding: "11px 16px",
    borderRadius: "12px",
    fontWeight: "900",
  },

  secondaryButton: {
    border: "1px solid #bbf7d0",
    background: "#ffffff",
    color: "#166534",
    padding: "11px 16px",
    borderRadius: "12px",
    fontWeight: "900",
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },

  stat: {
    background: "#ffffff",
    border: "1px solid #dcfce7",
    borderRadius: "17px",
    padding: "17px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  statIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "13px",
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  statTitle: {
    color: "#64748b",
    fontSize: "12px",
  },

  statValue: {
    color: "#14532d",
    fontSize: "26px",
    fontWeight: "900",
    marginTop: "2px",
  },

  filterCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "15px",
    marginBottom: "18px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  searchWrap: {
    flex: 1,
    minWidth: "260px",
    position: "relative",
  },

  searchIcon: {
    position: "absolute",
    right: "13px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    fontSize: "20px",
  },

  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 40px 12px 13px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: "13px",
    direction: "rtl",
  },

  filterButtons: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
  },

  filterButton: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#475569",
    borderRadius: "10px",
    padding: "9px 12px",
    fontWeight: "800",
    cursor: "pointer",
    fontSize: "12px",
  },

  filterButtonActive: {
    background: "#16a34a",
    color: "#ffffff",
    borderColor: "#16a34a",
  },

  errorBox: {
    position: "relative",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: "13px",
    padding: "13px 42px 13px 13px",
    marginBottom: "18px",
  },

  errorClose: {
    position: "absolute",
    left: "10px",
    top: "7px",
    border: "none",
    background: "transparent",
    color: "#991b1b",
    fontSize: "22px",
    cursor: "pointer",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "16px",
  },

  sectionTitle: {
    margin: 0,
    color: "#14532d",
    fontSize: "20px",
    fontWeight: "900",
  },

  sectionSubtitle: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: "12px",
  },

  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
  },

  table: {
    width: "100%",
    minWidth: "920px",
    borderCollapse: "collapse",
  },

  th: {
    padding: "13px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "900",
    textAlign: "right",
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "14px 13px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
    verticalAlign: "middle",
  },

  userCell: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  avatar: {
    width: "38px",
    height: "38px",
    borderRadius: "11px",
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
  },

  userName: {
    fontWeight: "900",
    color: "#17211b",
  },

  muted: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "4px",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: "900",
  },

  adminBadge: {
    display: "inline-flex",
    padding: "6px 9px",
    borderRadius: "999px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: "11px",
    fontWeight: "900",
  },

  protected: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
  },

  manageButton: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    padding: "8px 13px",
    borderRadius: "10px",
    fontWeight: "900",
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    padding: "40px",
    color: "#94a3b8",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(15,23,42,0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
  },

  modal: {
    width: "100%",
    maxWidth: "620px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 30px 80px rgba(0,0,0,0.2)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },

  modalTitle: {
    margin: 0,
    color: "#14532d",
    fontSize: "24px",
    fontWeight: "900",
  },

  closeButton: {
    width: "38px",
    height: "38px",
    border: "none",
    borderRadius: "10px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: "25px",
    cursor: "pointer",
  },

  profileBox: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "#f8fff9",
    border: "1px solid #dcfce7",
    borderRadius: "17px",
    padding: "16px",
    marginBottom: "15px",
  },

  bigAvatar: {
    width: "55px",
    height: "55px",
    borderRadius: "16px",
    background: "#16a34a",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    fontWeight: "900",
  },

  profileName: {
    margin: 0,
    color: "#14532d",
    fontSize: "18px",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "15px",
  },

  infoItem: {
    background: "#f8fafc",
    borderRadius: "13px",
    padding: "12px",
  },

  infoLabel: {
    color: "#94a3b8",
    fontSize: "11px",
    marginBottom: "5px",
  },

  infoValue: {
    color: "#334155",
    fontWeight: "800",
    fontSize: "13px",
  },

  reasonBox: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    borderRadius: "13px",
    padding: "12px",
    marginBottom: "18px",
    fontSize: "13px",
    lineHeight: 1.7,
  },

  actionsTitle: {
    color: "#14532d",
    fontWeight: "900",
    marginBottom: "10px",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "9px",
  },

  activateButton: {
    border: "1px solid #bbf7d0",
    background: "#dcfce7",
    color: "#166534",
    padding: "12px",
    borderRadius: "11px",
    fontWeight: "900",
    cursor: "pointer",
  },

  suspendButton: {
    border: "1px solid #fde68a",
    background: "#fef3c7",
    color: "#92400e",
    padding: "12px",
    borderRadius: "11px",
    fontWeight: "900",
    cursor: "pointer",
  },

  blockButton: {
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px",
    borderRadius: "11px",
    fontWeight: "900",
    cursor: "pointer",
  },

  warning: {
    marginTop: "16px",
    padding: "12px",
    borderRadius: "12px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "11px",
    lineHeight: 1.7,
    display: "flex",
    gap: "6px",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    flexWrap: "wrap",
    padding: "18px 3px",
    color: "#94a3b8",
    fontSize: "12px",
  },

  footerLink: {
    color: "#16a34a",
    textDecoration: "none",
    fontWeight: "900",
  },
};
