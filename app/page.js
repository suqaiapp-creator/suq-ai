export default function Home() {
  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f8fc",
        fontFamily: "Arial, sans-serif",
        color: "#171923",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e8e8ef",
          padding: "18px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "25px", fontWeight: "800" }}>
              سوق AI
            </div>
            <div style={{ fontSize: "13px", color: "#777" }}>
              من منتجك إلى إعلانك
            </div>
          </div>

          <button
            style={{
              border: "none",
              background: "#111827",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: "12px",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            تسجيل الدخول
          </button>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "70px 24px 45px",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0edff 100%)",
            borderRadius: "28px",
            padding: "55px 35px",
            textAlign: "center",
            border: "1px solid #e8e5ff",
          }}
        >
          <div
            style={{
              display: "inline-block",
              background: "#ece9ff",
              color: "#5b43d6",
              padding: "8px 14px",
              borderRadius: "999px",
              fontSize: "14px",
              fontWeight: "700",
              marginBottom: "18px",
            }}
          >
            🚀 التسويق بالذكاء الاصطناعي
          </div>

          <h1
            style={{
              fontSize: "clamp(36px, 6vw, 64px)",
              margin: "0 auto 18px",
              maxWidth: "850px",
              lineHeight: "1.15",
            }}
          >
            من منتجك إلى إعلانك
            <br />
            <span style={{ color: "#6246e5" }}>بضغطة واحدة</span>
          </h1>

          <p
            style={{
              maxWidth: "700px",
              margin: "0 auto 30px",
              color: "#666",
              fontSize: "18px",
              lineHeight: "1.8",
            }}
          >
            صوّر منتجك أو امسح الباركود، ودع سوق AI يحلل المنتج
            ويجهز لك المحتوى والتصميم والفيديو التسويقي.
          </p>

          <button
            style={{
              background: "#6246e5",
              color: "#fff",
              border: "none",
              padding: "17px 34px",
              borderRadius: "15px",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            🚀 أضف منتج
          </button>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "20px 24px 70px",
        }}
      >
        <h2 style={{ fontSize: "30px", marginBottom: "30px" }}>
          كل أدوات التسويق في مكان واحد
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          <Feature
            icon="📦"
            title="إدارة المنتجات"
            text="أضف منتجاتك واحفظ معلوماتها في مكتبتك."
          />

          <Feature
            icon="🔎"
            title="تحليل المنتج"
            text="تحليل الصور والباركود ومعلومات المنتج."
          />

          <Feature
            icon="✍️"
            title="محتوى تسويقي"
            text="وصف وإعلانات جاهزة لمنصات التواصل."
          />

          <Feature
            icon="🎨"
            title="تصاميم إعلانية"
            text="أنشئ تصاميم متوافقة مع هوية متجرك."
          />

          <Feature
            icon="🎬"
            title="فيديو قصير"
            text="جهز فيديوهات مناسبة لـ Reels وTikTok."
          />

          <Feature
            icon="📱"
            title="كل المنصات"
            text="محتوى جاهز لواتساب وإنستغرام وتيك توك وغيرها."
          />
        </div>
      </section>

      {/* Workflow */}
      <section
        style={{
          background: "#ffffff",
          padding: "60px 24px",
          borderTop: "1px solid #eeeeee",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "30px", marginBottom: "35px" }}>
            كيف يعمل سوق AI؟
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "15px",
            }}
          >
            <Step number="1" title="أضف المنتج" />
            <Step number="2" title="تحليل وتحقق" />
            <Step number="3" title="إنشاء المحتوى" />
            <Step number="4" title="التصميم والفيديو" />
            <Step number="5" title="جاهز للنشر" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "30px",
          color: "#777",
          fontSize: "14px",
        }}
      >
        سوق AI © 2026
      </footer>
    </main>
  );
}

function Feature({ icon, title, text }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e9e9ef",
        borderRadius: "20px",
        padding: "25px",
      }}
    >
      <div style={{ fontSize: "34px", marginBottom: "15px" }}>{icon}</div>
      <h3 style={{ margin: "0 0 10px", fontSize: "19px" }}>{title}</h3>
      <p
        style={{
          margin: 0,
          color: "#707070",
          lineHeight: "1.7",
          fontSize: "14px",
        }}
      >
        {text}
      </p>
    </div>
  );
}

function Step({ number, title }) {
  return (
    <div
      style={{
        border: "1px solid #e8e8ee",
        borderRadius: "18px",
        padding: "22px",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          background: "#6246e5",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "700",
          marginBottom: "14px",
        }}
      >
        {number}
      </div>

      <strong>{title}</strong>
    </div>
  );
}
