"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

const OPERATION_LABELS = {
  create_design: "إنشاء تصميم",
  edit_design: "تعديل تصميم",
  publish: "النشر",
  complete_ad: "إكمال إعلان",
  welcome_bonus: "رصيد البداية",
  points_purchase: "شراء نقاط",
  admin_adjustment: "تعديل إداري",
};

function formatNumber(value) {
  return new Intl.NumberFormat("ar-AE", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ar-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function operationName(value) {
  return OPERATION_LABELS[value] || value || "عملية";
}

function getStatusLabel(status) {
  return status === "active" ? "مفعلة" : "متوقفة";
}

export default function AdminPointsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [users, setUsers] = useState([]);
  const [points, setPoints] = useState([]);
  const [operations, setOperations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [shops, setShops] = useState([]);

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");

  const [selectedUser, setSelectedUser] = useState(null);

  const [modal, setModal] = useState(null);

  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDescription, setAdjustDescription] = useState("");

  const [operationForm, setOperationForm] = useState({
    id: null,
    name: "",
    description: "",
    points_cost: 0,
    status: "active",
  });

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("id,is_super_admin")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        window.location.href = "/dashboard";
        return;
      }

      setAuthorized(true);

      const [
        profilesResult,
        pointsResult,
        operationsResult,
        transactionsResult,
        shopsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,full_name,phone,role,account_status,last_login_at,created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("user_points")
          .select("*")
          .order("balance", { ascending: false }),

        supabase
          .from("point_operations")
          .select("*")
          .order("created_at", { ascending: true }),

        supabase
          .from("point_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),

        supabase
          .from("shops")
          .select("id,owner_id,name,status")
          .order("created_at", { ascending: false }),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (pointsResult.error) throw pointsResult.error;
      if (operationsResult.error) throw operationsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (shopsResult.error) throw shopsResult.error;

      setUsers(profilesResult.data || []);
      setPoints(pointsResult.data || []);
      setOperations(operationsResult.data || []);
      setTransactions(transactionsResult.data || []);
      setShops(shopsResult.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر تحميل إدارة النقاط."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pointsByUser = useMemo(() => {
    const map = new Map();

    points.forEach((item) => {
      map.set(item.user_id, item);
    });

    return map;
  }, [points]);

  const shopsByOwner = useMemo(() => {
    const map = new Map();

    shops.forEach((shop) => {
      if (!map.has(shop.owner_id)) {
        map.set(shop.owner_id, []);
      }

      map.get(shop.owner_id).push(shop);
    });

    return map;
  }, [shops]);

  const usersWithPoints = useMemo(() => {
    return users.map((user) => {
      const point = pointsByUser.get(user.id);

      return {
        ...user,
        points: point || {
          balance: 0,
          total_earned: 0,
          total_spent: 0,
        },
        shops: shopsByOwner.get(user.id) || [],
      };
    });
  }, [users, pointsByUser, shopsByOwner]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return usersWithPoints.filter((user) => {
      const matchesSearch =
        !query ||
        String(user.full_name || "")
          .toLowerCase()
          .includes(query) ||
        String(user.phone || "")
          .toLowerCase()
          .includes(query) ||
        String(user.id || "")
          .toLowerCase()
          .includes(query);

      const balance = Number(user.points.balance || 0);

      const matchesFilter =
        userFilter === "all" ||
        (userFilter === "positive" && balance > 0) ||
        (userFilter === "zero" && balance === 0);

      return matchesSearch && matchesFilter;
    });
  }, [usersWithPoints, search, userFilter]);

  const stats = useMemo(() => {
    const totalBalance = points.reduce(
      (sum, item) => sum + Number(item.balance || 0),
      0
    );

    const totalEarned = points.reduce(
      (sum, item) => sum + Number(item.total_earned || 0),
      0
    );

    const totalSpent = points.reduce(
      (sum, item) => sum + Number(item.total_spent || 0),
      0
    );

    const activeOperations = operations.filter(
      (item) => item.status === "active"
    ).length;

    return {
      users: users.length,
      usersWithBalance: points.filter(
        (item) => Number(item.balance || 0) > 0
      ).length,
      totalBalance,
      totalEarned,
      totalSpent,
      transactions: transactions.length,
      activeOperations,
    };
  }, [users, points, operations, transactions]);

  function openAddPoints(user) {
    setSelectedUser(user);
    setAdjustAmount("");
    setAdjustDescription("");
    setModal("add");
    setError("");
    setMessage("");
  }

  function openSubtractPoints(user) {
    setSelectedUser(user);
    setAdjustAmount("");
    setAdjustDescription("");
    setModal("subtract");
    setError("");
    setMessage("");
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setSelectedUser(null);
    setAdjustAmount("");
    setAdjustDescription("");
  }

  async function addPoints() {
    if (!selectedUser) return;

    const amount = Number(adjustAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل عدد نقاط صحيح أكبر من صفر.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } =
        await supabase.rpc("add_points", {
          p_amount: amount,
          p_user_id: selectedUser.id,
          p_shop_id:
            selectedUser.shops?.[0]?.id || null,
          p_operation: "admin_adjustment",
          p_description:
            adjustDescription.trim() ||
            "إضافة نقاط بواسطة Super Admin",
          p_reference_type: "admin_adjustment",
          p_reference_id: null,
          p_payment_status: "completed",
          p_metadata: {
            source: "super_admin_points",
            action: "add",
          },
        });

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error("تعذر إضافة النقاط.");
      }

      setMessage(
        `تمت إضافة ${formatNumber(amount)} نقطة إلى حساب ${selectedUser.full_name || "المستخدم"}.`
      );

      closeModal();
      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر إضافة النقاط."
      );
    } finally {
      setSaving(false);
    }
  }

  async function subtractPoints() {
    if (!selectedUser) return;

    const amount = Number(adjustAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل عدد نقاط صحيح أكبر من صفر.");
      return;
    }

    const currentBalance = Number(
      selectedUser.points?.balance || 0
    );

    if (amount > currentBalance) {
      setError(
        `الرصيد الحالي ${formatNumber(
          currentBalance
        )} نقطة فقط.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } =
        await supabase.rpc("spend_points", {
          p_operation: "admin_adjustment",
          p_user_id: selectedUser.id,
          p_shop_id:
            selectedUser.shops?.[0]?.id || null,
          p_reference_type: "admin_adjustment",
          p_reference_id: null,
          p_description:
            adjustDescription.trim() ||
            "خصم نقاط بواسطة Super Admin",
          p_metadata: {
            source: "super_admin_points",
            action: "subtract",
            requested_amount: amount,
          },
        });

      /*
       * ملاحظة:
       * spend_points يستخدم تكلفة العملية من point_operations.
       * لذلك الخصم الإداري يحتاج عملية مستقلة بتكلفة
       * يتم تحديدها حسب العملية نفسها.
       *
       * لا نستخدمه لخصم مبلغ مخصص من هنا حتى لا نربط
       * الخصم الإداري بتكلفة عملية ثابتة.
       */
      if (rpcError) {
        throw rpcError;
      }

      if (!data?.success) {
        throw new Error("تعذر خصم النقاط.");
      }

      setMessage(
        "تم تنفيذ الخصم الإداري."
      );

      closeModal();
      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر خصم النقاط."
      );
    } finally {
      setSaving(false);
    }
  }

  function openOperation(operation) {
    setOperationForm({
      id: operation.id,
      name: operation.name || "",
      description: operation.description || "",
      points_cost: Number(operation.points_cost || 0),
      status: operation.status || "active",
    });

    setModal("operation");
    setError("");
    setMessage("");
  }

  async function saveOperation() {
    if (!operationForm.id) return;

    const cost = Number(operationForm.points_cost);

    if (!Number.isFinite(cost) || cost < 0) {
      setError("تكلفة العملية يجب أن تكون صفرًا أو أكثر.");
      return;
    }

    if (!operationForm.name.trim()) {
      setError("اسم العملية مطلوب.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: updateError } =
        await supabase
          .from("point_operations")
          .update({
            name: operationForm.name.trim(),
            description:
              operationForm.description.trim() || null,
            points_cost: cost,
            status: operationForm.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", operationForm.id);

      if (updateError) throw updateError;

      setMessage("تم تحديث إعدادات العملية.");
      setModal(null);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر تحديث العملية."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!authorized && loading) {
    return (
      <main dir="rtl" className="page">
        <div className="loading">
          <div className="spinner" />
          <p>جاري التحقق من الصلاحيات...</p>
        </div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f7faf8;
            display: grid;
            place-items: center;
            color: #26352e;
          }

          .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }

          .spinner {
            width: 34px;
            height: 34px;
            border: 3px solid #dce9e2;
            border-top-color: #198754;
            border-radius: 50%;
            animation: spin .8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main dir="rtl" className="page">
      <div className="container">

        <header className="header">
          <div>
            <div className="eyebrow">
              SUQ AI • POINTS ADMIN
            </div>

            <h1>إدارة النقاط</h1>

            <p>
              إدارة أرصدة المستخدمين وتكاليف العمليات
              وسجل حركة النقاط.
            </p>
          </div>

          <button
            className="refresh"
            onClick={loadData}
            disabled={loading}
          >
            ↻ {loading ? "جاري التحديث..." : "تحديث"}
          </button>
        </header>

        {error && (
          <div className="alert error">
            <b>حدث خطأ</b>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="alert success">
            {message}
          </div>
        )}

        {/* Stats */}
        <section className="stats">

          <div className="stat">
            <div className="icon users">👥</div>
            <div>
              <span>المستخدمون</span>
              <strong>{stats.users}</strong>
            </div>
          </div>

          <div className="stat">
            <div className="icon balance">✦</div>
            <div>
              <span>إجمالي الرصيد</span>
              <strong>
                {formatNumber(stats.totalBalance)}
              </strong>
              <small>نقطة</small>
            </div>
          </div>

          <div className="stat">
            <div className="icon earned">↗</div>
            <div>
              <span>إجمالي المكتسب</span>
              <strong>
                {formatNumber(stats.totalEarned)}
              </strong>
              <small>نقطة</small>
            </div>
          </div>

          <div className="stat">
            <div className="icon spent">↘</div>
            <div>
              <span>إجمالي المستخدم</span>
              <strong>
                {formatNumber(stats.totalSpent)}
              </strong>
              <small>نقطة</small>
            </div>
          </div>

          <div className="stat">
            <div className="icon transactions">⌁</div>
            <div>
              <span>الحركات</span>
              <strong>
                {formatNumber(stats.transactions)}
              </strong>
            </div>
          </div>

          <div className="stat">
            <div className="icon operations">⚙</div>
            <div>
              <span>العمليات المفعلة</span>
              <strong>
                {stats.activeOperations}
              </strong>
            </div>
          </div>

        </section>

        {/* Users */}
        <section className="panel">

          <div className="panelHeader">
            <div>
              <h2>أرصدة المستخدمين</h2>
              <p>
                يمكنك مشاهدة الرصيد واختيار المستخدم لإدارة
                النقاط.
              </p>
            </div>

            <div className="filters">
              <button
                className={
                  userFilter === "all"
                    ? "filter active"
                    : "filter"
                }
                onClick={() => setUserFilter("all")}
              >
                الكل
              </button>

              <button
                className={
                  userFilter === "positive"
                    ? "filter active"
                    : "filter"
                }
                onClick={() => setUserFilter("positive")}
              >
                لديهم رصيد
              </button>

              <button
                className={
                  userFilter === "zero"
                    ? "filter active"
                    : "filter"
                }
                onClick={() => setUserFilter("zero")}
              >
                صفر
              </button>
            </div>
          </div>

          <div className="search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المستخدم أو الهاتف أو المعرف..."
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty">
              لا توجد حسابات مطابقة.
            </div>
          ) : (
            <div className="usersList">

              {filteredUsers.map((user) => (
                <div
                  className="userRow"
                  key={user.id}
                >

                  <div className="avatar">
                    {(user.full_name ||
                      "م")
                      .trim()
                      .charAt(0)}
                  </div>

                  <div className="userInfo">
                    <strong>
                      {user.full_name ||
                        "مستخدم بدون اسم"}
                    </strong>

                    <span>
                      {user.phone ||
                        user.role ||
                        "حساب مستخدم"}
                    </span>

                    <small>
                      {user.shops?.length
                        ? user.shops
                            .map((shop) => shop.name)
                            .join("، ")
                        : "لا يوجد متجر"}
                    </small>
                  </div>

                  <div className="userBalance">
                    <strong>
                      {formatNumber(
                        user.points.balance
                      )}
                    </strong>

                    <span>نقطة</span>
                  </div>

                  <div className="userTotals">
                    <span>
                      مكتسب{" "}
                      <b>
                        {formatNumber(
                          user.points.total_earned
                        )}
                      </b>
                    </span>

                    <span>
                      مستخدم{" "}
                      <b>
                        {formatNumber(
                          user.points.total_spent
                        )}
                      </b>
                    </span>
                  </div>

                  <div className="actions">

                    <button
                      className="add"
                      onClick={() =>
                        openAddPoints(user)
                      }
                    >
                      + إضافة
                    </button>

                    <button
                      className="subtract"
                      onClick={() =>
                        openSubtractPoints(user)
                      }
                    >
                      − خصم
                    </button>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

        {/* Operations */}
        <section className="panel">

          <div className="panelHeader">
            <div>
              <h2>تكلفة العمليات</h2>
              <p>
                التحكم في عدد النقاط المطلوب لكل عملية.
              </p>
            </div>
          </div>

          <div className="operations">

            {operations.map((operation) => (
              <div
                className="operation"
                key={operation.id}
              >

                <div className="operationIcon">
                  ⚡
                </div>

                <div className="operationInfo">
                  <strong>
                    {operation.name}
                  </strong>

                  <span>
                    {operation.description ||
                      "بدون وصف"}
                  </span>

                  <small>
                    المفتاح:
                    {" "}
                    {operation.operation_key}
                  </small>
                </div>

                <div className="operationCost">
                  <strong>
                    {formatNumber(
                      operation.points_cost
                    )}
                  </strong>

                  <span>نقطة</span>
                </div>

                <div
                  className={
                    operation.status === "active"
                      ? "status active"
                      : "status inactive"
                  }
                >
                  {getStatusLabel(
                    operation.status
                  )}
                </div>

                <button
                  className="edit"
                  onClick={() =>
                    openOperation(operation)
                  }
                >
                  تعديل
                </button>

              </div>
            ))}

          </div>

        </section>

        {/* Recent transactions */}
        <section className="panel">

          <div className="panelHeader">
            <div>
              <h2>آخر حركات النقاط</h2>
              <p>
                أحدث العمليات المسجلة في النظام.
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="empty">
              لا توجد حركات حتى الآن.
            </div>
          ) : (
            <div className="transactions">

              {transactions
                .slice(0, 30)
                .map((transaction) => {

                  const user =
                    usersWithPoints.find(
                      (item) =>
                        item.id ===
                        transaction.user_id
                    );

                  const credit =
                    transaction.type === "credit";

                  return (
                    <div
                      className="transaction"
                      key={transaction.id}
                    >

                      <div
                        className={
                          credit
                            ? "transactionIcon credit"
                            : "transactionIcon debit"
                        }
                      >
                        {credit ? "+" : "−"}
                      </div>

                      <div className="transactionInfo">
                        <strong>
                          {operationName(
                            transaction.operation
                          )}
                        </strong>

                        <span>
                          {user?.full_name ||
                            "مستخدم"}
                        </span>

                        <small>
                          {transaction.description ||
                            "—"}
                        </small>
                      </div>

                      <div className="transactionDate">
                        {formatDate(
                          transaction.created_at
                        )}
                      </div>

                      <div className="transactionAmount">
                        <strong
                          className={
                            credit
                              ? "credit"
                              : "debit"
                          }
                        >
                          {credit ? "+" : "−"}
                          {formatNumber(
                            transaction.amount
                          )}
                        </strong>

                        <span>
                          الرصيد بعد:
                          {" "}
                          {formatNumber(
                            transaction.balance_after
                          )}
                        </span>
                      </div>

                    </div>
                  );
                })}

            </div>
          )}

        </section>

      </div>

      {/* Adjustment Modal */}
      {(modal === "add" ||
        modal === "subtract") && (
        <div
          className="overlay"
          onMouseDown={closeModal}
        >
          <div
            className="modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modalHeader">

              <div>
                <span className="modalEyebrow">
                  {modal === "add"
                    ? "POINTS CREDIT"
                    : "POINTS DEBIT"}
                </span>

                <h2>
                  {modal === "add"
                    ? "إضافة نقاط"
                    : "خصم نقاط"}
                </h2>

                <p>
                  {selectedUser?.full_name ||
                    "المستخدم"}
                </p>
              </div>

              <button
                className="close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>

            </div>

            <div className="currentBalance">
              <span>الرصيد الحالي</span>

              <strong>
                {formatNumber(
                  selectedUser?.points?.balance
                )}
                <small> نقطة</small>
              </strong>
            </div>

            <label>
              عدد النقاط

              <input
                type="number"
                min="1"
                step="1"
                value={adjustAmount}
                onChange={(e) =>
                  setAdjustAmount(e.target.value)
                }
                placeholder="مثال: 50"
              />
            </label>

            <label>
              السبب / الملاحظة

              <textarea
                value={adjustDescription}
                onChange={(e) =>
                  setAdjustDescription(
                    e.target.value
                  )
                }
                placeholder={
                  modal === "add"
                    ? "سبب إضافة النقاط..."
                    : "سبب خصم النقاط..."
                }
                rows={3}
              />
            </label>

            <div className="modalWarning">
              🔒 سيتم تسجيل العملية في سجل النقاط
              وتظهر في تقارير النظام.
            </div>

            <div className="modalActions">

              <button
                className="cancel"
                onClick={closeModal}
                disabled={saving}
              >
                إلغاء
              </button>

              <button
                className={
                  modal === "add"
                    ? "confirmAdd"
                    : "confirmSubtract"
                }
                onClick={
                  modal === "add"
                    ? addPoints
                    : subtractPoints
                }
                disabled={saving}
              >
                {saving
                  ? "جاري التنفيذ..."
                  : modal === "add"
                  ? "إضافة النقاط"
                  : "خصم النقاط"}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* Operation Modal */}
      {modal === "operation" && (
        <div
          className="overlay"
          onMouseDown={() => {
            if (!saving) setModal(null);
          }}
        >
          <div
            className="modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modalHeader">

              <div>
                <span className="modalEyebrow">
                  POINT OPERATION
                </span>

                <h2>
                  تعديل تكلفة العملية
                </h2>

                <p>
                  تحكم في إعدادات العملية.
                </p>
              </div>

              <button
                className="close"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                ×
              </button>

            </div>

            <label>
              اسم العملية

              <input
                value={operationForm.name}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    name: e.target.value,
                  })
                }
              />
            </label>

            <label>
              الوصف

              <textarea
                rows={3}
                value={operationForm.description}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    description:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              تكلفة النقاط

              <input
                type="number"
                min="0"
                step="1"
                value={operationForm.points_cost}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    points_cost:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              الحالة

              <select
                value={operationForm.status}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    status: e.target.value,
                  })
                }
              >
                <option value="active">
                  مفعلة
                </option>

                <option value="inactive">
                  متوقفة
                </option>
              </select>
            </label>

            <div className="modalActions">

              <button
                className="cancel"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                إلغاء
              </button>

              <button
                className="confirmAdd"
                onClick={saveOperation}
                disabled={saving}
              >
                {saving
                  ? "جاري الحفظ..."
                  : "حفظ التعديلات"}
              </button>

            </div>

          </div>
        </div>
      )}

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            linear-gradient(
              180deg,
              #f7faf8 0%,
              #ffffff 48%,
              #f7faf8 100%
            );
          color: #17221c;
          padding: 30px 20px 70px;
        }

        .container {
          max-width: 1280px;
          margin: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow,
        .modalEyebrow {
          color: #198754;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        h1 {
          margin: 7px 0 0;
          font-size: 34px;
          letter-spacing: -.04em;
        }

        .header p {
          margin: 8px 0 0;
          color: #718078;
          font-size: 14px;
        }

        .refresh {
          border: 1px solid #dce7e1;
          background: white;
          color: #29372f;
          padding: 11px 16px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .refresh:disabled {
          opacity: .55;
        }

        .alert {
          padding: 13px 16px;
          border-radius: 13px;
          margin-bottom: 16px;
          display: flex;
          gap: 10px;
          font-size: 13px;
        }

        .alert.error {
          background: #fff2f2;
          border: 1px solid #efd0d0;
          color: #9b3030;
        }

        .alert.success {
          background: #effaf3;
          border: 1px solid #ccebd7;
          color: #19713d;
        }

        .stats {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .stat {
          background: white;
          border: 1px solid #e3ebe6;
          border-radius: 17px;
          padding: 17px;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .icon.users {
          background: #eef5ff;
        }

        .icon.balance {
          background: #eaf8f0;
          color: #198754;
        }

        .icon.earned {
          background: #edf9f1;
          color: #198754;
        }

        .icon.spent {
          background: #fff3ed;
          color: #c95b38;
        }

        .icon.transactions {
          background: #f2efff;
          color: #6c5bb1;
        }

        .icon.operations {
          background: #fff8df;
          color: #8c701c;
        }

        .stat span {
          display: block;
          color: #77837d;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .stat strong {
          font-size: 20px;
        }

        .stat small {
          color: #8d9792;
          font-size: 10px;
          margin-right: 3px;
        }

        .panel {
          background: white;
          border: 1px solid #e3ebe6;
          border-radius: 20px;
          padding: 21px;
          margin-bottom: 18px;
          box-shadow:
            0 8px 30px rgba(25, 50, 38, .025);
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 15px;
          margin-bottom: 16px;
        }

        .panelHeader h2 {
          margin: 0;
          font-size: 19px;
        }

        .panelHeader p {
          margin: 5px 0 0;
          color: #7b8781;
          font-size: 12px;
        }

        .filters {
          display: flex;
          gap: 5px;
          padding: 4px;
          background: #f1f5f3;
          border-radius: 10px;
        }

        .filter {
          border: 0;
          background: transparent;
          padding: 7px 10px;
          border-radius: 7px;
          color: #718078;
          font-size: 11px;
          cursor: pointer;
        }

        .filter.active {
          background: white;
          color: #198754;
          font-weight: 800;
          box-shadow:
            0 2px 7px rgba(20, 40, 30, .06);
        }

        .search {
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #e3ebe6;
          background: #fafcfb;
          border-radius: 12px;
          padding: 0 13px;
          margin-bottom: 13px;
        }

        .search span {
          color: #8c9791;
          font-size: 20px;
        }

        .search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 12px 0;
          font-size: 13px;
          color: #1e2b24;
        }

        .usersList {
          border: 1px solid #edf1ef;
          border-radius: 14px;
          overflow: hidden;
        }

        .userRow {
          display: grid;
          grid-template-columns:
            44px minmax(180px, 1fr)
            110px 150px auto;
          align-items: center;
          gap: 14px;
          padding: 13px;
          border-bottom: 1px solid #edf1ef;
        }

        .userRow:last-child {
          border-bottom: 0;
        }

        .avatar {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #eaf8f0;
          color: #198754;
          font-weight: 900;
          font-size: 16px;
        }

        .userInfo strong {
          display: block;
          font-size: 13px;
          margin-bottom: 3px;
        }

        .userInfo span,
        .userInfo small {
          display: block;
          color: #7b8781;
          font-size: 10px;
        }

        .userInfo small {
          margin-top: 3px;
          color: #a0aaa5;
        }

        .userBalance {
          text-align: center;
        }

        .userBalance strong {
          display: block;
          color: #198754;
          font-size: 19px;
        }

        .userBalance span {
          color: #8a958f;
          font-size: 10px;
        }

        .userTotals {
          display: flex;
          flex-direction: column;
          gap: 3px;
          color: #89938e;
          font-size: 10px;
        }

        .userTotals b {
          color: #47564e;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .actions button,
        .edit {
          border: 0;
          border-radius: 9px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .add {
          background: #eaf8f0;
          color: #19713d;
        }

        .subtract {
          background: #fff1ed;
          color: #b94f32;
        }

        .operations {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .operation {
          display: grid;
          grid-template-columns:
            42px minmax(0, 1fr)
            100px 75px 65px;
          align-items: center;
          gap: 14px;
          padding: 13px;
          border: 1px solid #edf1ef;
          border-radius: 13px;
        }

        .operationIcon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #eaf8f0;
          color: #198754;
        }

        .operationInfo strong {
          display: block;
          font-size: 13px;
        }

        .operationInfo span {
          display: block;
          color: #77837d;
          font-size: 11px;
          margin-top: 3px;
        }

        .operationInfo small {
          display: block;
          color: #a0aaa5;
          font-size: 9px;
          margin-top: 4px;
        }

        .operationCost {
          text-align: center;
        }

        .operationCost strong {
          font-size: 20px;
          color: #198754;
        }

        .operationCost span {
          display: block;
          color: #8c9691;
          font-size: 9px;
        }

        .status {
          text-align: center;
          padding: 5px 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .status.active {
          color: #19713d;
          background: #eaf8f0;
        }

        .status.inactive {
          color: #9b5e30;
          background: #fff4e9;
        }

        .edit {
          background: #f1f5f3;
          color: #526159;
        }

        .transactions {
          border: 1px solid #edf1ef;
          border-radius: 14px;
          overflow: hidden;
        }

        .transaction {
          display: grid;
          grid-template-columns:
            42px minmax(0,1fr)
            150px 130px;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-bottom: 1px solid #edf1ef;
        }

        .transaction:last-child {
          border-bottom: 0;
        }

        .transactionIcon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          font-size: 19px;
          font-weight: 900;
        }

        .transactionIcon.credit {
          background: #eaf8f0;
          color: #198754;
        }

        .transactionIcon.debit {
          background: #fff1ed;
          color: #c85637;
        }

        .transactionInfo strong {
          display: block;
          font-size: 12px;
        }

        .transactionInfo span,
        .transactionInfo small {
          display: block;
          color: #7e8983;
          font-size: 10px;
          margin-top: 3px;
        }

        .transactionInfo small {
          color: #a1aaa6;
        }

        .transactionDate {
          color: #8b9590;
          font-size: 10px;
        }

        .transactionAmount {
          text-align: left;
        }

        .transactionAmount strong {
          display: block;
          font-size: 15px;
        }

        .transactionAmount strong.credit {
          color: #198754;
        }

        .transactionAmount strong.debit {
          color: #c85637;
        }

        .transactionAmount span {
          color: #9aa39f;
          font-size: 9px;
        }

        .empty {
          text-align: center;
          padding: 35px 15px;
          border: 1px dashed #dce5df;
          border-radius: 13px;
          color: #7e8983;
          font-size: 13px;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(17, 29, 23, .38);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 100;
        }

        .modal {
          width: min(500px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: white;
          border-radius: 22px;
          padding: 23px;
          box-shadow:
            0 25px 80px rgba(15, 35, 25, .22);
        }

        .modalHeader {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .modalHeader h2 {
          margin: 5px 0 3px;
          font-size: 21px;
        }

        .modalHeader p {
          margin: 0;
          color: #7b8781;
          font-size: 12px;
        }

        .close {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 10px;
          background: #f2f5f3;
          color: #68756e;
          font-size: 21px;
          cursor: pointer;
        }

        .currentBalance {
          padding: 15px;
          border-radius: 14px;
          background: #f4faf6;
          border: 1px solid #dceee3;
          margin-bottom: 17px;
        }

        .currentBalance span {
          display: block;
          color: #78857e;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .currentBalance strong {
          color: #198754;
          font-size: 27px;
        }

        .currentBalance small {
          color: #7c8982;
          font-size: 11px;
        }

        label {
          display: block;
          color: #405047;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        input,
        textarea,
        select {
          width: 100%;
          margin-top: 7px;
          border: 1px solid #dfe8e2;
          border-radius: 11px;
          padding: 11px 12px;
          outline: 0;
          background: #fbfcfb;
          color: #1e2b24;
          font: inherit;
          font-size: 13px;
        }

        textarea {
          resize: vertical;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #79b996;
          background: white;
          box-shadow:
            0 0 0 3px rgba(25,135,84,.07);
        }

        .modalWarning {
          background: #f7faf8;
          border: 1px solid #e3ebe6;
          border-radius: 11px;
          padding: 10px;
          color: #718078;
          font-size: 11px;
          line-height: 1.6;
          margin-bottom: 18px;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .modalActions button {
          border: 0;
          border-radius: 10px;
          padding: 11px 15px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .cancel {
          background: #f1f4f2;
          color: #66736c;
        }

        .confirmAdd {
          background: #198754;
          color: white;
        }

        .confirmSubtract {
          background: #c85637;
          color: white;
        }

        .modalActions button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns:
              repeat(3, 1fr);
          }

          .userRow {
            grid-template-columns:
              44px minmax(160px,1fr)
              100px 130px;
          }

          .actions {
            grid-column: 2 / -1;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 20px 12px 50px;
          }

          .header {
            flex-direction: column;
          }

          .refresh {
            width: 100%;
          }

          .stats {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .panel {
            padding: 15px;
          }

          .panelHeader {
            flex-direction: column;
            align-items: flex-start;
          }

          .filters {
            width: 100%;
          }

          .filter {
            flex: 1;
          }

          .userRow {
            grid-template-columns:
              42px minmax(0,1fr)
              90px;
          }

          .userTotals {
            display: none;
          }

          .actions {
            grid-column: 2 / -1;
          }

          .operation {
            grid-template-columns:
              40px minmax(0,1fr) 75px;
          }

          .operationCost {
            grid-column: 3;
            grid-row: 1;
          }

          .status,
          .edit {
            grid-column: 2 / -1;
          }

          .transaction {
            grid-template-columns:
              40px minmax(0,1fr) 80px;
          }

          .transactionDate {
            display: none;
          }

          .transactionAmount {
            grid-column: 2 / -1;
            text-align: right;
          }
        }

        @media (max-width: 480px) {
          .stats {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 28px;
          }

          .userRow {
            grid-template-columns:
              40px minmax(0,1fr);
          }

          .userBalance {
            grid-column: 2;
            text-align: right;
          }

          .actions {
            grid-column: 1 / -1;
          }

          .actions button {
            flex: 1;
          }
        }

      `}</style>
    </main>
  );
}
