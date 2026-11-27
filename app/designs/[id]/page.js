"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { createClient } from "../../../lib/supabase/client";

// =========================================================
// Constants
// =========================================================

const TEMPLATES = [
  {
    id: "product",
    icon: "🛍️",
    title: "عرض منتج",
    description: "منتج واضح مع اسم المنتج وهوية المحل",
  },
  {
    id: "discount",
    icon: "💰",
    title: "خصم وسعر",
    description: "تركيز على السعر أو الخصم",
  },
  {
    id: "new-product",
    icon: "🆕",
    title: "منتج جديد",
    description: "إعلان إطلاق منتج جديد",
  },
  {
    id: "best-seller",
    icon: "⭐",
    title: "الأكثر مبيعاً",
    description: "إبراز منتج مميز أو مشهور",
  },
  {
    id: "special-offer",
    icon: "🔥",
    title: "عرض خاص",
    description: "تصميم قوي للعروض والمناسبات",
  },
  {
    id: "simple-ad",
    icon: "📢",
    title: "إعلان بسيط",
    description: "تصميم نظيف وسريع",
  },
  {
    id: "social",
    icon: "📱",
    title: "إعلان سوشيال",
    description: "تصميم جاهز للنشر على السوشيال",
  },
  {
    id: "luxury",
    icon: "✨",
    title: "فاخر",
    description: "شكل أنيق ومناسب للمنتجات الفاخرة",
  },
];

const FORMATS = [
  {
    id: "1:1",
    icon: "▣",
    title: "منشور مربع",
    description: "مناسب لمنشورات Instagram",
  },
  {
    id: "4:5",
    icon: "▯",
    title: "منشور عمودي",
    description: "مناسب للإعلانات والمنشورات",
  },
  {
    id: "9:16",
    icon: "▥",
    title: "ستوري",
    description: "Instagram / Snapchat / TikTok",
  },
  {
    id: "16:9",
    icon: "▭",
    title: "أفقي",
    description: "شاشات وإعلانات أفقية",
  },
];

const STYLES = [
  "احترافي",
  "عصري",
  "فاخر",
  "بسيط",
  "جريء",
  "نظيف",
];

const BACKGROUNDS = [
  "نظيف",
  "فاتح",
  "داكن",
  "تدرج",
  "محايد",
];

const MODES = [
  {
    id: "simple",
    icon: "⚡",
    title: "عادي وسريع",
    description: "قوالب جاهزة وتصميم سريع",
  },
  {
    id: "professional",
    icon: "💎",
    title: "احترافي",
    description: "وصف حر وتحكم أكبر بالتصميم",
  },
];

// =========================================================
// Helpers
// =========================================================

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("ar-AE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function getStatus(status) {
  const value = String(status || "").toLowerCase();

  if (value === "completed" || value === "complete") {
    return {
      label: "✓ مكتمل",
      className: "status completed",
    };
  }

  if (
    value === "generating" ||
    value === "processing" ||
    value === "pending"
  ) {
    return {
      label: "⏳ قيد الإنشاء",
      className: "status processing",
    };
  }

  if (value === "failed" || value === "error") {
    return {
      label: "✕ فشل",
      className: "status failed",
    };
  }

  return {
    label: value || "غير محدد",
    className: "status",
  };
}

function normalizeSettings(design, product) {
  const settings =
    design?.design_settings &&
    typeof design.design_settings === "object"
      ? design.design_settings
      : {};

  return {
    template:
      settings.template ||
      settings.template_id ||
      design?.template ||
      "product",

    template_id:
      settings.template_id ||
      settings.template ||
      design?.template_id ||
      "product",

    mode:
      settings.mode ||
      design?.mode ||
      "simple",

    style:
      settings.style ||
      design?.style ||
      "احترافي",

    background:
      settings.background ||
      design?.background ||
      "نظيف",

    format:
      settings.format ||
      design?.format ||
      "1:1",

    title:
      settings.title ||
      product?.name ||
      "",

    price:
      settings.price === null ||
      settings.price === undefined
        ? product?.price ?? ""
        : settings.price,

    discount:
      settings.discount || "",

    cta:
      settings.cta || "",

    custom_text:
      settings.custom_text || "",
  };
}

// =========================================================
// Page
// =========================================================

function DesignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const designId = params?.id;

  const supabase = useMemo(() => createClient(), []);

  const [design, setDesign] = useState(null);
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editOpen, setEditOpen] = useState(false);

  const [editor, setEditor] = useState({
    template: "product",
    template_id: "product",
    mode: "simple",
    style: "احترافي",
    background: "نظيف",
    format: "1:1",
    title: "",
    price: "",
    discount: "",
    cta: "",
    custom_text: "",
  });

  // =======================================================
  // Load
  // =======================================================

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!designId) return;

      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: designData, error: designError } =
          await supabase
            .from("ad_images")
            .select("*")
            .eq("id", designId)
            .single();

        if (designError) {
          throw designError;
        }

        if (!designData) {
          throw new Error("التصميم غير موجود");
        }

        if (!designData.shop_id) {
          throw new Error("التصميم غير مرتبط بمحل");
        }

        const { data: shopData, error: shopError } =
          await supabase
            .from("shops")
            .select("*")
            .eq("id", designData.shop_id)
            .single();

        if (shopError) {
          throw shopError;
        }

        if (!shopData || shopData.owner_id !== user.id) {
          throw new Error(
            "غير مصرح لك بالوصول إلى هذا التصميم"
          );
        }

        if (!designData.product_id) {
          throw new Error(
            "التصميم غير مرتبط بمنتج"
          );
        }

        const { data: productData, error: productError } =
          await supabase
            .from("products")
            .select("*")
            .eq("id", designData.product_id)
            .eq("shop_id", designData.shop_id)
            .single();

        if (productError) {
          throw productError;
        }

        if (!mounted) return;

        setDesign(designData);
        setShop(shopData);
        setProduct(productData);

        setEditor(
          normalizeSettings(
            designData,
            productData
          )
        );
      } catch (loadError) {
        if (!mounted) return;

        setError(
          loadError?.message ||
            "تعذر تحميل التصميم."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [designId, router, supabase]);

  // =======================================================
  // Search params messages
  // =======================================================

  useEffect(() => {
    if (searchParams?.get("created") === "1") {
      setSuccess("تم إنشاء التصميم بنجاح.");
    }
  }, [searchParams]);

  // =======================================================
  // Editor helpers
  // =======================================================

  function updateEditor(key, value) {
    setEditor((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function selectTemplate(id) {
    updateEditor("template", id);
    updateEditor("template_id", id);
  }

  function selectMode(id) {
    updateEditor("mode", id);
  }

  function selectFormat(id) {
    updateEditor("format", id);
  }

  // =======================================================
  // Edit
  // =======================================================

  async function saveEdit() {
    if (!design || !product) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/edit-design",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            design_id: design.id,
            product_id: product.id,

            template: editor.template,
            template_id: editor.template_id,

            mode: editor.mode,
            style: editor.style,
            background: editor.background,
            format: editor.format,

            title:
              editor.title ||
              product.name,

            price:
              editor.price === ""
                ? null
                : Number(editor.price),

            discount:
              editor.discount || null,

            cta:
              editor.cta || null,

            custom_text:
              editor.custom_text || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error ||
            "تعذر تعديل التصميم."
        );
      }

      if (result.design) {
        setDesign(result.design);
      }

      if (result.image_url) {
        setDesign((current) => ({
          ...(current || {}),
          image_url: result.image_url,
          status: "completed",
          design_settings: {
            ...editor,
          },
        }));
      }

      setEditOpen(false);

      setSuccess(
        result.message ||
          "تم تعديل التصميم بنجاح."
      );
    } catch (saveError) {
      setError(
        saveError?.message ||
          "تعذر تعديل التصميم."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // Delete
  // =======================================================

  async function deleteDesign() {
    if (!design?.id || deleting) return;

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا التصميم؟"
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } =
        await supabase
          .from("ad_images")
          .delete()
          .eq("id", design.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/designs");
    } catch (deleteError) {
      setError(
        deleteError?.message ||
          "تعذر حذف التصميم."
      );
    } finally {
      setDeleting(false);
    }
  }

  // =======================================================
  // Download
  // =======================================================

  function downloadDesign() {
    if (!design?.image_url) return;

    const link =
      document.createElement("a");

    link.href = design.image_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    link.download =
      `${product?.name || "design"}-suq-ai`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // =======================================================
  // Share
  // =======================================================

  async function shareDesign() {
    if (!design?.image_url) return;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            product?.name ||
            "تصميم سوق AI",
          text:
            "تصميم من سوق AI",
          url: design.image_url,
        });

        return;
      }

      await navigator.clipboard.writeText(
        design.image_url
      );

      setSuccess(
        "تم نسخ رابط التصميم."
      );
    } catch {
      // User cancelled share.
    }
  }

  // =======================================================
  // Loading
  // =======================================================

  if (loading) {
    return (
      <>
        <style>{styles}</style>

        <main className="page">
          <div className="loadingCard">
            <div className="spinner" />
            <div>
              <strong>
                جاري تحميل التصميم
              </strong>
              <span>
                لحظات ونجهز لك التفاصيل...
              </span>
            </div>
          </div>
        </main>
      </>
    );
  }

  // =======================================================
  // Error
  // =======================================================

  if (error && !design) {
    return (
      <>
        <style>{styles}</style>

        <main className="page">
          <div className="errorCard">
            <div className="errorIcon">
              !
            </div>

            <h2>
              تعذر فتح التصميم
            </h2>

            <p>{error}</p>

            <button
              className="primaryButton"
              onClick={() =>
                router.push("/designs")
              }
            >
              العودة إلى مركز التصاميم
            </button>
          </div>
        </main>
      </>
    );
  }

  const status = getStatus(
    design?.status
  );

  const isGenerating =
    String(design?.status || "")
      .toLowerCase() ===
      "generating";

  const productNeedsConfirmation =
    String(
      product?.safety_status || ""
    ).toLowerCase() === "review" ||
    String(
      product?.verification_status || ""
    ).toLowerCase() === "unverified" ||
    String(
      product?.verification_status || ""
    ).toLowerCase() === "review";

  return (
    <>
      <style>{styles}</style>

      <main className="page">
        {/* =================================================
            Header
        ================================================= */}

        <header className="topbar">
          <button
            className="backButton"
            onClick={() =>
              router.push("/designs")
            }
          >
            ←
            <span>
              مركز التصاميم
            </span>
          </button>

          <div className="brand">
            <div className="brandMark">
              AI
            </div>

            <div>
              <strong>
                مركز التصاميم
              </strong>

              <span>
                سوق AI
              </span>
            </div>
          </div>
        </header>

        {/* =================================================
            Messages
        ================================================= */}

        {error && (
          <div className="message errorMessage">
            <span>⚠️</span>
            <span>{error}</span>
            <button
              onClick={() =>
                setError("")
              }
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="message successMessage">
            <span>✓</span>
            <span>{success}</span>
            <button
              onClick={() =>
                setSuccess("")
              }
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            Main
        ================================================= */}

        <section className="layout">
          {/* Preview */}
          <div className="previewColumn">
            <div className="previewCard">
              <div className="previewHeader">
                <div>
                  <span className="eyebrow">
                    تصميم المنتج
                  </span>

                  <h1>
                    {product?.name ||
                      "تصميم"}
                  </h1>
                </div>

                <span
                  className={
                    status.className
                  }
                >
                  {status.label}
                </span>
              </div>

              <div className="imageFrame">
                {design?.image_url ? (
                  <img
                    src={
                      design.image_url
                    }
                    alt={
                      product?.name ||
                      "تصميم المنتج"
                    }
                  />
                ) : (
                  <div className="emptyImage">
                    <span>
                      🎨
                    </span>
                    <p>
                      لا توجد صورة للتصميم
                    </p>
                  </div>
                )}

                {isGenerating && (
                  <div className="imageOverlay">
                    <div className="spinner light" />
                    <strong>
                      جاري إنشاء التصميم
                    </strong>
                  </div>
                )}
              </div>

              <div className="previewActions">
                <button
                  className="primaryButton"
                  onClick={() =>
                    setEditOpen(true)
                  }
                  disabled={
                    saving ||
                    isGenerating
                  }
                >
                  ✏️ تعديل التصميم
                </button>

                <button
                  className="secondaryButton"
                  onClick={
                    downloadDesign
                  }
                  disabled={
                    !design?.image_url
                  }
                >
                  ⬇️ تحميل
                </button>

                <button
                  className="secondaryButton"
                  onClick={shareDesign}
                  disabled={
                    !design?.image_url
                  }
                >
                  ↗️ مشاركة
                </button>
              </div>
            </div>

            {/* Product */}
            <div className="card">
              <div className="sectionTitle">
                <div>
                  <span className="sectionIcon">
                    📦
                  </span>
                  <div>
                    <h2>
                      المنتج
                    </h2>
                    <p>
                      المنتج المستخدم في التصميم
                    </p>
                  </div>
                </div>
              </div>

              <div className="productRow">
                <div className="productImage">
                  {product?.image_url ? (
                    <img
                      src={
                        product.image_url
                      }
                      alt={
                        product.name ||
                        "المنتج"
                      }
                    />
                  ) : (
                    "📦"
                  )}
                </div>

                <div className="productInfo">
                  <strong>
                    {product?.name ||
                      "—"}
                  </strong>

                  <span>
                    {product?.brand ||
                      "بدون علامة تجارية"}
                  </span>

                  <span>
                    {product?.category ||
                      "بدون تصنيف"}
                  </span>
                </div>

                {productNeedsConfirmation && (
                  <span className="warningBadge">
                    🟡 يحتاج تأكيد
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <aside className="detailsColumn">
            {/* Design info */}
            <div className="card">
              <div className="sectionTitle">
                <div>
                  <span className="sectionIcon">
                    🎨
                  </span>

                  <div>
                    <h2>
                      تفاصيل التصميم
                    </h2>

                    <p>
                      معلومات التصميم الحالي
                    </p>
                  </div>
                </div>
              </div>

              <div className="infoGrid">
                <div className="infoItem">
                  <span>
                    الحالة
                  </span>
                  <strong>
                    {status.label}
                  </strong>
                </div>

                <div className="infoItem">
                  <span>
                    المقاس
                  </span>
                  <strong>
                    {
                      editor.format
                    }
                  </strong>
                </div>

                <div className="infoItem">
                  <span>
                    التاريخ
                  </span>
                  <strong>
                    {formatDate(
                      design?.created_at
                    )}
                  </strong>
                </div>

                <div className="infoItem">
                  <span>
                    التعديل
                  </span>
                  <strong>
                    1 نقطة
                  </strong>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="card">
              <div className="sectionTitle">
                <div>
                  <span className="sectionIcon">
                    ⚙️
                  </span>

                  <div>
                    <h2>
                      إعدادات التصميم
                    </h2>

                    <p>
                      الإعدادات المحفوظة
                    </p>
                  </div>
                </div>
              </div>

              <div className="settingsList">
                <div>
                  <span>
                    القالب
                  </span>

                  <strong>
                    {
                      TEMPLATES.find(
                        (item) =>
                          item.id ===
                          editor.template
                      )?.title ||
                      editor.template
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    النوع
                  </span>

                  <strong>
                    {
                      MODES.find(
                        (item) =>
                          item.id ===
                          editor.mode
                      )?.title ||
                      editor.mode
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    الأسلوب
                  </span>

                  <strong>
                    {editor.style}
                  </strong>
                </div>

                <div>
                  <span>
                    الخلفية
                  </span>

                  <strong>
                    {
                      editor.background
                    }
                  </strong>
                </div>
              </div>
            </div>

            {/* Shop */}
            <div className="card">
              <div className="sectionTitle">
                <div>
                  <span className="sectionIcon">
                    🏪
                  </span>

                  <div>
                    <h2>
                      هوية المحل
                    </h2>

                    <p>
                      بيانات المحل المستخدمة
                    </p>
                  </div>
                </div>
              </div>

              <div className="shopIdentity">
                <div className="shopLogo">
                  {shop?.logo_url ? (
                    <img
                      src={
                        shop.logo_url
                      }
                      alt={
                        shop.name ||
                        "المحل"
                      }
                    />
                  ) : (
                    "🏪"
                  )}
                </div>

                <div>
                  <strong>
                    {shop?.name ||
                      "—"}
                  </strong>

                  {shop?.phone && (
                    <span>
                      ☎️ {shop.phone}
                    </span>
                  )}

                  {shop?.whatsapp && (
                    <span>
                      💬 {shop.whatsapp}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="card rulesCard">
              <div className="sectionTitle">
                <div>
                  <span className="sectionIcon">
                    🛡️
                  </span>

                  <div>
                    <h2>
                      قواعد التصميم
                    </h2>

                    <p>
                      الحماية الأساسية للمحتوى
                    </p>
                  </div>
                </div>
              </div>

              <ul>
                <li>
                  <span>✓</span>
                  المنتج هو محور الإعلان
                </li>

                <li>
                  <span>✓</span>
                  الحفاظ على هوية المنتج الأصلية
                </li>

                <li>
                  <span>✓</span>
                  عدم اختراع معلومات عن المنتج
                </li>

                <li>
                  <span>✓</span>
                  استخدام هوية المحل
                </li>

                <li>
                  <span>✓</span>
                  التصميم موجه للإعلان والنشر
                </li>
              </ul>
            </div>

            {/* Danger */}
            <div className="card dangerCard">
              <div>
                <strong>
                  حذف التصميم
                </strong>

                <span>
                  حذف التصميم من مركز التصاميم.
                </span>
              </div>

              <button
                className="dangerButton"
                onClick={
                  deleteDesign
                }
                disabled={
                  deleting ||
                  isGenerating
                }
              >
                {deleting
                  ? "جاري الحذف..."
                  : "حذف"}
              </button>
            </div>
          </aside>
        </section>

        {/* =================================================
            Edit Drawer
        ================================================= */}

        {editOpen && (
          <div
            className="drawerBackdrop"
            onClick={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setEditOpen(false);
              }
            }}
          >
            <aside className="drawer">
              <div className="drawerHeader">
                <div>
                  <span className="eyebrow">
                    تعديل التصميم
                  </span>

                  <h2>
                    عدّل التصميم كما تريد
                  </h2>

                  <p>
                    سيتم إعادة إنشاء التصميم
                    باستخدام المنتج نفسه.
                  </p>
                </div>

                <button
                  className="closeButton"
                  onClick={() =>
                    setEditOpen(false)
                  }
                  disabled={saving}
                >
                  ×
                </button>
              </div>

              <div className="drawerBody">
                {/* Product reminder */}
                <div className="editProduct">
                  <div className="editProductImage">
                    {product?.image_url ? (
                      <img
                        src={
                          product.image_url
                        }
                        alt={
                          product.name ||
                          "المنتج"
                        }
                      />
                    ) : (
                      "📦"
                    )}
                  </div>

                  <div>
                    <strong>
                      {product?.name ||
                        "المنتج"}
                    </strong>

                    <span>
                      المنتج الأصلي محفوظ
                    </span>
                  </div>
                </div>

                {/* Mode */}
                <section className="editorSection">
                  <div className="editorHeading">
                    <span>
                      1
                    </span>

                    <div>
                      <strong>
                        نوع التصميم
                      </strong>

                      <small>
                        اختر طريقة التصميم
                      </small>
                    </div>
                  </div>

                  <div className="modeGrid">
                    {MODES.map(
                      (mode) => (
                        <button
                          key={
                            mode.id
                          }
                          className={
                            editor.mode ===
                            mode.id
                              ? "modeOption selected"
                              : "modeOption"
                          }
                          onClick={() =>
                            selectMode(
                              mode.id
                            )
                          }
                          type="button"
                        >
                          <span>
                            {
                              mode.icon
                            }
                          </span>

                          <strong>
                            {
                              mode.title
                            }
                          </strong>

                          <small>
                            {
                              mode.description
                            }
                          </small>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* Template */}
                <section className="editorSection">
                  <div className="editorHeading">
                    <span>
                      2
                    </span>

                    <div>
                      <strong>
                        القالب
                      </strong>

                      <small>
                        اختر الشكل المناسب للإعلان
                      </small>
                    </div>
                  </div>

                  <div className="templateGrid">
                    {TEMPLATES.map(
                      (template) => (
                        <button
                          key={
                            template.id
                          }
                          type="button"
                          className={
                            editor.template ===
                            template.id
                              ? "templateOption selected"
                              : "templateOption"
                          }
                          onClick={() =>
                            selectTemplate(
                              template.id
                            )
                          }
                        >
                          <span className="templateIcon">
                            {
                              template.icon
                            }
                          </span>

                          <span>
                            <strong>
                              {
                                template.title
                              }
                            </strong>

                            <small>
                              {
                                template.description
                              }
                            </small>
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* Format */}
                <section className="editorSection">
                  <div className="editorHeading">
                    <span>
                      3
                    </span>

                    <div>
                      <strong>
                        مقاس الإعلان
                      </strong>

                      <small>
                        اختر المقاس المناسب
                      </small>
                    </div>
                  </div>

                  <div className="formatGrid">
                    {FORMATS.map(
                      (format) => (
                        <button
                          key={
                            format.id
                          }
                          type="button"
                          className={
                            editor.format ===
                            format.id
                              ? "formatOption selected"
                              : "formatOption"
                          }
                          onClick={() =>
                            selectFormat(
                              format.id
                            )
                          }
                        >
                          <span>
                            {
                              format.icon
                            }
                          </span>

                          <strong>
                            {
                              format.title
                            }
                          </strong>

                          <small>
                            {
                              format.description
                            }
                          </small>

                          <b>
                            {
                              format.id
                            }
                          </b>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* Style */}
                <section className="editorSection">
                  <div className="editorHeading">
                    <span>
                      4
                    </span>

                    <div>
                      <strong>
                        الأسلوب والخلفية
                      </strong>

                      <small>
                        تحكم في شكل الإعلان
                      </small>
                    </div>
                  </div>

                  <label className="field">
                    <span>
                      الأسلوب
                    </span>

                    <select
                      value={
                        editor.style
                      }
                      onChange={(event) =>
                        updateEditor(
                          "style",
                          event.target.value
                        )
                      }
                    >
                      {STYLES.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="field">
                    <span>
                      الخلفية
                    </span>

                    <select
                      value={
                        editor.background
                      }
                      onChange={(event) =>
                        updateEditor(
                          "background",
                          event.target.value
                        )
                      }
                    >
                      {BACKGROUNDS.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </section>

                {/* Content */}
                <section className="editorSection">
                  <div className="editorHeading">
                    <span>
                      5
                    </span>

                    <div>
                      <strong>
                        محتوى الإعلان
                      </strong>

                      <small>
                        النصوص الاختيارية
                      </small>
                    </div>
                  </div>

                  <label className="field">
                    <span>
                      العنوان
                    </span>

                    <input
                      type="text"
                      value={
                        editor.title
                      }
                      onChange={(event) =>
                        updateEditor(
                          "title",
                          event.target.value
                        )
                      }
                      placeholder={
                        product?.name ||
                        "اسم المنتج"
                      }
                    />
                  </label>

                  <div className="twoFields">
                    <label className="field">
                      <span>
                        السعر
                      </span>

                      <input
                        type="number"
                        inputMode="decimal"
                        value={
                          editor.price
                        }
                        onChange={(event) =>
                          updateEditor(
                            "price",
                            event.target.value
                          )
                        }
                        placeholder="مثال: 99"
                      />
                    </label>

                    <label className="field">
                      <span>
                        الخصم
                      </span>

                      <input
                        type="text"
                        value={
                          editor.discount
                        }
                        onChange={(event) =>
                          updateEditor(
                            "discount",
                            event.target.value
                          )
                        }
                        placeholder="مثال: 20%"
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>
                      زر الإجراء CTA
                    </span>

                    <input
                      type="text"
                      value={
                        editor.cta
                      }
                      onChange={(event) =>
                        updateEditor(
                          "cta",
                          event.target.value
                        )
                      }
                      placeholder="اطلب الآن"
                    />
                  </label>

                  <label className="field">
                    <span>
                      نص إضافي
                    </span>

                    <textarea
                      value={
                        editor.custom_text
                      }
                      onChange={(event) =>
                        updateEditor(
                          "custom_text",
                          event.target.value
                        )
                      }
                      placeholder="اكتب أي رسالة إضافية للإعلان..."
                      rows={4}
                    />
                  </label>
                </section>

                {/* Responsibility */}
                {productNeedsConfirmation && (
                  <div className="responsibilityBox">
                    <div>
                      <strong>
                        🟡 المنتج يحتاج تأكيد
                      </strong>

                      <p>
                        بعض معلومات المنتج غير مكتملة
                        أو لم يتم التحقق منها بشكل كافٍ.
                        يمكنك المتابعة فقط بعد تأكيد
                        مسؤوليتك عن صحة معلومات المنتج
                        ومشروعيته.
                      </p>
                    </div>
                  </div>
                )}

                {/* Cost */}
                <div className="costBox">
                  <div>
                    <span>
                      تكلفة التعديل
                    </span>

                    <strong>
                      1 نقطة
                    </strong>
                  </div>

                  <small>
                    إذا فشل التعديل بعد الخصم،
                    يتم استرجاع النقطة تلقائيًا.
                  </small>
                </div>
              </div>

              <div className="drawerFooter">
                <button
                  className="secondaryButton large"
                  onClick={() =>
                    setEditOpen(false)
                  }
                  disabled={saving}
                >
                  إلغاء
                </button>

                <button
                  className="primaryButton large"
                  onClick={saveEdit}
                  disabled={
                    saving ||
                    isGenerating
                  }
                >
                  {saving ? (
                    <>
                      <span className="buttonSpinner" />
                      جاري التعديل...
                    </>
                  ) : (
                    <>
                      🎨 حفظ وتعديل
                    </>
                  )}
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}

// =========================================================
// Suspense wrapper
// =========================================================

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          جاري التحميل...
        </div>
      }
    >
      <DesignDetailsPage />
    </Suspense>
  );
}

// =========================================================
// Styles
// =========================================================

const styles = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #f5f7f6;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: .55;
  }

  .page {
    min-height: 100vh;
    background:
      radial-gradient(
        circle at top right,
        rgba(22, 163, 74, .06),
        transparent 28%
      ),
      #f5f7f6;
    color: #17221b;
    padding: 0 18px 60px;
    direction: rtl;
  }

  .topbar {
    max-width: 1320px;
    margin: 0 auto;
    min-height: 76px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid #e4e9e5;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .brandMark {
    width: 42px;
    height: 42px;
    border-radius: 13px;
    display: grid;
    place-items: center;
    background: #16803b;
    color: #fff;
    font-weight: 900;
    font-size: 13px;
    box-shadow: 0 8px 20px rgba(22, 128, 59, .18);
  }

  .brand div:last-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand strong {
    font-size: 15px;
  }

  .brand span {
    color: #7a867f;
    font-size: 12px;
  }

  .backButton {
    border: 0;
    background: transparent;
    color: #26352c;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    padding: 10px 0;
  }

  .message {
    max-width: 1320px;
    margin: 18px auto 0;
    border-radius: 14px;
    padding: 13px 15px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .message button {
    margin-right: auto;
    border: 0;
    background: transparent;
    font-size: 20px;
  }

  .errorMessage {
    background: #fff1f1;
    border: 1px solid #ffd4d4;
    color: #9d2222;
  }

  .successMessage {
    background: #effaf2;
    border: 1px solid #cdebd5;
    color: #176b35;
  }

  .layout {
    max-width: 1320px;
    margin: 24px auto 0;
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
    gap: 22px;
    align-items: start;
  }

  .previewColumn,
  .detailsColumn {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .previewCard,
  .card,
  .loadingCard,
  .errorCard {
    background: #fff;
    border: 1px solid #e3e8e4;
    border-radius: 20px;
    box-shadow: 0 8px 30px rgba(22, 35, 27, .045);
  }

  .previewCard {
    padding: 18px;
  }

  .previewHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 16px;
  }

  .eyebrow {
    color: #16803b;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .02em;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  .previewHeader h1 {
    margin-top: 4px;
    font-size: 22px;
  }

  .status {
    padding: 7px 11px;
    border-radius: 999px;
    background: #f0f2f1;
    color: #5e6862;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status.completed {
    background: #eaf8ee;
    color: #18743a;
  }

  .status.processing {
    background: #fff7df;
    color: #8a6613;
  }

  .status.failed {
    background: #fff0f0;
    color: #a12828;
  }

  .imageFrame {
    position: relative;
    width: 100%;
    min-height: 420px;
    max-height: 720px;
    border-radius: 17px;
    background: #f0f3f1;
    overflow: hidden;
    display: grid;
    place-items: center;
  }

  .imageFrame img {
    width: 100%;
    height: 100%;
    max-height: 720px;
    object-fit: contain;
    display: block;
  }

  .emptyImage {
    text-align: center;
    color: #7b867f;
  }

  .emptyImage span {
    font-size: 42px;
  }

  .emptyImage p {
    margin-top: 8px;
  }

  .imageOverlay {
    position: absolute;
    inset: 0;
    background: rgba(13, 27, 19, .72);
    color: #fff;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;
  }

  .previewActions {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }

  .primaryButton,
  .secondaryButton,
  .dangerButton {
    min-height: 45px;
    border-radius: 12px;
    padding: 0 15px;
    border: 1px solid transparent;
    font-weight: 900;
    transition: .15s ease;
  }

  .primaryButton {
    background: #16803b;
    color: #fff;
    box-shadow: 0 8px 18px rgba(22, 128, 59, .15);
  }

  .primaryButton:hover {
    background: #126b31;
  }

  .secondaryButton {
    background: #fff;
    color: #27332c;
    border-color: #dfe5e1;
  }

  .secondaryButton:hover {
    border-color: #b9c9be;
    background: #fafcfb;
  }

  .dangerButton {
    background: #fff4f4;
    border-color: #ffd3d3;
    color: #a52c2c;
  }

  .large {
    min-height: 48px;
  }

  .card {
    padding: 18px;
  }

  .sectionTitle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .sectionTitle > div {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sectionIcon {
    width: 37px;
    height: 37px;
    border-radius: 11px;
    background: #eff8f1;
    display: grid;
    place-items: center;
  }

  .sectionTitle h2 {
    font-size: 15px;
  }

  .sectionTitle p {
    color: #7b857f;
    font-size: 11px;
    margin-top: 3px;
  }

  .productRow {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .productImage {
    width: 64px;
    height: 64px;
    border-radius: 13px;
    background: #f2f4f3;
    overflow: hidden;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    font-size: 24px;
  }

  .productImage img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .productInfo {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .productInfo strong {
    font-size: 14px;
  }

  .productInfo span {
    font-size: 11px;
    color: #7c867f;
  }

  .warningBadge {
    margin-right: auto;
    padding: 6px 9px;
    border-radius: 999px;
    background: #fff7df;
    color: #806014;
    font-size: 10px;
    font-weight: 900;
    white-space: nowrap;
  }

  .infoGrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .infoItem {
    padding: 12px;
    border: 1px solid #edf0ee;
    border-radius: 12px;
    background: #fafcfb;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .infoItem span {
    color: #7c867f;
    font-size: 10px;
  }

  .infoItem strong {
    font-size: 12px;
  }

  .settingsList {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .settingsList > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 11px 0;
    border-bottom: 1px solid #edf0ee;
  }

  .settingsList > div:last-child {
    border-bottom: 0;
  }

  .settingsList span {
    color: #7b857f;
    font-size: 11px;
  }

  .settingsList strong {
    font-size: 12px;
  }

  .shopIdentity {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .shopLogo {
    width: 55px;
    height: 55px;
    border-radius: 14px;
    background: #eff8f1;
    overflow: hidden;
    display: grid;
    place-items: center;
    font-size: 22px;
  }

  .shopLogo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .shopIdentity > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .shopIdentity strong {
    font-size: 14px;
  }

  .shopIdentity span {
    color: #78837c;
    font-size: 11px;
  }

  .rulesCard ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .rulesCard li {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #536059;
    font-size: 11px;
  }

  .rulesCard li span {
    color: #16803b;
    font-weight: 900;
  }

  .dangerCard {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    border-color: #f0dddd;
  }

  .dangerCard > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .dangerCard strong {
    font-size: 13px;
  }

  .dangerCard span {
    color: #8b7777;
    font-size: 10px;
  }

  .loadingCard,
  .errorCard {
    max-width: 600px;
    margin: 80px auto;
    padding: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    text-align: center;
  }

  .loadingCard {
    min-height: 130px;
  }

  .loadingCard > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .loadingCard span {
    color: #7b857f;
    font-size: 12px;
  }

  .errorCard {
    flex-direction: column;
  }

  .errorCard h2 {
    font-size: 18px;
  }

  .errorCard p {
    color: #7a837e;
    font-size: 12px;
    line-height: 1.8;
  }

  .errorIcon {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #fff0f0;
    color: #a52c2c;
    font-weight: 900;
    font-size: 20px;
  }

  .spinner {
    width: 23px;
    height: 23px;
    border: 3px solid #dce7df;
    border-top-color: #16803b;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  .spinner.light {
    border-color: rgba(255,255,255,.25);
    border-top-color: #fff;
  }

  .buttonSpinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .8s linear infinite;
    vertical-align: -3px;
    margin-left: 7px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ======================================================
     Drawer
  ====================================================== */

  .drawerBackdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(12, 20, 15, .45);
    backdrop-filter: blur(3px);
    display: flex;
    justify-content: flex-start;
  }

  .drawer {
    width: min(620px, 100%);
    height: 100%;
    background: #fff;
    box-shadow: 0 0 50px rgba(0,0,0,.16);
    display: flex;
    flex-direction: column;
    direction: rtl;
  }

  .drawerHeader {
    padding: 22px;
    border-bottom: 1px solid #e8ece9;
    display: flex;
    justify-content: space-between;
    gap: 15px;
  }

  .drawerHeader h2 {
    font-size: 20px;
    margin-top: 5px;
  }

  .drawerHeader p {
    color: #7a857e;
    font-size: 11px;
    line-height: 1.7;
    margin-top: 6px;
  }

  .closeButton {
    width: 38px;
    height: 38px;
    border: 1px solid #e2e7e4;
    background: #fff;
    border-radius: 11px;
    font-size: 23px;
    color: #58645d;
    flex: 0 0 auto;
  }

  .drawerBody {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .editProduct {
    padding: 12px;
    background: #f7faf8;
    border: 1px solid #e3ebe5;
    border-radius: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 22px;
  }

  .editProductImage {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: #fff;
    overflow: hidden;
    display: grid;
    place-items: center;
  }

  .editProductImage img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .editProduct > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .editProduct strong {
    font-size: 13px;
  }

  .editProduct span {
    color: #6f7b74;
    font-size: 10px;
  }

  .editorSection {
    padding-bottom: 22px;
    margin-bottom: 22px;
    border-bottom: 1px solid #edf0ee;
  }

  .editorHeading {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 13px;
  }

  .editorHeading > span {
    width: 28px;
    height: 28px;
    border-radius: 9px;
    background: #16803b;
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 900;
  }

  .editorHeading div {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .editorHeading strong {
    font-size: 13px;
  }

  .editorHeading small {
    color: #7c867f;
    font-size: 10px;
  }

  .modeGrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }

  .modeOption {
    border: 1px solid #e1e7e3;
    background: #fff;
    border-radius: 13px;
    padding: 13px;
    text-align: right;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .modeOption > span {
    font-size: 20px;
  }

  .modeOption strong {
    font-size: 12px;
  }

  .modeOption small {
    color: #7c867f;
    font-size: 9px;
    line-height: 1.5;
  }

  .modeOption.selected,
  .templateOption.selected,
  .formatOption.selected {
    border-color: #16803b;
    background: #f1faf3;
    box-shadow: 0 0 0 2px rgba(22,128,59,.06);
  }

  .templateGrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .templateOption {
    border: 1px solid #e1e7e3;
    background: #fff;
    border-radius: 12px;
    padding: 11px;
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: right;
  }

  .templateIcon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: #f4f6f5;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }

  .templateOption > span:last-child {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .templateOption strong {
    font-size: 11px;
  }

  .templateOption small {
    color: #7c867f;
    font-size: 8px;
    line-height: 1.4;
  }

  .formatGrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .formatOption {
    border: 1px solid #e1e7e3;
    background: #fff;
    border-radius: 12px;
    padding: 11px;
    text-align: right;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 4px 8px;
  }

  .formatOption > span {
    grid-row: 1 / 3;
    font-size: 22px;
  }

  .formatOption strong {
    font-size: 11px;
  }

  .formatOption small {
    color: #7c867f;
    font-size: 8px;
  }

  .formatOption b {
    grid-column: 3;
    grid-row: 1 / 3;
    font-size: 10px;
    color: #16803b;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 11px;
  }

  .field > span {
    font-size: 10px;
    color: #66736b;
    font-weight: 800;
  }

  .field input,
  .field select,
  .field textarea {
    width: 100%;
    border: 1px solid #dfe6e1;
    background: #fff;
    border-radius: 11px;
    padding: 11px 12px;
    outline: none;
    color: #18231d;
    font-size: 12px;
  }

  .field textarea {
    resize: vertical;
    line-height: 1.7;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: #16803b;
    box-shadow: 0 0 0 3px rgba(22,128,59,.08);
  }

  .twoFields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }

  .responsibilityBox {
    padding: 14px;
    border: 1px solid #f1dfaa;
    background: #fffaf0;
    border-radius: 13px;
    margin-bottom: 14px;
  }

  .responsibilityBox strong {
    font-size: 12px;
    color: #785a13;
  }

  .responsibilityBox p {
    margin-top: 6px;
    color: #796f58;
    font-size: 10px;
    line-height: 1.7;
  }

  .costBox {
    border: 1px solid #cfe7d5;
    background: #f0faf2;
    border-radius: 14px;
    padding: 14px;
  }

  .costBox > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .costBox span {
    color: #4d6555;
    font-size: 11px;
  }

  .costBox strong {
    color: #147438;
    font-size: 15px;
  }

  .costBox small {
    display: block;
    color: #708077;
    font-size: 9px;
    margin-top: 6px;
  }

  .drawerFooter {
    padding: 14px 20px;
    border-top: 1px solid #e8ece9;
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 9px;
    background: #fff;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .detailsColumn {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }

    .dangerCard {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 640px) {
    .page {
      padding: 0 10px 40px;
    }

    .topbar {
      min-height: 64px;
    }

    .brandMark {
      width: 36px;
      height: 36px;
      border-radius: 11px;
    }

    .brand strong {
      font-size: 13px;
    }

    .backButton span {
      display: none;
    }

    .layout {
      margin-top: 14px;
      gap: 12px;
    }

    .previewCard,
    .card {
      border-radius: 16px;
      padding: 13px;
    }

    .previewHeader h1 {
      font-size: 18px;
    }

    .imageFrame {
      min-height: 320px;
    }

    .previewActions {
      grid-template-columns: 1fr 1fr;
    }

    .previewActions .primaryButton {
      grid-column: 1 / -1;
    }

    .detailsColumn {
      display: flex;
    }

    .productRow {
      align-items: flex-start;
    }

    .warningBadge {
      margin-top: 2px;
    }

    .drawer {
      width: 100%;
    }

    .drawerHeader {
      padding: 17px;
    }

    .drawerHeader h2 {
      font-size: 17px;
    }

    .drawerBody {
      padding: 15px;
    }

    .modeGrid,
    .templateGrid,
    .formatGrid {
      grid-template-columns: 1fr;
    }

    .twoFields {
      grid-template-columns: 1fr;
    }

    .drawerFooter {
      padding: 11px 15px;
      grid-template-columns: 1fr 1.4fr;
    }

    .infoGrid {
      grid-template-columns: 1fr 1fr;
    }

    .dangerCard {
      align-items: flex-start;
    }
  }
`;
