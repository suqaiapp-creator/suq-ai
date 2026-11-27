"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";

const supabase = createClient();

const OPERATION_LABELS = {
  create_design: "إنشاء تصميم",
  edit_design: "تعديل تصميم",
  publish: "النشر",
  complete_ad: "إكمال إعلان",
  welcome_bonus: "رصيد البداية",
  points_purchase: "شراء نقاط",
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
  return OPERATION_LABELS[value] || value || "عملية نقاط";
}

function transactionType(type) {
  if (type === "credit") {
    return {
      label: "إضافة",
      sign: "+",
      className: "credit",
    };
  }

  return {
    label: "خصم",
    sign: "−",
    className: "debit",
  };
}

export default function PointsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  const [points, setPoints] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [operations, setOperations] = useState([]);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [transactionFilter, setTransactionFilter] = useState("all");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);

      const [
        pointsResult,
        transactionsResult,
        operationsResult,
      ] = await Promise.all([
        supabase
          .from("user_points")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle(),

        supabase
          .from("point_transactions")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("point_operations")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: true }),
      ]);

      if (pointsResult.error) throw pointsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (operationsResult.error) throw operationsResult.error;

      setPoints(pointsResult.data);
      setTransactions(transactionsResult.data || []);
      setOperations(operationsResult.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "تعذر تحميل بيانات النقاط. حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === "all") {
      return transactions;
    }

    return transactions.filter(
      (item) => item.type === transactionFilter
    );
  }, [transactions, transactionFilter]);

  const currentBalance = Number(points?.balance || 0);
  const totalEarned = Number(points?.total_earned || 0);
  const totalSpent = Number(points?.total_spent || 0);

  const hasWelcomeBonus = transactions.some(
    (item) => item.operation === "welcome_bonus"
  );

  return (
    <main dir="rtl" className="page">
      <div className="container">

        {/* Header */}
        <header className="topbar">
          <div>
            <div className="eyebrow">
              SUQ AI • POINTS
            </div>

            <h1>النقاط</h1>

            <p>
              إدارة رصيدك ومتابعة استخدام النقاط داخل سوق AI.
            </p>
          </div>

          <button
            className="refreshButton"
            onClick={loadData}
            disabled={loading}
          >
            ↻ {loading ? "جاري التحديث..." : "تحديث"}
          </button>
        </header>

        {/* Error */}
        {error && (
          <div className="alert error">
            <strong>حدث خطأ</strong>
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {message && (
          <div className="alert success">
            {message}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <section className="loadingCard">
            <div className="spinner" />
            <p>جاري تحميل نظام النقاط...</p>
          </section>
        ) : (
          <>
            {/* Balance hero */}
            <section className="balanceHero">
              <div className="balanceMain">
                <div className="balanceIcon">✦</div>

                <div>
                  <span>رصيدك الحالي</span>

                  <div className="balanceValue">
                    {formatNumber(currentBalance)}
                    <small> نقطة</small>
                  </div>

                  <p>
                    النقاط تستخدم لتنفيذ العمليات داخل سوق AI.
                  </p>
                </div>
              </div>

              <div className="balanceStatus">
                <span className="statusDot" />
                الحساب نشط
              </div>
            </section>

            {/* Stats */}
            <section className="statsGrid">

              <div className="statCard">
                <div className="statIcon earned">↗</div>
                <div>
                  <span>إجمالي المكتسب</span>
                  <strong>
                    {formatNumber(totalEarned)}
                  </strong>
                  <small>نقطة</small>
                </div>
              </div>

              <div className="statCard">
                <div className="statIcon spent">↘</div>
                <div>
                  <span>إجمالي المستخدم</span>
                  <strong>
                    {formatNumber(totalSpent)}
                  </strong>
                  <small>نقطة</small>
                </div>
              </div>

              <div className="statCard">
                <div className="statIcon operations">⚡</div>
                <div>
                  <span>عدد الحركات</span>
                  <strong>
                    {formatNumber(transactions.length)}
                  </strong>
                  <small>حركة</small>
                </div>
              </div>

              <div className="statCard">
                <div className="statIcon account">✓</div>
                <div>
                  <span>رصيد البداية</span>
                  <strong>20</strong>
                  <small>نقطة</small>
                </div>
              </div>

            </section>

            {/* Welcome bonus */}
            <section className="welcomeCard">
              <div className="welcomeIcon">🎁</div>

              <div className="welcomeText">
                <strong>رصيد البداية</strong>

                <p>
                  عند إنشاء الحساب يحصل المستخدم على
                  <b> 20 نقطة</b> كبداية لاستخدام سوق AI.
                </p>
              </div>

              <div
                className={
                  hasWelcomeBonus
                    ? "bonusStatus done"
                    : "bonusStatus"
                }
              >
                {hasWelcomeBonus
                  ? "تمت الإضافة ✓"
                  : "لم تتم الإضافة"}
              </div>
            </section>

            {/* Operation prices */}
            <section className="section">

              <div className="sectionHeader">
                <div>
                  <h2>تكلفة العمليات</h2>
                  <p>
                    تكلفة كل عملية بالنقاط حسب إعدادات سوق AI.
                  </p>
                </div>
              </div>

              {operations.length === 0 ? (
                <div className="empty">
                  لا توجد عمليات مفعلة حاليًا.
                </div>
              ) : (
                <div className="operationGrid">
                  {operations.map((operation) => (
                    <div
                      className="operationCard"
                      key={operation.id}
                    >
                      <div className="operationTop">
                        <div className="operationSymbol">
                          ⚡
                        </div>

                        <span className="activeBadge">
                          مفعلة
                        </span>
                      </div>

                      <h3>
                        {operation.name}
                      </h3>

                      <p>
                        {operation.description ||
                          "عملية داخل سوق AI"}
                      </p>

                      <div className="operationCost">
                        <strong>
                          {formatNumber(
                            operation.points_cost
                          )}
                        </strong>
                        <span>نقطة</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </section>

            {/* Transactions */}
            <section className="section">

              <div className="sectionHeader transactionsHeader">
                <div>
                  <h2>سجل النقاط</h2>
                  <p>
                    جميع عمليات الإضافة والخصم المسجلة على حسابك.
                  </p>
                </div>

                <div className="filters">

                  <button
                    className={
                      transactionFilter === "all"
                        ? "filter active"
                        : "filter"
                    }
                    onClick={() =>
                      setTransactionFilter("all")
                    }
                  >
                    الكل
                  </button>

                  <button
                    className={
                      transactionFilter === "credit"
                        ? "filter active"
                        : "filter"
                    }
                    onClick={() =>
                      setTransactionFilter("credit")
                    }
                  >
                    الإضافات
                  </button>

                  <button
                    className={
                      transactionFilter === "debit"
                        ? "filter active"
                        : "filter"
                    }
                    onClick={() =>
                      setTransactionFilter("debit")
                    }
                  >
                    الخصومات
                  </button>

                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="empty large">
                  <div className="emptyIcon">
                    ◎
                  </div>

                  <strong>
                    لا توجد حركات
                  </strong>

                  <span>
                    سيظهر سجل النقاط هنا عند استخدام النظام.
                  </span>
                </div>
              ) : (
                <div className="transactionsCard">

                  {filteredTransactions.map((item) => {
                    const type =
                      transactionType(item.type);

                    return (
                      <div
                        className="transactionRow"
                        key={item.id}
                      >

                        <div
                          className={`transactionIcon ${type.className}`}
                        >
                          {type.sign}
                        </div>

                        <div className="transactionInfo">
                          <strong>
                            {operationName(
                              item.operation
                            )}
                          </strong>

                          <span>
                            {item.description ||
                              type.label}
                          </span>

                          <small>
                            {formatDate(
                              item.created_at
                            )}
                          </small>
                        </div>

                        <div className="transactionReference">
                          {item.reference_type && (
                            <span>
                              {item.reference_type}
                            </span>
                          )}
                        </div>

                        <div className="transactionAmount">
                          <strong
                            className={type.className}
                          >
                            {type.sign}
                            {formatNumber(
                              item.amount
                            )}
                          </strong>

                          <span>
                            الرصيد بعد العملية:{" "}
                            {formatNumber(
                              item.balance_after
                            )}
                          </span>
                        </div>

                      </div>
                    );
                  })}

                </div>
              )}

            </section>

            {/* Rules */}
            <section className="rulesCard">

              <div className="rulesTitle">
                <span>🔒</span>

                <div>
                  <h2>نظام النقاط محمي</h2>
                  <p>
                    رصيد النقاط لا يتم تعديله من واجهة المستخدم
                    مباشرة.
                  </p>
                </div>
              </div>

              <div className="rulesGrid">

                <div>
                  <b>عدم وجود رصيد كافٍ</b>
                  <span>
                    لا يمكن تنفيذ العملية إذا كان الرصيد أقل
                    من التكلفة.
                  </span>
                </div>

                <div>
                  <b>تسجيل كل حركة</b>
                  <span>
                    كل إضافة أو خصم يتم حفظها في السجل.
                  </span>
                </div>

                <div>
                  <b>منع التكرار</b>
                  <span>
                    العمليات المرتبطة بمرجع لا يتم خصمها
                    مرتين.
                  </span>
                </div>

                <div>
                  <b>الدفع لاحقًا</b>
                  <span>
                    شراء النقاط والدفع الإلكتروني سيضافان
                    في مرحلة الاشتراكات.
                  </span>
                </div>

              </div>

            </section>

          </>
        )}

      </div>

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            linear-gradient(
              180deg,
              #f8faf9 0%,
              #ffffff 55%,
              #f7faf8 100%
            );
          color: #18221d;
          padding: 30px 20px 70px;
        }

        .container {
          max-width: 1240px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow {
          color: #198754;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .12em;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -.03em;
        }

        .topbar p {
          margin: 8px 0 0;
          color: #718078;
          font-size: 15px;
        }

        .refreshButton {
          border: 1px solid #dce7e1;
          background: #ffffff;
          color: #26352e;
          border-radius: 12px;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 18px rgba(24, 34, 29, .04);
        }

        .refreshButton:hover {
          border-color: #b9d8c8;
          background: #f7fcf9;
        }

        .refreshButton:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .alert {
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 14px;
        }

        .alert.error {
          background: #fff3f3;
          color: #9f2f2f;
          border: 1px solid #f2d2d2;
        }

        .alert.success {
          background: #effaf3;
          color: #19713d;
          border: 1px solid #ccebd7;
        }

        .loadingCard {
          min-height: 350px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 14px;
          background: #ffffff;
          border: 1px solid #e4ebe7;
          border-radius: 22px;
        }

        .spinner {
          width: 32px;
          height: 32px;
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

        .balanceHero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 30px;
          border-radius: 24px;
          background:
            linear-gradient(
              135deg,
              #123c2a 0%,
              #17613f 55%,
              #198754 100%
            );
          color: white;
          box-shadow: 0 18px 45px rgba(25, 135, 84, .18);
          margin-bottom: 18px;
        }

        .balanceMain {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .balanceIcon {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,.13);
          border: 1px solid rgba(255,255,255,.18);
          font-size: 28px;
        }

        .balanceMain span {
          display: block;
          color: rgba(255,255,255,.75);
          font-size: 13px;
          margin-bottom: 4px;
        }

        .balanceValue {
          font-size: 44px;
          line-height: 1;
          font-weight: 850;
          letter-spacing: -.04em;
        }

        .balanceValue small {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255,255,255,.72);
        }

        .balanceMain p {
          margin: 9px 0 0;
          color: rgba(255,255,255,.72);
          font-size: 13px;
        }

        .balanceStatus {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 999px;
          padding: 9px 13px;
          font-size: 13px;
        }

        .statusDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8ef0b6;
          box-shadow: 0 0 0 4px rgba(142,240,182,.12);
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .statCard {
          background: white;
          border: 1px solid #e4ebe7;
          border-radius: 18px;
          padding: 19px;
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .statIcon {
          width: 44px;
          height: 44px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 800;
        }

        .statIcon.earned {
          background: #eaf8f0;
          color: #198754;
        }

        .statIcon.spent {
          background: #fff4ea;
          color: #c46b17;
        }

        .statIcon.operations {
          background: #eef5ff;
          color: #3f6ea8;
        }

        .statIcon.account {
          background: #f1efff;
          color: #6b59ad;
        }

        .statCard span {
          display: block;
          color: #75827c;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .statCard strong {
          font-size: 22px;
          margin-left: 5px;
        }

        .statCard small {
          color: #89938e;
          font-size: 11px;
        }

        .welcomeCard {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 17px 19px;
          background: #f4fbf7;
          border: 1px solid #d9eee1;
          border-radius: 18px;
          margin-bottom: 32px;
        }

        .welcomeIcon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: white;
          border: 1px solid #dcebe2;
          font-size: 20px;
        }

        .welcomeText {
          flex: 1;
        }

        .welcomeText strong {
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
        }

        .welcomeText p {
          margin: 0;
          color: #65736c;
          font-size: 13px;
        }

        .welcomeText b {
          color: #198754;
        }

        .bonusStatus {
          color: #8b6b20;
          background: #fff8df;
          border: 1px solid #f0e4b7;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 700;
        }

        .bonusStatus.done {
          color: #19713d;
          background: #e9f8ef;
          border-color: #ccebd7;
        }

        .section {
          margin-bottom: 34px;
        }

        .sectionHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 14px;
        }

        .sectionHeader h2 {
          margin: 0;
          font-size: 21px;
        }

        .sectionHeader p {
          margin: 5px 0 0;
          color: #78847e;
          font-size: 13px;
        }

        .operationGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .operationCard {
          background: white;
          border: 1px solid #e4ebe7;
          border-radius: 18px;
          padding: 18px;
        }

        .operationTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .operationSymbol {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #eaf8f0;
          color: #198754;
        }

        .activeBadge {
          font-size: 10px;
          font-weight: 700;
          color: #198754;
          background: #eef9f3;
          border-radius: 999px;
          padding: 5px 8px;
        }

        .operationCard h3 {
          margin: 0 0 6px;
          font-size: 15px;
        }

        .operationCard p {
          margin: 0;
          color: #7a857f;
          font-size: 12px;
          min-height: 35px;
          line-height: 1.6;
        }

        .operationCost {
          margin-top: 16px;
          padding-top: 13px;
          border-top: 1px solid #edf1ef;
          display: flex;
          align-items: baseline;
          gap: 5px;
        }

        .operationCost strong {
          font-size: 25px;
          color: #198754;
        }

        .operationCost span {
          color: #7b8781;
          font-size: 12px;
        }

        .transactionsHeader {
          align-items: center;
        }

        .filters {
          display: flex;
          gap: 6px;
          background: #f1f5f3;
          padding: 4px;
          border-radius: 11px;
        }

        .filter {
          border: 0;
          background: transparent;
          border-radius: 8px;
          padding: 8px 11px;
          color: #718078;
          font-size: 12px;
          cursor: pointer;
        }

        .filter.active {
          background: white;
          color: #198754;
          font-weight: 800;
          box-shadow: 0 2px 8px rgba(24,34,29,.06);
        }

        .transactionsCard {
          background: white;
          border: 1px solid #e4ebe7;
          border-radius: 18px;
          overflow: hidden;
        }

        .transactionRow {
          min-height: 84px;
          padding: 14px 17px;
          display: grid;
          grid-template-columns: 42px minmax(0,1fr) 120px auto;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid #edf1ef;
        }

        .transactionRow:last-child {
          border-bottom: 0;
        }

        .transactionIcon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 20px;
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
          font-size: 14px;
          margin-bottom: 3px;
        }

        .transactionInfo span {
          display: block;
          color: #6f7d75;
          font-size: 12px;
        }

        .transactionInfo small {
          display: block;
          color: #a0aaa5;
          font-size: 10px;
          margin-top: 4px;
        }

        .transactionReference span {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 7px;
          background: #f4f6f5;
          color: #7c8781;
          font-size: 10px;
        }

        .transactionAmount {
          text-align: left;
        }

        .transactionAmount strong {
          display: block;
          font-size: 16px;
        }

        .transactionAmount strong.credit {
          color: #198754;
        }

        .transactionAmount strong.debit {
          color: #c85637;
        }

        .transactionAmount span {
          color: #929b96;
          font-size: 10px;
        }

        .empty {
          padding: 30px;
          background: white;
          border: 1px solid #e4ebe7;
          border-radius: 18px;
          text-align: center;
          color: #7b8781;
          font-size: 13px;
        }

        .empty.large {
          min-height: 180px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 7px;
        }

        .emptyIcon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #f1f5f3;
          color: #8b9891;
          font-size: 20px;
          margin-bottom: 4px;
        }

        .empty strong {
          color: #38463f;
        }

        .rulesCard {
          padding: 22px;
          border-radius: 20px;
          background: #f8faf9;
          border: 1px solid #e2ebe6;
        }

        .rulesTitle {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .rulesTitle > span {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: white;
          border: 1px solid #e2ebe6;
        }

        .rulesTitle h2 {
          margin: 0 0 3px;
          font-size: 16px;
        }

        .rulesTitle p {
          margin: 0;
          color: #7c8881;
          font-size: 12px;
        }

        .rulesGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .rulesGrid > div {
          background: white;
          border: 1px solid #e7ece9;
          border-radius: 13px;
          padding: 13px;
        }

        .rulesGrid b {
          display: block;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .rulesGrid span {
          display: block;
          color: #7c8881;
          font-size: 11px;
          line-height: 1.6;
        }

        @media (max-width: 980px) {
          .statsGrid,
          .operationGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .rulesGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 20px 12px 50px;
          }

          .topbar {
            flex-direction: column;
          }

          h1 {
            font-size: 28px;
          }

          .refreshButton {
            width: 100%;
          }

          .balanceHero {
            padding: 22px;
            flex-direction: column;
            align-items: flex-start;
          }

          .balanceValue {
            font-size: 36px;
          }

          .statsGrid,
          .operationGrid,
          .rulesGrid {
            grid-template-columns: 1fr;
          }

          .welcomeCard {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .bonusStatus {
            margin-right: 59px;
          }

          .transactionsHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .transactionRow {
            grid-template-columns: 42px minmax(0,1fr) auto;
          }

          .transactionReference {
            display: none;
          }

          .transactionAmount {
            grid-column: 2 / 4;
            text-align: right;
            padding-right: 56px;
            margin-top: -12px;
          }
        }

      `}</style>
    </main>
  );
}
