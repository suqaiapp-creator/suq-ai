"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "../../../lib/supabase/client";

export default function DesignDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const designId = params?.id;

  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [design, setDesign] = useState(null);
  const [product, setProduct] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] =
    useState(false);

  // =====================================================
  // Editor state
  // =====================================================

  const [editor, setEditor] = useState({
    template: "product",
    mode: "simple",
    style: "professional",
    background: "clean",
    format: "1:1",
    title: "",
    price: "",
    discount: "",
    cta: "",
    custom_text: "",
  });

  // =====================================================
  // Templates
  // =====================================================

  const templates = [
    {
      id: "product",
      name: "منتج",
      description: "عرض المنتج بشكل واضح",
      icon: "📦",
    },
    {
      id: "discount",
      name: "خصم",
      description: "إبراز الخصم والسعر",
      icon: "🏷️",
    },
    {
      id: "new",
      name: "جديد",
      description: "إعلان وصول منتج جديد",
      icon: "✨",
    },
    {
      id: "bestseller",
      name: "الأكثر مبيعاً",
      description: "إبراز المنتج المميز",
      icon: "🔥",
    },
    {
      id: "offer",
      name: "عرض",
      description: "تصميم عروض وتسويق",
      icon: "🎁",
    },
    {
      id: "simple",
      name: "بسيط",
      description: "تصميم نظيف",
      icon: "◻️",
    },
    {
      id: "social",
      name: "اجتماعي",
      description: "مناسب لمنصات التواصل",
      icon: "📱",
    },
    {
      id: "premium",
      name: "فاخر",
      description: "مظهر احترافي فاخر",
      icon: "💎",
    },
  ];

  // =====================================================
  // Styles
  // =====================================================

  const styles = [
    {
      id: "professional",
      name: "احترافي",
    },
    {
      id: "luxury",
      name: "فاخر",
    },
    {
      id: "modern",
      name: "عصري",
    },
    {
      id: "clean",
      name: "نظيف",
    },
    {
      id: "dark-tech",
      name: "تقني داكن",
    },
    {
      id: "premium",
      name: "Premium",
    },
    {
      id: "sale",
      name: "عروض",
    },
  ];

  // =====================================================
  // Backgrounds
  // =====================================================

  const backgrounds = [
    {
      id: "clean",
      name: "نظيف",
      preview: "bg-white",
    },
    {
      id: "white",
      name: "أبيض",
      preview: "bg-slate-50",
    },
    {
      id: "light",
      name: "فاتح",
      preview: "bg-gray-100",
    },
    {
      id: "dark",
      name: "داكن",
      preview: "bg-slate-900",
    },
    {
      id: "black",
      name: "أسود",
      preview: "bg-black",
    },
    {
      id: "gradient",
      name: "متدرج",
      preview: "bg-gradient-to-br from-slate-100 to-slate-300",
    },
  ];

  // =====================================================
  // Formats
  // =====================================================

  const formats = [
    {
      id: "1:1",
      name: "مربع",
      size: "1080 × 1080",
    },
    {
      id: "4:5",
      name: "منشور",
      size: "1080 × 1350",
    },
    {
      id: "9:16",
      name: "ستوري",
      size: "1080 × 1920",
    },
    {
      id: "16:9",
      name: "أفقي",
      size: "1920 × 1080",
    },
  ];

  // =====================================================
  // Load design
  // =====================================================

  const loadDesign = useCallback(async () => {
    if (!designId) return;

    setLoading(true);
    setError("");

    try {
      const {
        data: {
          user: currentUser,
        },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      // ---------------------------------------------------
      // Shop
      // ---------------------------------------------------

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
        throw new Error(
          "تعذر قراءة بيانات المتجر"
        );
      }

      if (!shopData) {
        throw new Error(
          "لا يوجد متجر مرتبط بالحساب"
        );
      }

      setShop(shopData);

      // ---------------------------------------------------
      // Design
      // ---------------------------------------------------

      const {
        data: designData,
        error: designError,
      } = await supabase
        .from("ad_images")
        .select("*")
        .eq("id", designId)
        .eq("shop_id", shopData.id)
        .maybeSingle();

      if (designError) {
        throw new Error(
          "تعذر قراءة بيانات التصميم"
        );
      }

      if (!designData) {
        throw new Error(
          "التصميم غير موجود أو غير تابع لمتجرك"
        );
      }

      setDesign(designData);

      // ---------------------------------------------------
      // Product
      // ---------------------------------------------------

      if (designData.product_id) {
        const {
          data: productData,
          error: productError,
        } = await supabase
          .from("products")
          .select("*")
          .eq("id", designData.product_id)
          .eq("shop_id", shopData.id)
          .maybeSingle();

        if (productError) {
          throw new Error(
            "تعذر قراءة بيانات المنتج"
          );
        }

        setProduct(productData);

        // -------------------------------------------------
        // Initialize editor
        // -------------------------------------------------

        setEditor((current) => ({
          ...current,

          title:
            current.title ||
            productData?.name ||
            "",

          price:
            current.price !== ""
              ? current.price
              : productData?.price ??
                "",

          template:
            designData.template ||
            designData.template_id ||
            "product",

          mode:
            designData.mode ||
            "simple",

          style:
            designData.style ||
            "professional",

          background:
            designData.background ||
            "clean",

          format:
            designData.format ||
            "1:1",

          discount:
            designData.discount ||
            "",

          cta:
            designData.cta ||
            "",

          custom_text:
            designData.custom_text ||
            "",
        }));
      }
    } catch (loadError) {
      console.error(
        "Design details load error:",
        loadError
      );

      setError(
        loadError?.message ||
          "حدث خطأ أثناء تحميل التصميم"
      );
    } finally {
      setLoading(false);
    }
  }, [designId, router]);

  useEffect(() => {
    loadDesign();
  }, [loadDesign]);

  // =====================================================
  // Editor helpers
  // =====================================================

  function updateEditor(key, value) {
    setEditor((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openEditor() {
    if (!design || !product) return;

    setMessage("");
    setError("");

    setEditor((current) => ({
      ...current,
      title:
        current.title ||
        product.name ||
        "",
      price:
        current.price !== ""
          ? current.price
          : product.price ?? "",
    }));

    setShowEditor(true);
  }

  function closeEditor() {
    if (saving) return;

    setShowEditor(false);
    setMessage("");
    setError("");
  }

  // =====================================================
  // Save edit
  // =====================================================

  async function saveEdit() {
    if (!design?.id) {
      setError("التصميم غير موجود");
      return;
    }

    if (!product?.id) {
      setError("المنتج غير موجود");
      return;
    }

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/generate-design",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "edit",
            operation: "edit_design",

            design_id:
              design.id,

            product_id:
              product.id,

            template:
              editor.template,

            template_id:
              editor.template,

            mode:
              editor.mode,

            style:
              editor.style,

            background:
              editor.background,

            format:
              editor.format,

            title:
              editor.title ||
              product.name,

            price:
              editor.price === ""
                ? null
                : Number(
                    editor.price
                  ),

            discount:
              editor.discount ||
              null,

            cta:
              editor.cta ||
              null,

            custom_text:
              editor.custom_text ||
              null,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error ||
            "تعذر تعديل التصميم"
        );
      }

      if (result.design) {
        setDesign(
          result.design
        );
      }

      if (result.image_url) {
        setDesign((current) => ({
          ...(current || {}),
          image_url:
            result.image_url,
        }));
      }

      setMessage(
        `تم تعديل التصميم بنجاح. تم خصم ${
          result.pointsCharged ?? 1
        } نقطة.`
      );

      setShowEditor(false);

      // ---------------------------------------------------
      // Refresh data
      // ---------------------------------------------------

      await loadDesign();
    } catch (saveError) {
      console.error(
        "Save design edit error:",
        saveError
      );

      setError(
        saveError?.message ||
          "تعذر تعديل التصميم"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // Delete
  // =====================================================

  async function deleteDesign() {
    if (!design?.id || !shop?.id) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const {
        error: deleteError,
      } = await supabase
        .from("ad_images")
        .delete()
        .eq("id", design.id)
        .eq("shop_id", shop.id);

      if (deleteError) {
        throw new Error(
          deleteError.message ||
            "تعذر حذف التصميم"
        );
      }

      router.push("/designs");
    } catch (deleteError) {
      console.error(
        "Delete design error:",
        deleteError
      );

      setError(
        deleteError?.message ||
          "تعذر حذف التصميم"
      );

      setShowDeleteConfirm(false);
    }
  }

  // =====================================================
  // Download
  // =====================================================

  function downloadDesign() {
    if (!design?.image_url) return;

    const link =
      document.createElement("a");

    link.href =
      design.image_url;

    link.download =
      `${product?.name || "suq-ai-design"}.png`;

    link.target =
      "_blank";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );
  }

  // =====================================================
  // Open image
  // =====================================================

  function openImage() {
    if (!design?.image_url) return;

    window.open(
      design.image_url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // =====================================================
  // Share
  // =====================================================

  async function shareDesign() {
    if (!design?.image_url) return;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            product?.name ||
            "تصميم من سوق AI",
          text:
            "تصميم إعلاني من سوق AI",
          url:
            design.image_url,
        });

        return;
      }

      await navigator.clipboard.writeText(
        design.image_url
      );

      setMessage(
        "تم نسخ رابط التصميم"
      );
    } catch (shareError) {
      console.error(
        "Share error:",
        shareError
      );
    }
  }

  // =====================================================
  // Loading
  // =====================================================

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 flex items-center justify-center"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

          <p className="text-sm font-medium text-slate-600">
            جاري تحميل التصميم...
          </p>
        </div>
      </main>
    );
  }

  // =====================================================
  // Error
  // =====================================================

  if (error && !design) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-6"
      >
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl">
              !
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              تعذر تحميل التصميم
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-500">
              {error}
            </p>

            <button
              onClick={() =>
                router.push(
                  "/designs"
                )
              }
              className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              العودة للتصاميم
            </button>
          </div>
        </div>
      </main>
    );
  }

  // =====================================================
  // Main
  // =====================================================

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50"
    >
      {/* =================================================
          Header
      ================================================= */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                onClick={() =>
                  router.push(
                    "/designs"
                  )
                }
                className="mb-2 text-sm font-medium text-slate-500 hover:text-emerald-600"
              >
                ← مركز التصميم
              </button>

              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                تفاصيل التصميم
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                عرض وتعديل التصميم الإعلاني
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={openEditor}
                disabled={
                  design?.status ===
                  "generating"
                }
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✎ تعديل التصميم
              </button>

              <button
                onClick={() =>
                  setShowDeleteConfirm(
                    true
                  )
                }
                className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =================================================
          Messages
      ================================================= */}

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        {message && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            ✓ {message}
          </div>
        )}

        {error && design && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* =================================================
          Content
      ================================================= */}

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* =================================================
              Preview
          ================================================= */}

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">
                  معاينة التصميم
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  الصورة الحالية
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  design?.status ===
                  "completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : design?.status ===
                      "generating"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {design?.status ===
                "completed"
                  ? "مكتمل"
                  : design?.status ===
                    "generating"
                  ? "جاري الإنشاء"
                  : design?.status ||
                    "غير معروف"}
              </span>
            </div>

            <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-3xl bg-slate-100 p-4">
              {design?.image_url ? (
                <img
                  src={
                    design.image_url
                  }
                  alt={
                    product?.name ||
                    "التصميم"
                  }
                  className="max-h-[720px] w-auto max-w-full rounded-2xl object-contain shadow-lg"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <div className="mb-3 text-4xl">
                    🖼️
                  </div>

                  <p className="text-sm font-medium">
                    لا توجد صورة للتصميم
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <button
                onClick={openImage}
                disabled={
                  !design?.image_url
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                فتح الصورة
              </button>

              <button
                onClick={
                  downloadDesign
                }
                disabled={
                  !design?.image_url
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                تحميل
              </button>

              <button
                onClick={
                  shareDesign
                }
                disabled={
                  !design?.image_url
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                مشاركة
              </button>
            </div>
          </div>

          {/* =================================================
              Details
          ================================================= */}

          <div className="space-y-5">
            {/* Product */}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">
                  المنتج
                </h2>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {product?.category ||
                    "منتج"}
                </span>
              </div>

              <div className="flex gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  {product?.image_url ? (
                    <img
                      src={
                        product.image_url
                      }
                      alt={
                        product.name
                      }
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-900">
                    {product?.name ||
                      "منتج غير معروف"}
                  </h3>

                  {product?.brand && (
                    <p className="mt-1 text-sm text-slate-500">
                      {product.brand}
                    </p>
                  )}

                  {product?.price !=
                    null && (
                    <p className="mt-2 text-sm font-bold text-emerald-600">
                      {product.price}{" "}
                      {product.currency ||
                        "AED"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Design information */}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-bold text-slate-900">
                إعدادات التصميم
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <InfoBox
                  label="المقاس"
                  value={
                    design?.format ||
                    editor.format ||
                    "1:1"
                  }
                />

                <InfoBox
                  label="النمط"
                  value={
                    design?.style ||
                    editor.style ||
                    "احترافي"
                  }
                />

                <InfoBox
                  label="الخلفية"
                  value={
                    design?.background ||
                    editor.background ||
                    "نظيف"
                  }
                />

                <InfoBox
                  label="الوضع"
                  value={
                    design?.mode ||
                    editor.mode ||
                    "بسيط"
                  }
                />
              </div>
            </div>

            {/* Shop */}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-bold text-slate-900">
                المتجر
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">
                    اسم المتجر
                  </span>

                  <span className="font-bold text-slate-800">
                    {shop?.name ||
                      "—"}
                  </span>
                </div>

                {shop?.phone && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">
                      الهاتف
                    </span>

                    <span className="font-medium text-slate-800">
                      {shop.phone}
                    </span>
                  </div>
                )}

                {shop?.whatsapp && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">
                      واتساب
                    </span>

                    <span className="font-medium text-slate-800">
                      {shop.whatsapp}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Created */}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-bold text-slate-900">
                معلومات إضافية
              </h2>

              <div className="space-y-3 text-sm">
                <InfoRow
                  label="تاريخ الإنشاء"
                  value={
                    design?.created_at
                      ? new Date(
                          design.created_at
                        ).toLocaleString(
                          "ar-AE"
                        )
                      : "—"
                  }
                />

                <InfoRow
                  label="آخر تحديث"
                  value={
                    design?.completed_at
                      ? new Date(
                          design.completed_at
                        ).toLocaleString(
                          "ar-AE"
                        )
                      : "—"
                  }
                />

                <InfoRow
                  label="المعرّف"
                  value={
                    design?.id ||
                    "—"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================
          EDITOR DRAWER
      ================================================= */}

      {showEditor && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => {
              if (!saving) {
                closeEditor();
              }
            }}
          />

          <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
            {/* Header */}

            <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                    DESIGN EDITOR
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    تعديل التصميم
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    تعديل الإعدادات ثم إعادة إنشاء التصميم
                  </p>
                </div>

                <button
                  onClick={
                    closeEditor
                  }
                  disabled={saving}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body */}

            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <div className="space-y-7">
                {/* Cost notice */}

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                      ✦
                    </div>

                    <div>
                      <p className="font-bold text-emerald-900">
                        تكلفة التعديل: 1 نقطة
                      </p>

                      <p className="mt-1 text-xs leading-6 text-emerald-700">
                        يتم خصم النقطة عند بدء العملية، وإذا فشل التعديل يتم إرجاع النقطة تلقائياً.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Product */}

                <section>
                  <SectionTitle
                    number="01"
                    title="المنتج"
                  />

                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl bg-white">
                      {product?.image_url && (
                        <img
                          src={
                            product.image_url
                          }
                          alt={
                            product.name
                          }
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {product?.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        المنتج ثابت أثناء التعديل
                      </p>
                    </div>
                  </div>
                </section>

                {/* Template */}

                <section>
                  <SectionTitle
                    number="02"
                    title="القالب"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {templates.map(
                      (item) => {
                        const selected =
                          editor.template ===
                          item.id;

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() =>
                              updateEditor(
                                "template",
                                item.id
                              )
                            }
                            className={`rounded-2xl border p-3 text-right transition ${
                              selected
                                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="text-xl">
                              {
                                item.icon
                              }
                            </div>

                            <p className="mt-2 text-sm font-bold text-slate-900">
                              {
                                item.name
                              }
                            </p>

                            <p className="mt-1 text-[11px] leading-5 text-slate-500">
                              {
                                item.description
                              }
                            </p>
                          </button>
                        );
                      }
                    )}
                  </div>
                </section>

                {/* Mode */}

                <section>
                  <SectionTitle
                    number="03"
                    title="طريقة التصميم"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <ChoiceButton
                      selected={
                        editor.mode ===
                        "simple"
                      }
                      title="بسيط"
                      description="تكوين سريع ونظيف"
                      onClick={() =>
                        updateEditor(
                          "mode",
                          "simple"
                        )
                      }
                    />

                    <ChoiceButton
                      selected={
                        editor.mode ===
                        "professional"
                      }
                      title="احترافي"
                      description="تكوين إعلاني متقدم"
                      onClick={() =>
                        updateEditor(
                          "mode",
                          "professional"
                        )
                      }
                    />
                  </div>
                </section>

                {/* Style */}

                <section>
                  <SectionTitle
                    number="04"
                    title="الأسلوب"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {styles.map(
                      (item) => (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            updateEditor(
                              "style",
                              item.id
                            )
                          }
                          className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                            editor.style ===
                            item.id
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {
                            item.name
                          }
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* Background */}

                <section>
                  <SectionTitle
                    number="05"
                    title="الخلفية"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {backgrounds.map(
                      (item) => (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            updateEditor(
                              "background",
                              item.id
                            )
                          }
                          className={`overflow-hidden rounded-2xl border transition ${
                            editor.background ===
                            item.id
                              ? "border-emerald-500 ring-2 ring-emerald-100"
                              : "border-slate-200"
                          }`}
                        >
                          <div
                            className={`h-16 ${item.preview}`}
                          />

                          <div className="bg-white px-3 py-2 text-right">
                            <span className="text-xs font-bold text-slate-700">
                              {
                                item.name
                              }
                            </span>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* Format */}

                <section>
                  <SectionTitle
                    number="06"
                    title="المقاس"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {formats.map(
                      (item) => (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            updateEditor(
                              "format",
                              item.id
                            )
                          }
                          className={`rounded-2xl border p-4 text-right transition ${
                            editor.format ===
                            item.id
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">
                              {
                                item.name
                              }
                            </span>

                            <span className="text-xs font-bold text-emerald-600">
                              {
                                item.id
                              }
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-slate-500">
                            {
                              item.size
                            }
                          </p>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* Content */}

                <section>
                  <SectionTitle
                    number="07"
                    title="المحتوى"
                  />

                  <div className="mt-4 space-y-4">
                    <Field
                      label="العنوان"
                      value={
                        editor.title
                      }
                      onChange={(
                        value
                      ) =>
                        updateEditor(
                          "title",
                          value
                        )
                      }
                      placeholder={
                        product?.name ||
                        "عنوان المنتج"
                      }
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="السعر"
                        type="number"
                        value={
                          editor.price
                        }
                        onChange={(
                          value
                        ) =>
                          updateEditor(
                            "price",
                            value
                          )
                        }
                        placeholder="0"
                      />

                      <Field
                        label="الخصم"
                        value={
                          editor.discount
                        }
                        onChange={(
                          value
                        ) =>
                          updateEditor(
                            "discount",
                            value
                          )
                        }
                        placeholder="مثال: 20%"
                      />
                    </div>

                    <Field
                      label="زر الإجراء"
                      value={
                        editor.cta
                      }
                      onChange={(
                        value
                      ) =>
                        updateEditor(
                          "cta",
                          value
                        )
                      }
                      placeholder="اطلب الآن"
                    />

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-800">
                        نص إضافي
                      </label>

                      <textarea
                        value={
                          editor.custom_text
                        }
                        onChange={(
                          event
                        ) =>
                          updateEditor(
                            "custom_text",
                            event
                              .target
                              .value
                          )
                        }
                        rows={4}
                        placeholder="أي ملاحظة أو نص إضافي تريد ظهوره في الإعلان..."
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}

            <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={
                    saveEdit
                  }
                  disabled={
                    saving
                  }
                  className="flex-1 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "جاري تعديل التصميم..."
                    : "حفظ التعديل — 1 نقطة"}
                </button>

                <button
                  onClick={
                    closeEditor
                  }
                  disabled={
                    saving
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* =================================================
          DELETE MODAL
      ================================================= */}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">
              !
            </div>

            <h2 className="text-xl font-black text-slate-900">
              حذف التصميم؟
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-500">
              سيتم حذف سجل التصميم من المتجر. هذا الإجراء لا يمكن التراجع عنه.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={
                  deleteDesign
                }
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700"
              >
                نعم، حذف
              </button>

              <button
                onClick={() =>
                  setShowDeleteConfirm(
                    false
                  )
                }
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// =========================================================
// Components
// =========================================================

function SectionTitle({
  number,
  title,
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[11px] font-black text-emerald-700">
        {number}
      </div>

      <h3 className="font-black text-slate-900">
        {title}
      </h3>
    </div>
  );
}

function ChoiceButton({
  selected,
  title,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-right transition ${
        selected
          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-900">
          {title}
        </span>

        {selected && (
          <span className="text-emerald-600">
            ✓
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-800">
        {label}
      </label>

      <input
        type={type}
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

function InfoBox({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="max-w-[65%] break-all text-left font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}
