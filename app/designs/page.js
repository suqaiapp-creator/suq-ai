"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "../../lib/supabase/client";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

const supabase = createClient();

const FORMATS = [
  {
    id: "1:1",
    title: "منشور مربع",
    description: "مناسب لمنشورات Instagram",
    icon: "▣",
  },
  {
    id: "4:5",
    title: "منشور عمودي",
    description: "مناسب للإعلانات والمنشورات",
    icon: "▯",
  },
  {
    id: "9:16",
    title: "ستوري",
    description: "Instagram / Snapchat / TikTok",
    icon: "▥",
  },
  {
    id: "16:9",
    title: "أفقي",
    description: "شاشات وإعلانات أفقية",
    icon: "▭",
  },
];

const TEMPLATES = [
  {
    id: "product",
    title: "عرض منتج",
    description: "منتج واضح مع اسم المنتج وهوية المحل",
    icon: "🛍️",
  },
  {
    id: "discount",
    title: "خصم وسعر",
    description: "تركيز على السعر أو الخصم",
    icon: "💰",
  },
  {
    id: "new",
    title: "منتج جديد",
    description: "إعلان إطلاق منتج جديد",
    icon: "🆕",
  },
  {
    id: "bestseller",
    title: "الأكثر مبيعاً",
    description: "إبراز منتج مميز أو مشهور",
    icon: "⭐",
  },
  {
    id: "offer",
    title: "عرض خاص",
    description: "تصميم قوي للعروض والمناسبات",
    icon: "🔥",
  },
  {
    id: "simple",
    title: "إعلان بسيط",
    description: "تصميم نظيف وسريع",
    icon: "📢",
  },
  {
    id: "social",
    title: "إعلان سوشيال",
    description: "تصميم جاهز للنشر على السوشيال",
    icon: "📱",
  },
  {
    id: "premium",
    title: "فاخر",
    description: "شكل أنيق ومناسب للمنتجات الفاخرة",
    icon: "✨",
  },
];

const STYLES = [
  {
    id: "luxury",
    title: "فاخر",
    icon: "🖤",
  },
  {
    id: "modern",
    title: "عصري",
    icon: "⚡",
  },
  {
    id: "clean",
    title: "نظيف",
    icon: "🧊",
  },
  {
    id: "dark-tech",
    title: "تقني داكن",
    icon: "🌑",
  },
  {
    id: "premium",
    title: "Premium",
    icon: "💎",
  },
  {
    id: "sale",
    title: "عرض قوي",
    icon: "🔥",
  },
];

const BACKGROUNDS = [
  {
    id: "black",
    title: "أسود",
    value: "خلفية سوداء فخمة",
  },
  {
    id: "white",
    title: "أبيض",
    value: "خلفية بيضاء نظيفة",
  },
  {
    id: "dark",
    title: "داكن",
    value: "خلفية داكنة عصرية",
  },
  {
    id: "light",
    title: "فاتح",
    value: "خلفية فاتحة وناعمة",
  },
  {
    id: "gradient",
    title: "تدرج",
    value: "خلفية بتدرج لوني احترافي",
  },
];

function IconBox({
  children,
  size = 44,
  background = "#f0fdf4",
  color = "#15803d",
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 13,
        background,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 42 ? 19 : 22,
        lineHeight: 1,
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ type, children }) {
  const styles = {
    ready: {
      background: "#ecfdf3",
      color: "#067647",
      border: "1px solid #abefc6",
    },
    warning: {
      background: "#fffaeb",
      color: "#b54708",
      border: "1px solid #fedf89",
    },
    locked: {
      background: "#fef3f2",
      color: "#b42318",
      border: "1px solid #fecdca",
    },
    pending: {
      background: "#eff8ff",
      color: "#175cd3",
      border: "1px solid #b2ddff",
    },
  };

  return (
    <span
      style={{
        ...(styles[type] || styles.pending),
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  );
}

function isLocked(product) {
  return (
    product?.verification_status === "locked" ||
    product?.safety_status === "locked" ||
    product?.safety_status === "violation" ||
    product?.safety_level === "critical"
  );
}

function isUnclear(product) {
  if (!product) return true;

  if (isLocked(product)) return false;

  const verification = String(
    product.verification_status || ""
  )
    .trim()
    .toLowerCase();

  const confidence = String(
    product.confidence || ""
  )
    .trim()
    .toLowerCase();

  return (
    verification === "review" ||
    verification === "unverified" ||
    verification === "pending" ||
    product.ai_status === "pending" ||
    confidence === "low" ||
    confidence === "medium" ||
    confidence === "منخفض" ||
    confidence === "متوسط" ||
    !product.brand ||
    !product.category ||
    !product.description
  );
}

function getProductStatus(product) {
  if (isLocked(product)) {
    return {
      type: "locked",
      text: "مقفل",
      icon: "🔴",
    };
  }

  if (isUnclear(product)) {
    return {
      type: "warning",
      text: "يحتاج تأكيد",
      icon: "🟡",
    };
  }

  return {
    type: "ready",
    text: "جاهز للتصميم",
    icon: "🟢",
  };
}

function getDesignStatus(status) {
  if (status === "completed") {
    return {
      type: "ready",
      text: "مكتمل",
      icon: "✓",
    };
  }

  if (status === "failed") {
    return {
      type: "locked",
      text: "فشل",
      icon: "!",
    };
  }

  if (
    status === "processing" ||
    status === "generating"
  ) {
    return {
      type: "pending",
      text: "قيد الإنشاء",
      icon: "⏳",
    };
  }

  return {
    type: "pending",
    text: "بانتظار الإنشاء",
    icon: "◷",
  };
}

/* =========================================================
   الصفحة الداخلية
========================================================= */

function DesignsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);

  const [products, setProducts] = useState([]);
  const [designs, setDesigns] = useState([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [mode, setMode] = useState("simple");
  const [selectedTemplate, setSelectedTemplate] =
    useState("product");
  const [selectedStyle, setSelectedStyle] =
    useState("modern");
  const [selectedBackground, setSelectedBackground] =
    useState("black");
  const [selectedFormat, setSelectedFormat] =
    useState("1:1");
  const [description, setDescription] =
    useState("");

  const [showIdentity, setShowIdentity] =
    useState(true);

  const [responsibilityAccepted, setResponsibilityAccepted] =
    useState(false);

  const [search, setSearch] = useState("");
  const [designFilter, setDesignFilter] =
    useState("all");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = useMemo(() => {
    return (
      products.find(
        (item) => item.id === selectedProductId
      ) || null
    );
  }, [products, selectedProductId]);

  const selectedProductLocked = selectedProduct
    ? isLocked(selectedProduct)
    : false;

  const selectedProductUnclear = selectedProduct
    ? isUnclear(selectedProduct)
    : false;

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    const productFromUrl =
      searchParams.get("product");

    if (
      productFromUrl &&
      products.some(
        (product) =>
          product.id === productFromUrl
      )
    ) {
      setSelectedProductId(productFromUrl);
    }
  }, [searchParams, products]);

  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      const {
        data: shopData,
        error: shopError,
      } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", currentUser.id)
        .order("created_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (shopError) {
        throw shopError;
      }

      if (!shopData) {
        router.replace("/setup-shop");
        return;
      }

      setShop(shopData);

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", shopData.id)
        .order("created_at", {
          ascending: false,
        });

      if (productError) {
        throw productError;
      }

      setProducts(productData || []);

      const {
        data: designData,
        error: designError,
      } = await supabase
        .from("ad_images")
        .select("*")
        .eq("shop_id", shopData.id)
        .order("created_at", {
          ascending: false,
        });

      if (designError) {
        throw designError;
      }

      setDesigns(designData || []);

      const productFromUrl =
        searchParams.get("product");

      if (
        productFromUrl &&
        productData?.some(
          (product) =>
            product.id === productFromUrl
        )
      ) {
        setSelectedProductId(
          productFromUrl
        );
      } else if (productData?.length) {
        setSelectedProductId(
          productData[0].id
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل استوديو التصميم."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredDesigns = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return designs.filter((design) => {
      const product = products.find(
        (item) =>
          item.id === design.product_id
      );

      const productName =
        product?.name || "";

      const productBrand =
        product?.brand || "";

      const matchesSearch =
        !query ||
        `${productName} ${productBrand} ${
          design.format || ""
        }`
          .toLowerCase()
          .includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (designFilter === "completed") {
        return design.status === "completed";
      }

      if (designFilter === "processing") {
        return (
          design.status === "processing" ||
          design.status === "generating" ||
          design.status === "pending"
        );
      }

      if (designFilter === "failed") {
        return design.status === "failed";
      }

      return true;
    });
  }, [
    designs,
    products,
    search,
    designFilter,
  ]);

  const designStats = useMemo(() => {
    return {
      total: designs.length,

      completed: designs.filter(
        (design) =>
          design.status === "completed"
      ).length,

      processing: designs.filter(
        (design) =>
          design.status === "processing" ||
          design.status === "generating" ||
          design.status === "pending"
      ).length,

      failed: designs.filter(
        (design) =>
          design.status === "failed"
      ).length,
    };
  }, [designs]);

  const productStats = useMemo(() => {
    return {
      total: products.length,

      ready: products.filter(
        (product) =>
          !isLocked(product) &&
          !isUnclear(product)
      ).length,

      review: products.filter(
        (product) =>
          !isLocked(product) &&
          isUnclear(product)
      ).length,

      locked: products.filter(
        (product) =>
          isLocked(product)
      ).length,
    };
  }, [products]);

  async function checkResponsibilityAcceptance() {
    if (
      !user ||
      !shop ||
      !selectedProduct
    ) {
      return false;
    }

    if (!selectedProductUnclear) {
      return true;
    }

    const {
      data,
      error: acceptanceError,
    } = await supabase
      .from(
        "product_responsibility_acceptances"
      )
      .select("id")
      .eq("user_id", user.id)
      .eq(
        "product_id",
        selectedProduct.id
      )
      .maybeSingle();

    if (acceptanceError) {
      console.error(
        acceptanceError
      );

      return false;
    }

    return Boolean(data);
  }

  async function acceptResponsibility() {
    if (
      !user ||
      !shop ||
      !selectedProduct
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        error: acceptanceError,
      } = await supabase
        .from(
          "product_responsibility_acceptances"
        )
        .upsert(
          {
            user_id: user.id,
            shop_id: shop.id,
            product_id:
              selectedProduct.id,
            policy_version: "1.0",
          },
          {
            onConflict:
              "user_id,product_id",
          }
        );

      if (acceptanceError) {
        throw acceptanceError;
      }

      setResponsibilityAccepted(true);

      setMessage(
        "تم تأكيد مسؤولية المنتج ويمكنك الآن تجهيز التصميم."
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر حفظ تأكيد المسؤولية."
      );
    } finally {
      setSaving(false);
    }
  }

  async function createDesign() {
    setError("");
    setMessage("");

    if (!selectedProduct) {
      setError("اختر المنتج أولاً.");
      return;
    }

    if (selectedProductLocked) {
      setError(
        "🔒 هذا المنتج مقفل ولا يمكن استخدامه في التصميم حالياً."
      );
      return;
    }

    if (!selectedProduct.image_url) {
      setError(
        "المنتج لا يحتوي على صورة. أضف صورة المنتج أولاً."
      );
      return;
    }

    if (
      selectedProductUnclear &&
      !responsibilityAccepted
    ) {
      const accepted =
        await checkResponsibilityAcceptance();

      if (!accepted) {
        setError(
          "⚠️ هذا المنتج يحتاج تأكيد مسؤولية المنتج قبل إنشاء التصميم."
        );

        return;
      }

      setResponsibilityAccepted(true);
    }

    setSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        router.replace("/login");
        return;
      }

      let backgroundValue = null;

      if (mode === "professional") {
        const backgroundItem =
          BACKGROUNDS.find(
            (item) =>
              item.id ===
              selectedBackground
          );

        backgroundValue =
          backgroundItem?.value ||
          selectedBackground ||
          null;
      }

      const response = await fetch(
        "/api/generate-design",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productId:
              selectedProduct.id,
            mode,
            template:
              mode === "simple"
                ? selectedTemplate
                : null,
            style:
              mode === "professional"
                ? selectedStyle
                : null,
            background:
              backgroundValue,
            format: selectedFormat,
            description:
              typeof description ===
              "string"
                ? description.trim()
                : "",
          }),
        }
      );

      let result = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        if (
          result?.requiresResponsibility
        ) {
          setResponsibilityAccepted(
            false
          );

          setError(
            "⚠️ يجب تأكيد مسؤولية المنتج قبل إنشاء التصميم."
          );
        } else {
          setError(
            result?.error ||
              "تعذر تجهيز طلب التصميم."
          );
        }

        return;
      }

      setMessage(
        "تم إرسال طلب التصميم بنجاح."
      );

      await loadPage();
    } catch (err) {
      console.error(
        "Create design error:",
        err
      );

      setError(
        err?.message ||
          "حدث خطأ أثناء إرسال طلب التصميم."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleProductChange(value) {
    setSelectedProductId(value);
    setResponsibilityAccepted(false);
    setError("");
    setMessage("");
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f6f8f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Arial, sans-serif",
          color: "#17201c",
        }}
      >
        جاري تحميل استوديو التصميم...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f6f8f7",
        color: "#17201c",
        fontFamily:
          "Arial, sans-serif",
        paddingBottom: 60,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 18px",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <button
              type="button"
              onClick={() =>
                router.push("/dashboard")
              }
              style={{
                border: 0,
                background:
                  "transparent",
                padding: 0,
                color: "#66736d",
                cursor: "pointer",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              ← لوحة التحكم
            </button>

            <div
              style={{
                color: "#15803d",
                fontWeight: 800,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              سوق AI
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              🎨 مركز التصاميم
            </h1>

            <p
              style={{
                margin: "8px 0 0",
                color: "#66736d",
                fontSize: 15,
              }}
            >
              أنشئ، تابع، وادِر تصاميم منتجاتك من مكان واحد.
            </p>
          </div>

          <button
            onClick={() =>
              router.push("/products")
            }
            style={{
              border:
                "1px solid #d7dfda",
              background: "#fff",
              color: "#1f2933",
              borderRadius: 12,
              padding:
                "11px 16px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            📦 المنتجات
          </button>
        </header>

        {error && (
          <div
            style={{
              background: "#fef3f2",
              border:
                "1px solid #fecdca",
              color: "#b42318",
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              background: "#ecfdf3",
              border:
                "1px solid #abefc6",
              color: "#067647",
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(145px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard
            icon="🎨"
            title="إجمالي التصاميم"
            value={designStats.total}
          />

          <StatCard
            icon="✅"
            title="مكتملة"
            value={designStats.completed}
          />

          <StatCard
            icon="⏳"
            title="قيد الإنشاء"
            value={designStats.processing}
          />

          <StatCard
            icon="❌"
            title="فشلت"
            value={designStats.failed}
          />

          <StatCard
            icon="📦"
            title="المنتجات"
            value={productStats.total}
          />

          <StatCard
            icon="🔒"
            title="منتجات مقفلة"
            value={productStats.locked}
          />
        </div>

        <div
          style={{
            background: "#fff",
            border:
              "1px solid #e1e7e3",
            borderRadius: 20,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 19,
                }}
              >
                🗂️ تصاميم المحل
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "#66736d",
                  fontSize: 13,
                }}
              >
                ابحث في التصاميم السابقة وتابع حالتها.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById(
                    "design-generator"
                  )
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
              }
              style={{
                border: 0,
                background:
                  "#15803d",
                color: "#fff",
                borderRadius: 11,
                padding:
                  "11px 15px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ➕ إنشاء تصميم
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="ابحث باسم المنتج أو البراند أو المقاس..."
              style={{
                flex:
                  "1 1 280px",
                minWidth: 220,
                padding:
                  "12px 14px",
                borderRadius: 12,
                border:
                  "1px solid #cfd8d3",
                outline: "none",
                fontSize: 14,
                boxSizing:
                  "border-box",
              }}
            />

            <FilterButton
              active={
                designFilter ===
                "all"
              }
              onClick={() =>
                setDesignFilter(
                  "all"
                )
              }
              text={`الكل (${designStats.total})`}
            />

            <FilterButton
              active={
                designFilter ===
                "completed"
              }
              onClick={() =>
                setDesignFilter(
                  "completed"
                )
              }
              text={`مكتمل (${designStats.completed})`}
            />

            <FilterButton
              active={
                designFilter ===
                "processing"
              }
              onClick={() =>
                setDesignFilter(
                  "processing"
                )
              }
              text={`قيد الإنشاء (${designStats.processing})`}
            />

            <FilterButton
              active={
                designFilter ===
                "failed"
              }
              onClick={() =>
                setDesignFilter(
                  "failed"
                )
              }
              text={`فشل (${designStats.failed})`}
            />
          </div>
        </div>

        <section
          style={{
            marginBottom: 30,
          }}
        >
          {filteredDesigns.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #e1e7e3",
                borderRadius: 20,
                padding:
                  "45px 20px",
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize: 50,
                  marginBottom: 10,
                }}
              >
                🎨
              </div>

              <h2
                style={{
                  margin:
                    "0 0 8px",
                }}
              >
                لا توجد تصاميم
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "#66736d",
                  lineHeight: 1.7,
                }}
              >
                لم يتم العثور على تصاميم مطابقة للبحث أو الفلتر.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 18,
              }}
            >
              {filteredDesigns.map(
                (design) => {
                  const product =
                    products.find(
                      (item) =>
                        item.id ===
                        design.product_id
                    );

                  const status =
                    getDesignStatus(
                      design.status
                    );

                  return (
                    <DesignCard
                      key={
                        design.id
                      }
                      design={
                        design
                      }
                      product={
                        product
                      }
                      status={
                        status
                      }
                      onOpen={() =>
                        router.push(
                          `/designs/${design.id}`
                        )
                      }
                    />
                  );
                }
              )}
            </div>
          )}
        </section>

        <section
          id="design-generator"
          style={{
            scrollMarginTop: 20,
          }}
        >
          <div
            style={{
              marginBottom: 15,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 23,
              }}
            >
              🚀 إنشاء تصميم جديد
            </h2>

            <p
              style={{
                margin:
                  "6px 0 0",
                color:
                  "#66736d",
                fontSize: 13,
              }}
            >
              اختر المنتج ثم حدد نوع التصميم والمقاس.
            </p>
          </div>

          <div
            className="design-layout"
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.6fr) minmax(300px, .8fr)",
              gap: 20,
              alignItems:
                "start",
            }}
          >
            <section>
              <div
                className="design-card"
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin:
                      "0 0 14px",
                    fontSize: 19,
                  }}
                >
                  1. اختر المنتج
                </h2>

                <select
                  value={
                    selectedProductId
                  }
                  onChange={(e) =>
                    handleProductChange(
                      e.target.value
                    )
                  }
                  style={{
                    width:
                      "100%",
                    padding: 14,
                    borderRadius: 12,
                    border:
                      "1px solid #cfd8d3",
                    fontSize: 15,
                    background:
                      "#fff",
                    boxSizing:
                      "border-box",
                  }}
                >
                  {products.length ===
                    0 && (
                    <option value="">
                      لا توجد منتجات
                    </option>
                  )}

                  {products.map(
                    (product) => (
                      <option
                        key={
                          product.id
                        }
                        value={
                          product.id
                        }
                      >
                        {
                          product.name
                        }
                        {product.brand
                          ? ` — ${product.brand}`
                          : ""}
                      </option>
                    )
                  )}
                </select>

                {selectedProduct && (
                  <div
                    style={{
                      marginTop: 16,
                      display:
                        "flex",
                      gap: 14,
                      alignItems:
                        "center",
                      padding: 14,
                      background:
                        "#f8faf9",
                      border:
                        "1px solid #e6ebe8",
                      borderRadius: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 82,
                        height: 82,
                        minWidth: 82,
                        borderRadius: 14,
                        background:
                          "#fff",
                        border:
                          "1px solid #e1e7e3",
                        overflow:
                          "hidden",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        flexShrink: 0,
                      }}
                    >
                      {selectedProduct.image_url ? (
                        <img
                          src={
                            selectedProduct.image_url
                          }
                          alt={
                            selectedProduct.name
                          }
                          style={{
                            width:
                              "100%",
                            height:
                              "100%",
                            objectFit:
                              "contain",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 28,
                          }}
                        >
                          📦
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 17,
                          marginBottom: 6,
                        }}
                      >
                        {
                          selectedProduct.name
                        }
                      </div>

                      <div
                        style={{
                          color:
                            "#66736d",
                          fontSize: 13,
                          marginBottom: 8,
                        }}
                      >
                        {selectedProduct.brand ||
                          "بدون علامة"}{" "}
                        {selectedProduct.category
                          ? `• ${selectedProduct.category}`
                          : ""}
                      </div>

                      {(() => {
                        const status =
                          getProductStatus(
                            selectedProduct
                          );

                        return (
                          <StatusBadge
                            type={
                              status.type
                            }
                          >
                            {
                              status.icon
                            }{" "}
                            {
                              status.text
                            }
                          </StatusBadge>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div
                className="design-card"
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin:
                      "0 0 14px",
                    fontSize: 19,
                  }}
                >
                  2. نوع التصميم
                </h2>

                <div
                  className="mode-grid"
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <ModeButton
                    active={
                      mode ===
                      "simple"
                    }
                    onClick={() =>
                      setMode(
                        "simple"
                      )
                    }
                    icon="⚡"
                    title="عادي وسريع"
                    description="قوالب جاهزة وتصميم سريع"
                  />

                  <ModeButton
                    active={
                      mode ===
                      "professional"
                    }
                    onClick={() =>
                      setMode(
                        "professional"
                      )
                    }
                    icon="💎"
                    title="احترافي"
                    description="وصف حر وتحكم أكبر بالتصميم"
                  />
                </div>
              </div>

              {mode ===
                "simple" && (
                <div
                  className="design-card"
                  style={{
                    background:
                      "#fff",
                    border:
                      "1px solid #e1e7e3",
                    borderRadius: 20,
                    padding: 20,
                    marginBottom: 18,
                  }}
                >
                  <h2
                    style={{
                      margin:
                        "0 0 6px",
                      fontSize: 19,
                    }}
                  >
                    3. اختر قالباً
                  </h2>

                  <p
                    style={{
                      color:
                        "#66736d",
                      fontSize: 13,
                      margin:
                        "0 0 16px",
                      lineHeight: 1.7,
                    }}
                  >
                    اختر الشكل المناسب للإعلان.
                  </p>

                  <div
                    className="template-grid"
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: 12,
                    }}
                  >
                    {TEMPLATES.map(
                      (
                        template
                      ) => {
                        const active =
                          selectedTemplate ===
                          template.id;

                        return (
                          <ChoiceButton
                            key={
                              template.id
                            }
                            active={
                              active
                            }
                            onClick={() =>
                              setSelectedTemplate(
                                template.id
                              )
                            }
                            icon={
                              template.icon
                            }
                            title={
                              template.title
                            }
                            description={
                              template.description
                            }
                          />
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {mode ===
                "professional" && (
                <div
                  className="design-card"
                  style={{
                    background:
                      "#fff",
                    border:
                      "1px solid #e1e7e3",
                    borderRadius: 20,
                    padding: 20,
                    marginBottom: 18,
                  }}
                >
                  <h2
                    style={{
                      margin:
                        "0 0 6px",
                      fontSize: 19,
                    }}
                  >
                    3. إعداد التصميم
                  </h2>

                  <textarea
                    value={
                      description
                    }
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    placeholder="مثال: أبغي خلفية سوداء فخمة، المنتج في المنتصف وواضح، إضاءة زرقاء خفيفة من الخلف، شعار المحل فوق، والسعر 299 درهم بشكل أنيق."
                    style={{
                      width:
                        "100%",
                      minHeight: 150,
                      resize:
                        "vertical",
                      padding: 15,
                      borderRadius: 14,
                      border:
                        "1px solid #cfd8d3",
                      fontSize: 15,
                      lineHeight: 1.8,
                      boxSizing:
                        "border-box",
                      fontFamily:
                        "inherit",
                    }}
                  />

                  <div
                    style={{
                      marginTop: 18,
                      fontWeight: 900,
                      marginBottom: 10,
                    }}
                  >
                    الستايل
                  </div>

                  <div
                    className="style-grid"
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    {STYLES.map(
                      (style) => {
                        const active =
                          selectedStyle ===
                          style.id;

                        return (
                          <button
                            key={
                              style.id
                            }
                            type="button"
                            onClick={() =>
                              setSelectedStyle(
                                style.id
                              )
                            }
                            style={{
                              padding:
                                "11px 10px",
                              borderRadius: 12,
                              cursor:
                                "pointer",
                              background:
                                active
                                  ? "#f0fdf4"
                                  : "#fff",
                              border:
                                active
                                  ? "2px solid #16a34a"
                                  : "1px solid #d9e1dc",
                              fontWeight: 800,
                              minHeight: 45,
                            }}
                          >
                            {
                              style.icon
                            }{" "}
                            {
                              style.title
                            }
                          </button>
                        );
                      }
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      fontWeight: 900,
                      marginBottom: 10,
                    }}
                  >
                    الخلفية
                  </div>

                  <div
                    className="background-grid"
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    {BACKGROUNDS.map(
                      (
                        background
                      ) => {
                        const active =
                          selectedBackground ===
                          background.id;

                        return (
                          <button
                            key={
                              background.id
                            }
                            type="button"
                            onClick={() =>
                              setSelectedBackground(
                                background.id
                              )
                            }
                            style={{
                              padding:
                                "12px 10px",
                              borderRadius: 12,
                              cursor:
                                "pointer",
                              background:
                                active
                                  ? "#f0fdf4"
                                  : "#fff",
                              border:
                                active
                                  ? "2px solid #16a34a"
                                  : "1px solid #d9e1dc",
                              fontWeight: 800,
                              minHeight: 45,
                            }}
                          >
                            {
                              background.title
                            }
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              <div
                className="design-card"
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin:
                      "0 0 14px",
                    fontSize: 19,
                  }}
                >
                  4. مقاس الإعلان
                </h2>

                <div
                  className="format-grid"
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {FORMATS.map(
                    (format) => {
                      const active =
                        selectedFormat ===
                        format.id;

                      return (
                        <ChoiceButton
                          key={
                            format.id
                          }
                          active={
                            active
                          }
                          onClick={() =>
                            setSelectedFormat(
                              format.id
                            )
                          }
                          icon={
                            format.icon
                          }
                          title={
                            format.title
                          }
                          description={
                            format.description
                          }
                        />
                      );
                    }
                  )}
                </div>
              </div>

              {selectedProductUnclear &&
                selectedProduct && (
                  <div
                    style={{
                      background:
                        "#fffbeb",
                      border:
                        "1px solid #fedf89",
                      borderRadius: 18,
                      padding: 18,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "flex-start",
                        gap: 12,
                      }}
                    >
                      <IconBox
                        size={42}
                        background="#fef3c7"
                        color="#92400e"
                      >
                        🟡
                      </IconBox>

                      <div
                        style={{
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            color:
                              "#92400e",
                            marginBottom: 7,
                          }}
                        >
                          يحتاج تأكيد المنتج
                        </div>

                        <div
                          style={{
                            color:
                              "#92400e",
                            fontSize: 13,
                            lineHeight: 1.8,
                            marginBottom: 12,
                          }}
                        >
                          بعض معلومات المنتج غير مكتملة أو لم يتم التحقق منها بشكل كافٍ. يمكنك المتابعة بعد تأكيد مسؤوليتك عن صحة معلومات المنتج ومشروعيته.
                        </div>

                        {!responsibilityAccepted ? (
                          <button
                            type="button"
                            onClick={
                              acceptResponsibility
                            }
                            disabled={
                              saving
                            }
                            style={{
                              background:
                                "#15803d",
                              color:
                                "#fff",
                              border: 0,
                              borderRadius: 11,
                              padding:
                                "11px 15px",
                              cursor:
                                saving
                                  ? "not-allowed"
                                  : "pointer",
                              fontWeight: 900,
                            }}
                          >
                            {saving
                              ? "جاري الحفظ..."
                              : "☑️ أؤكد المسؤولية ويمكنني المتابعة"}
                          </button>
                        ) : (
                          <StatusBadge type="ready">
                            ✓ تم تأكيد المسؤولية
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              <button
                type="button"
                onClick={createDesign}
                disabled={
                  saving ||
                  !selectedProduct ||
                  selectedProductLocked ||
                  (selectedProductUnclear &&
                    !responsibilityAccepted)
                }
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 16,
                  padding: 17,
                  background:
                    saving ||
                    !selectedProduct ||
                    selectedProductLocked ||
                    (selectedProductUnclear &&
                      !responsibilityAccepted)
                      ? "#aab5ae"
                      : "#15803d",
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: 900,
                  cursor:
                    saving ||
                    !selectedProduct ||
                    selectedProductLocked ||
                    (selectedProductUnclear &&
                      !responsibilityAccepted)
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "جاري تجهيز التصميم..."
                  : "🎨 إنشاء التصميم"}
              </button>
            </section>

            <aside>
              <div
                className="design-card"
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 18,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowIdentity(
                      !showIdentity
                    )
                  }
                  style={{
                    width: "100%",
                    border: 0,
                    background:
                      "transparent",
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    cursor:
                      "pointer",
                    padding: 0,
                    color:
                      "#17201c",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 17,
                    }}
                  >
                    🏪 هوية المحل
                  </span>

                  <span>
                    {showIdentity
                      ? "⌃"
                      : "⌄"}
                  </span>
                </button>

                {showIdentity &&
                  shop && (
                    <div
                      style={{
                        marginTop: 16,
                      }}
                    >
                      {shop.logo_url && (
                        <div
                          style={{
                            width: 70,
                            height: 70,
                            borderRadius: 15,
                            overflow:
                              "hidden",
                            border:
                              "1px solid #e1e7e3",
                            marginBottom: 12,
                          }}
                        >
                          <img
                            src={
                              shop.logo_url
                            }
                            alt={
                              shop.name
                            }
                            style={{
                              width:
                                "100%",
                              height:
                                "100%",
                              objectFit:
                                "contain",
                            }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 18,
                        }}
                      >
                        {shop.name}
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          display:
                            "grid",
                          gap: 8,
                          color:
                            "#66736d",
                          fontSize: 13,
                        }}
                      >
                        {shop.phone && (
                          <div>
                            ☎️{" "}
                            {shop.phone}
                          </div>
                        )}

                        {shop.whatsapp && (
                          <div>
                            💬{" "}
                            {shop.whatsapp}
                          </div>
                        )}

                        {shop.instagram && (
                          <div>
                            📸{" "}
                            {shop.instagram}
                          </div>
                        )}

                        {shop.tiktok && (
                          <div>
                            🎵{" "}
                            {shop.tiktok}
                          </div>
                        )}

                        {shop.snapchat && (
                          <div>
                            👻{" "}
                            {shop.snapchat}
                          </div>
                        )}

                        {shop.website && (
                          <div>
                            🌐{" "}
                            {shop.website}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <div
                className="design-card"
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e1e7e3",
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 18,
                }}
              >
                <h3
                  style={{
                    margin:
                      "0 0 14px",
                    fontSize: 17,
                  }}
                >
                  🛡️ قواعد التصميم
                </h3>

                <div
                  style={{
                    display:
                      "grid",
                    gap: 11,
                    color:
                      "#56625c",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    ✓ المنتج هو محور الإعلان
                  </div>

                  <div>
                    ✓ الحفاظ على هوية المنتج الأصلية
                  </div>

                  <div>
                    ✓ عدم اختراع معلومات عن المنتج
                  </div>

                  <div>
                    ✓ استخدام هوية المحل
                  </div>

                  <div>
                    ✓ التصميم موجه للإعلان والنشر
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>

      <style jsx>{`
        button {
          font-family: Arial, sans-serif;
          -webkit-tap-highlight-color: transparent;
        }

        @media (max-width: 900px) {
          .design-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 650px) {
          .mode-grid,
          .template-grid,
          .format-grid {
            grid-template-columns: 1fr !important;
          }

          .style-grid,
          .background-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            ) !important;
          }

          .design-card {
            padding: 16px !important;
            border-radius: 17px !important;
          }
        }

        @media (max-width: 420px) {
          .style-grid,
          .background-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================================================
   الصفحة الرئيسية + Suspense
========================================================= */

export default function DesignsPage() {
  return (
    <Suspense
      fallback={
        <main
          dir="rtl"
          style={{
            minHeight: "100vh",
            background: "#f6f8f7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily:
              "Arial, sans-serif",
            color: "#17201c",
          }}
        >
          جاري تحميل استوديو التصميم...
        </main>
      }
    >
      <DesignsPageContent />
    </Suspense>
  );
}

function DesignCard({
  design,
  product,
  status,
  onOpen,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border:
          "1px solid #e1e7e3",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow:
          "0 5px 20px rgba(0,0,0,0.04)",
      }}
    >
      {design.status ===
        "completed" &&
      design.image_url ? (
        <div
          style={{
            height: 260,
            background: "#f5f7f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <img
            src={design.image_url}
            alt={
              product?.name ||
              "التصميم"
            }
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 12,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            height: 260,
            background: "#f8faf9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7a857f",
            fontSize: 14,
          }}
        >
          {design.status ===
          "failed"
            ? "❌ تعذر إنشاء التصميم"
            : "⏳ جاري تجهيز التصميم..."}
        </div>
      )}

      <div
        style={{
          padding: 17,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              minWidth: 0,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 17,
                lineHeight: 1.5,
              }}
            >
              {product?.name ||
                "منتج"}
            </h3>

            {product?.brand && (
              <div
                style={{
                  color:
                    "#66736d",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {product.brand}
              </div>
            )}
          </div>

          <StatusBadge
            type={status.type}
          >
            {status.icon}{" "}
            {status.text}
          </StatusBadge>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: 8,
            marginBottom: 13,
          }}
        >
          <InfoMini
            title="المقاس"
            value={
              design.format ||
              "1:1"
            }
          />

          <InfoMini
            title="التاريخ"
            value={
              design.created_at
                ? new Date(
                    design.created_at
                  ).toLocaleDateString(
                    "ar-AE"
                  )
                : "—"
            }
          />
        </div>

        <button
          type="button"
          onClick={onOpen}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 11,
            padding: 12,
            background:
              "#15803d",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          👁️ عرض التصميم
        </button>

        {design.status ===
          "completed" &&
          design.image_url && (
            <a
              href={
                design.image_url
              }
              download
              style={{
                display:
                  "block",
                textAlign:
                  "center",
                marginTop: 8,
                padding: 11,
                borderRadius: 11,
                background:
                  "#f0fdf4",
                color:
                  "#166534",
                border:
                  "1px solid #bbf7d0",
                textDecoration:
                  "none",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              ⬇️ تحميل التصميم
            </a>
          )}
      </div>
    </div>
  );
}

function InfoMini({
  title,
  value,
}) {
  return (
    <div
      style={{
        background:
          "#f8faf9",
        borderRadius: 10,
        padding: 9,
      }}
    >
      <div
        style={{
          color: "#7a857f",
          fontSize: 11,
          marginBottom: 3,
        }}
      >
        {title}
      </div>

      <strong
        style={{
          fontSize: 12,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border:
          "1px solid #e1e7e3",
        borderRadius: 16,
        padding: 15,
      }}
    >
      <div
        style={{
          fontSize: 22,
          marginBottom: 7,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#66736d",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#17201c",
          fontSize: 23,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  text,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding:
          "11px 13px",
        borderRadius: 11,
        border: active
          ? "1px solid #15803d"
          : "1px solid #e5e7eb",
        background: active
          ? "#15803d"
          : "#fff",
        color: active
          ? "#fff"
          : "#374151",
        fontSize: 13,
        fontWeight: "bold",
        cursor: "pointer",
        whiteSpace:
          "nowrap",
      }}
    >
      {text}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  title,
  description,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "right",
        padding: 16,
        borderRadius: 16,
        cursor: "pointer",
        background: active
          ? "#f0fdf4"
          : "#fff",
        border: active
          ? "2px solid #16a34a"
          : "1px solid #d9e1dc",
        display: "flex",
        alignItems:
          "flex-start",
        gap: 13,
        minHeight: 102,
        boxSizing:
          "border-box",
      }}
    >
      <IconBox size={46}>
        {icon}
      </IconBox>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 17,
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: "#66736d",
            fontSize: 13,
            marginTop: 5,
            lineHeight: 1.6,
          }}
        >
          {description}
        </div>
      </div>
    </button>
  );
}

function ChoiceButton({
  active,
  onClick,
  icon,
  title,
  description,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "right",
        background: active
          ? "#f0fdf4"
          : "#fff",
        border: active
          ? "2px solid #16a34a"
          : "1px solid #d9e1dc",
        borderRadius: 15,
        padding: 14,
        cursor: "pointer",
        display: "flex",
        alignItems:
          "flex-start",
        gap: 12,
        minHeight: 82,
        boxSizing:
          "border-box",
      }}
    >
      <IconBox
        size={44}
        background={
          active
            ? "#dcfce7"
            : "#f5f7f6"
        }
      >
        {icon}
      </IconBox>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>

        {description && (
          <div
            style={{
              color:
                "#66736d",
              fontSize: 12,
              lineHeight: 1.6,
              marginTop: 4,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </button>
  );
}
