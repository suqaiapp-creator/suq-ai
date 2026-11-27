"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function AdminPointsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [operations, setOperations] = useState([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [modal, setModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_super_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const [
        usersResult,
        transactionsResult,
        operationsResult,
        shopsResult,
      ] = await Promise.all([
        supabase
          .from("user_points")
          .select(
            "id, user_id, balance, total_earned, total_spent, created_at, updated_at"
          )
          .order("balance", { ascending: false }),

        supabase
          .from("point_transactions")
          .select(
            "id, user_id, shop_id, type, amount, balance_before, balance_after, operation, description, reference_type, reference_id, provider, payment_status, metadata, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("point_operations")
          .select(
            "id, operation_key, name, description, points_cost, status, created_at, updated_at"
          )
          .order("created_at", { ascending: true }),

        supabase
          .from("shops")
          .select("id, owner_id, name"),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (operationsResult.error) throw operationsResult.error;
      if (shopsResult.error) throw shopsResult.error;

      const userIds = (usersResult.data || []).map((item) => item.user_id);

      let profiles = [];

      if (userIds.length) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, role, account_status")
          .in("id", userIds);

        if (error) throw error;

        profiles = data || [];
      }

      const profileMap = Object.fromEntries(
        profiles.map((profile) => [profile.id, profile])
      );

      const shopMap = Object.fromEntries(
        (shopsResult.data || []).map((shop) => [shop.owner_id, shop])
      );

      const enrichedUsers = (usersResult.data || []).map((item) => ({
        ...item,
        profile: profileMap[item.user_id] || null,
        shop: shopMap[item.user_id] || null,
      }));

      setUsers(enrichedUsers);
      setTransactions(transactionsResult.data || []);
      setOperations(operationsResult.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تحميل بيانات النقاط");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAdjustment(user, action) {
    setSelectedUser(user);
    setModal(action);
    setAmount("");
    setDescription("");
    setMessage("");
    setError("");
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setSelectedUser(null);
    setAmount("");
    setDescription("");
  }

  async function adjustPoints() {
    if (!selectedUser || !modal) return;

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("أدخل عدد نقاط صحيح أكبر من صفر.");
      return;
    }

    if (modal === "subtract" && numericAmount > Number(selectedUser.balance)) {
      setError(
        `الرصيد غير كافٍ. الرصيد الحالي ${formatNumber(
          selectedUser.balance
        )} نقطة.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const shopId = selectedUser.shop?.id || null;

      const { data, error: rpcError } = await supabase.rpc(
        "admin_adjust_points",
        {
          p_user_id: selectedUser.user_id,
          p_amount: numericAmount,
          p_action: modal === "add" ? "add" : "subtract",
          p_shop_id: shopId,
          p_description:
            description.trim() ||
            (modal === "add"
              ? "إضافة نقاط بواسطة Super Admin"
              : "خصم نقاط بواسطة Super Admin"),
          p_metadata: {
            source: "super_admin_points_page",
            ui_action: modal,
          },
        }
      );

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error("لم يتم تنفيذ تعديل النقاط.");
      }

      setMessage(
        modal === "add"
          ? `تمت إضافة ${formatNumber(numericAmount)} نقطة بنجاح.`
          : `تم خصم ${formatNumber(numericAmount)} نقطة بنجاح.`
      );

      setModal(null);
      setSelectedUser(null);
      setAmount("");
      setDescription("");

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تعديل النقاط");
    } finally {
      setSaving(false);
    }
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("ar-AE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function getTransactionLabel(type) {
    if (type === "credit") return "إضافة";
    if (type === "debit") return "خصم";
    return type || "حركة";
  }

  function getTransactionClass(type) {
    return type === "credit" ? "credit" : "debit";
  }

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      user.profile?.full_name?.toLowerCase().includes(query) ||
      user.profile?.role?.toLowerCase().includes(query) ||
      user.shop?.name?.toLowerCase().includes(query) ||
      user.user_id?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (filter === "positive") return Number(user.balance) > 0;
    if (filter === "zero") return Number(user.balance) === 0;

    return true;
  });

  const totalBalance = users.reduce(
    (sum, user) => sum + Number(user.balance || 0),
    0
  );

  const totalEarned = users.reduce(
    (sum, user) => sum + Number(user.total_earned || 0),
    0
  );

  const totalSpent = users.reduce(
    (sum, user) => sum + Number(user.total_spent || 0),
    0
  );

  if (loading) {
    return (
      <main className="page">
        <div className="loading">جاري تحميل إدارة النقاط...</div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6f8f7;
            padding: 32px;
            direction: rtl;
            font-family: Arial, sans-serif;
          }

          .loading {
            max-width: 1200px;
            margin: 80px auto;
            text-align: center;
            color: #64748b;
            font-size: 18px;
          }
        `}</style>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="page">
        <div className="denied">
          <div className="deniedIcon">🔒</div>
          <h1>غير مصرح</h1>
          <p>هذه الصفحة متاحة للـ Super Admin فقط.</p>
        </div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6f8f7;
            padding: 32px;
            direction: rtl;
            font-family: Arial, sans-serif;
          }

          .denied {
            max-width: 500px;
            margin: 100px auto;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            padding: 40px;
            text-align: center;
          }

          .deniedIcon {
            font-size: 44px;
            margin-bottom: 15px;
          }

          h1 {
            margin: 0 0 10px;
            color: #0f172a;
          }

          p {
            margin: 0;
            color: #64748b;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div>
            <div className="eyebrow">SUQ AI • POINTS ADMIN</div>
            <h1>إدارة النقاط</h1>
            <p>
              إدارة أرصدة المستخدمين وتكاليف العمليات وسجل حركة النقاط.
            </p>
          </div>

          <button className="refresh" onClick={loadData} disabled={loading}>
            ↻ تحديث
          </button>
        </header>

        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}

        <section className="stats">
          <div className="stat">
            <div className="statIcon">👥</div>
            <div>
              <span>المستخدمون</span>
              <strong>{formatNumber(users.length)}</strong>
            </div>
          </div>

          <div className="stat">
            <div className="statIcon">✦</div>
            <div>
              <span>إجمالي الرصيد</span>
              <strong>{formatNumber(totalBalance)} نقطة</strong>
            </div>
          </div>

          <div className="stat">
            <div className="statIcon">↗</div>
            <div>
              <span>إجمالي المكتسب</span>
              <strong>{formatNumber(totalEarned)} نقطة</strong>
            </div>
          </div>

          <div className="stat">
            <div className="statIcon">↘</div>
            <div>
              <span>إجمالي المستخدم</span>
              <strong>{formatNumber(totalSpent)} نقطة</strong>
            </div>
          </div>

          <div className="stat">
            <div className="statIcon">⌁</div>
            <div>
              <span>الحركات</span>
              <strong>{formatNumber(transactions.length)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>المستخدمون</h2>
              <span>{filteredUsers.length} مستخدم</span>
            </div>

            <div className="filters">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث عن مستخدم أو متجر..."
              />

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">الكل</option>
                <option value="positive">لديه رصيد</option>
                <option value="zero">رصيده صفر</option>
              </select>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty">
              <div>✦</div>
              <h3>لا توجد بيانات</h3>
              <p>لم يتم العثور على مستخدمين مطابقين.</p>
            </div>
          ) : (
            <div className="users">
              {filteredUsers.map((user) => (
                <div className="userCard" key={user.id}>
                  <div className="userMain">
                    <div className="avatar">
                      {(user.profile?.full_name || "م").slice(0, 1)}
                    </div>

                    <div className="identity">
                      <h3>{user.profile?.full_name || "مستخدم"}</h3>

                      <div className="meta">
                        <span>
                          {user.profile?.role || "owner"}
                        </span>

                        {user.shop?.name && (
                          <>
                            <i>•</i>
                            <span>{user.shop.name}</span>
                          </>
                        )}
                      </div>

                      <small>{user.user_id}</small>
                    </div>
                  </div>

                  <div className="balance">
                    <span>الرصيد</span>
                    <strong>{formatNumber(user.balance)}</strong>
                    <em>نقطة</em>
                  </div>

                  <div className="totals">
                    <div>
                      <span>المكتسب</span>
                      <b>{formatNumber(user.total_earned)}</b>
                    </div>

                    <div>
                      <span>المستخدم</span>
                      <b>{formatNumber(user.total_spent)}</b>
                    </div>
                  </div>

                  <div className="actions">
                    <button
                      className="add"
                      onClick={() => openAdjustment(user, "add")}
                    >
                      + إضافة
                    </button>

                    <button
                      className="subtract"
                      onClick={() => openAdjustment(user, "subtract")}
                    >
                      − خصم
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>تكاليف العمليات</h2>
              <span>القيمة الحالية للعمليات</span>
            </div>
          </div>

          <div className="operations">
            {operations.map((operation) => (
              <div className="operation" key={operation.id}>
                <div>
                  <h3>{operation.name}</h3>
                  <p>{operation.description || "بدون وصف"}</p>
                </div>

                <div className="operationCost">
                  <strong>{formatNumber(operation.points_cost)}</strong>
                  <span>نقطة</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>آخر الحركات</h2>
              <span>سجل النقاط</span>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="empty small">
              <div>⌁</div>
              <p>لا توجد حركات حتى الآن.</p>
            </div>
          ) : (
            <div className="transactions">
              {transactions.slice(0, 30).map((transaction) => (
                <div className="transaction" key={transaction.id}>
                  <div
                    className={`transactionIcon ${getTransactionClass(
                      transaction.type
                    )}`}
                  >
                    {transaction.type === "credit" ? "↗" : "↘"}
                  </div>

                  <div className="transactionInfo">
                    <strong>
                      {transaction.description || "حركة نقاط"}
                    </strong>

                    <span>
                      {transaction.operation || "—"} •{" "}
                      {formatDate(transaction.created_at)}
                    </span>
                  </div>

                  <div
                    className={`transactionAmount ${getTransactionClass(
                      transaction.type
                    )}`}
                  >
                    {transaction.type === "credit" ? "+" : "-"}
                    {formatNumber(transaction.amount)}
                  </div>

                  <div className="transactionBalance">
                    <span>الرصيد بعد الحركة</span>
                    <strong>
                      {formatNumber(transaction.balance_after)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="security">
          <div className="securityIcon">🛡️</div>
          <div>
            <h3>حماية إدارة النقاط</h3>
            <p>
              جميع الإضافة والخصم الإداري تتم من خلال دالة آمنة على الخادم.
              لا يمكن تجاوز الرصيد إلى قيمة سالبة، ويتم تسجيل المسؤول والرصيد
              قبل وبعد كل تعديل.
            </p>
          </div>
        </section>
      </div>

      {modal && selectedUser && (
        <div className="overlay" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <span className="modalEyebrow">
                  {modal === "add" ? "POINT CREDIT" : "POINT DEBIT"}
                </span>

                <h2>
                  {modal === "add" ? "إضافة نقاط" : "خصم نقاط"}
                </h2>

                <p>
                  {selectedUser.profile?.full_name || "المستخدم"}
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
                {formatNumber(selectedUser.balance)} نقطة
              </strong>
            </div>

            <label>
              عدد النقاط
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: 10"
                disabled={saving}
                autoFocus
              />
            </label>

            <label>
              سبب العملية
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  modal === "add"
                    ? "مثال: تعويض للعميل"
                    : "مثال: تصحيح رصيد"
                }
                disabled={saving}
              />
            </label>

            {modal === "subtract" && (
              <div className="warning">
                ⚠️ لا يمكن خصم نقاط أكثر من الرصيد الحالي.
              </div>
            )}

            {error && <div className="modalError">{error}</div>}

            <div className="modalActions">
              <button
                className="cancel"
                onClick={closeModal}
                disabled={saving}
              >
                إلغاء
              </button>

              <button
                className={modal === "add" ? "confirmAdd" : "confirmSubtract"}
                onClick={adjustPoints}
                disabled={saving}
              >
                {saving
                  ? "جاري التنفيذ..."
                  : modal === "add"
                  ? "تأكيد الإضافة"
                  : "تأكيد الخصم"}
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
          background: #f6f8f7;
          color: #0f172a;
          direction: rtl;
          font-family:
            Arial,
            "Noto Sans Arabic",
            sans-serif;
          padding: 30px 20px 60px;
        }

        .container {
          max-width: 1380px;
          margin: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 25px;
        }

        .eyebrow,
        .modalEyebrow {
          color: #16a34a;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin-bottom: 7px;
        }

        h1 {
          margin: 0;
          font-size: 31px;
          letter-spacing: -0.5px;
        }

        .header p {
          color: #64748b;
          margin: 8px 0 0;
        }

        .refresh {
          border: 1px solid #dbe4df;
          background: white;
          color: #166534;
          border-radius: 12px;
          padding: 11px 17px;
          cursor: pointer;
          font-weight: 700;
        }

        .refresh:hover {
          background: #f0fdf4;
        }

        .success,
        .error {
          padding: 13px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-weight: 700;
        }

        .success {
          background: #ecfdf3;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .statIcon {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          background: #ecfdf3;
          color: #16a34a;
          display: grid;
          place-items: center;
          font-size: 19px;
        }

        .stat span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .stat strong {
          font-size: 19px;
        }

        .panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 22px;
          margin-bottom: 20px;
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panelHeader h2 {
          margin: 0 0 4px;
          font-size: 19px;
        }

        .panelHeader span {
          color: #64748b;
          font-size: 12px;
        }

        .filters {
          display: flex;
          gap: 9px;
        }

        .filters input,
        .filters select {
          border: 1px solid #dbe4df;
          background: #fafdfb;
          border-radius: 11px;
          padding: 10px 12px;
          outline: none;
        }

        .filters input {
          width: 260px;
        }

        .users {
          display: grid;
          gap: 11px;
        }

        .userCard {
          display: grid;
          grid-template-columns: minmax(260px, 1.4fr) 150px 220px 180px;
          align-items: center;
          gap: 18px;
          border: 1px solid #e8eef0;
          border-radius: 17px;
          padding: 15px;
        }

        .userMain {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .avatar {
          width: 45px;
          height: 45px;
          border-radius: 14px;
          background: #dcfce7;
          color: #15803d;
          display: grid;
          place-items: center;
          font-weight: 800;
          flex-shrink: 0;
        }

        .identity {
          min-width: 0;
        }

        .identity h3 {
          margin: 0 0 5px;
          font-size: 15px;
        }

        .meta {
          display: flex;
          gap: 7px;
          color: #64748b;
          font-size: 12px;
        }

        .identity small {
          display: block;
          margin-top: 5px;
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .balance {
          text-align: center;
        }

        .balance span {
          display: block;
          color: #64748b;
          font-size: 11px;
        }

        .balance strong {
          font-size: 22px;
          color: #166534;
        }

        .balance em {
          font-style: normal;
          font-size: 11px;
          color: #64748b;
          margin-right: 4px;
        }

        .totals {
          display: flex;
          justify-content: center;
          gap: 25px;
        }

        .totals div {
          text-align: center;
        }

        .totals span {
          display: block;
          font-size: 10px;
          color: #94a3b8;
          margin-bottom: 4px;
        }

        .totals b {
          font-size: 13px;
        }

        .actions {
          display: flex;
          gap: 7px;
        }

        .actions button {
          flex: 1;
          border-radius: 10px;
          padding: 9px 7px;
          font-weight: 800;
          cursor: pointer;
        }

        .add {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }

        .subtract {
          background: #fff7f7;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .operations {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .operation {
          border: 1px solid #e8eef0;
          border-radius: 15px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .operation h3 {
          font-size: 14px;
          margin: 0 0 5px;
        }

        .operation p {
          font-size: 11px;
          color: #64748b;
          margin: 0;
        }

        .operationCost {
          text-align: center;
          white-space: nowrap;
        }

        .operationCost strong {
          display: block;
          color: #15803d;
          font-size: 20px;
        }

        .operationCost span {
          color: #64748b;
          font-size: 10px;
        }

        .transactions {
          display: grid;
          gap: 5px;
        }

        .transaction {
          display: grid;
          grid-template-columns: 42px 1fr 100px 140px;
          align-items: center;
          gap: 12px;
          padding: 12px 5px;
          border-bottom: 1px solid #f1f5f9;
        }

        .transactionIcon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-weight: 800;
        }

        .transactionIcon.credit {
          background: #ecfdf3;
          color: #15803d;
        }

        .transactionIcon.debit {
          background: #fff1f2;
          color: #be123c;
        }

        .transactionInfo strong {
          display: block;
          font-size: 13px;
        }

        .transactionInfo span {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 10px;
        }

        .transactionAmount {
          font-weight: 900;
          text-align: center;
        }

        .transactionAmount.credit {
          color: #15803d;
        }

        .transactionAmount.debit {
          color: #be123c;
        }

        .transactionBalance {
          text-align: center;
        }

        .transactionBalance span {
          display: block;
          color: #94a3b8;
          font-size: 9px;
        }

        .transactionBalance strong {
          font-size: 13px;
        }

        .security {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 18px;
          padding: 17px;
        }

        .securityIcon {
          font-size: 24px;
        }

        .security h3 {
          margin: 0 0 5px;
          font-size: 14px;
        }

        .security p {
          margin: 0;
          color: #166534;
          font-size: 12px;
          line-height: 1.7;
        }

        .empty {
          text-align: center;
          padding: 55px 20px;
          color: #64748b;
        }

        .empty > div {
          font-size: 35px;
          color: #16a34a;
        }

        .empty h3 {
          margin: 10px 0 5px;
          color: #0f172a;
        }

        .empty p {
          margin: 0;
        }

        .empty.small {
          padding: 35px;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.38);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 100;
        }

        .modal {
          width: min(500px, 100%);
          background: white;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 25px 80px rgba(15, 23, 42, 0.2);
        }

        .modalHeader {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .modalHeader h2 {
          margin: 0 0 5px;
          font-size: 22px;
        }

        .modalHeader p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .close {
          width: 35px;
          height: 35px;
          border: 0;
          background: #f1f5f9;
          border-radius: 10px;
          cursor: pointer;
          font-size: 22px;
        }

        .currentBalance {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .currentBalance span {
          color: #64748b;
          font-size: 12px;
        }

        .currentBalance strong {
          color: #166534;
          font-size: 18px;
        }

        label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #334155;
          margin-bottom: 15px;
        }

        label input,
        label textarea {
          display: block;
          width: 100%;
          margin-top: 7px;
          border: 1px solid #dbe4df;
          border-radius: 11px;
          padding: 12px;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          background: #fff;
        }

        label textarea {
          min-height: 90px;
          resize: vertical;
        }

        label input:focus,
        label textarea:focus {
          border-color: #86efac;
          box-shadow: 0 0 0 3px #f0fdf4;
        }

        .warning {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          border-radius: 11px;
          padding: 11px;
          font-size: 11px;
          margin-bottom: 14px;
        }

        .modalError {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          border-radius: 11px;
          padding: 11px;
          font-size: 12px;
          margin-bottom: 14px;
        }

        .modalActions {
          display: flex;
          gap: 9px;
          margin-top: 20px;
        }

        .modalActions button {
          flex: 1;
          border-radius: 11px;
          padding: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .cancel {
          border: 1px solid #dbe4df;
          background: white;
          color: #475569;
        }

        .confirmAdd {
          border: 1px solid #16a34a;
          background: #16a34a;
          color: white;
        }

        .confirmSubtract {
          border: 1px solid #dc2626;
          background: #dc2626;
          color: white;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .userCard {
            grid-template-columns: 1fr 130px;
          }

          .totals,
          .actions {
            grid-column: span 1;
          }

          .operations {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 700px) {
          .page {
            padding: 20px 12px 40px;
          }

          .header {
            flex-direction: column;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .stat {
            padding: 14px;
          }

          .panel {
            padding: 15px;
            border-radius: 18px;
          }

          .panelHeader {
            align-items: stretch;
            flex-direction: column;
          }

          .filters {
            width: 100%;
            flex-direction: column;
          }

          .filters input {
            width: 100%;
          }

          .userCard {
            grid-template-columns: 1fr;
          }

          .balance {
            text-align: right;
          }

          .totals {
            justify-content: flex-start;
          }

          .operations {
            grid-template-columns: 1fr;
          }

          .transaction {
            grid-template-columns: 35px 1fr auto;
          }

          .transactionBalance {
            display: none;
          }
        }

        @media (max-width: 430px) {
          .stats {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
}
