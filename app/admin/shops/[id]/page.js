"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/client";

export default function AdminShopDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const shopId = params?.id;

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState(null);
  const [owner, setOwner] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shopId) return;

    loadShop();
  }, [shopId]);

  async function loadShop() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, account_status, is_super_admin, phone, created_at")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.is_super_admin) {
        router.replace("/dashboard");
        return;
      }

      const { data: shopData, error: shopError } = await supabase
        .from("shops")
        .select("*")
        .eq("id", shopId)
        .single();

      if (shopError) {
        throw new Error(shopError.message);
      }

      setShop(shopData);

      if (shopData.owner_id) {
        const { data: ownerData } = await supabase
          .from("profiles")
          .select(
            "id, full_name, phone, role, account_status, is_super_admin, created_at, suspension_reason, suspended_at"
          )
          .eq("id", shopData.owner_id)
          .single();

        setOwner(ownerData || null);
      }

      const { data: productData, error: productsError } = await supabase
        .from("products")
        .select(
          "id, name, brand, category, price, currency, image_url, product_type, verification_status, ai_status, safety_status, safety_level, created_at"
        )
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (productsError) {
        throw new Error(productsError.message);
      }

      setProducts(productData || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء تحميل بيانات المحل");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date) {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatDateTime(date) {
    if (!date) return "—";

    return new Date(date).toLocaleString("ar-AE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusLabel(status) {
    if (status === "active") return "نشط";
    if (status === "suspended") return "موقوف";
    if (status === "blocked") return "محظور";
    if (status === "pending") return "قيد المراجعة";
    return status || "غير محدد";
  }

  function statusClass(status) {
    if (status === "active") {
      return "bg-green-100 text-green-700";
    }

    if (status === "suspended") {
      return "bg-yellow-100 text-yellow-700";
    }

    if (status === "blocked") {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  function productTypeLabel(type) {
    if (type === "local") return "محلي";
    if (type === "imported") return "مستورد";
    return type || "غير محدد";
  }

  function verificationLabel(status) {
    if (status === "verified") return "موثّق";
    if (status === "unverified") return "غير موثّق";
    if (status === "review") return "قيد المراجعة";
    if (status === "rejected") return "مرفوض";
    return status || "غير محدد";
  }

  function safetyLabel(status) {
    if (status === "clear") return "سليم";
    if (status === "review") return "مراجعة";
    if (status === "violation") return "مخالفة";
    if (status === "locked") return "مقفل";
    if (status === "approved") return "معتمد";
    return status || "غير محدد";
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 flex items-center justify-center p-6"
      >
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="text-3xl mb-3">⏳</div>
          <p className="text-gray-700">جاري تحميل بيانات المحل...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/admin/shops"
            className="inline-block mb-6 text-blue-600 hover:underline"
          >
            ← العودة إلى المحلات
          </Link>

          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>

            <h1 className="text-xl font-bold text-gray-900 mb-2">
              تعذر تحميل المحل
            </h1>

            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!shop) {
    return (
      <main dir="rtl" className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/admin/shops"
            className="text-blue-600 hover:underline"
          >
            ← العودة إلى المحلات
          </Link>

          <div className="bg-white rounded-2xl border p-8 mt-6 text-center">
            <p className="text-gray-600">المحل غير موجود.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <Link
              href="/admin/shops"
              className="text-blue-600 hover:underline text-sm"
            >
              ← العودة إلى المحلات
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-3">
              تفاصيل المحل
            </h1>

            <p className="text-gray-500 mt-1">
              إدارة ومراجعة بيانات المحل ومنتجاته
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${statusClass(
                shop.status
              )}`}
            >
              حالة المحل: {statusLabel(shop.status)}
            </span>

            <span className="px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
              {products.length} منتج
            </span>
          </div>
        </div>

        {/* Shop overview */}
        <section className="bg-white rounded-2xl border shadow-sm p-5 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">

            {/* Logo */}
            <div className="flex-shrink-0">
              {shop.logo_url ? (
                <img
                  src={shop.logo_url}
                  alt={shop.name}
                  className="w-28 h-28 rounded-2xl object-cover border bg-gray-50"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-gray-100 border flex items-center justify-center text-4xl">
                  🏪
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">
                  {shop.name}
                </h2>

                <span
                  className={`w-fit px-3 py-1 rounded-full text-xs font-semibold ${statusClass(
                    shop.status
                  )}`}
                >
                  {statusLabel(shop.status)}
                </span>
              </div>

              {shop.description && (
                <p className="text-gray-600 mt-3 leading-7">
                  {shop.description}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                <InfoBox label="نوع الحساب" value="محل" />
                <InfoBox
                  label="العملة"
                  value={shop.currency || "AED"}
                />
                <InfoBox
                  label="الدولة"
                  value={shop.country || "United Arab Emirates"}
                />
                <InfoBox
                  label="تاريخ الإنشاء"
                  value={formatDate(shop.created_at)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Owner */}
        <section className="bg-white rounded-2xl border shadow-sm p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                👤 صاحب المحل
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                بيانات الحساب المرتبط بهذا المحل
              </p>
            </div>

            {owner && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass(
                  owner.account_status
                )}`}
              >
                {statusLabel(owner.account_status)}
              </span>
            )}
          </div>

          {owner ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoBox
                  label="الاسم"
                  value={owner.full_name || "بدون اسم"}
                />

                <InfoBox
                  label="رقم الهاتف"
                  value={owner.phone || shop.phone || "غير مضاف"}
                />

                <InfoBox
                  label="نوع الحساب"
                  value={owner.role || "owner"}
                />

                <InfoBox
                  label="تاريخ التسجيل"
                  value={formatDate(owner.created_at)}
                />
              </div>

              {(owner.account_status === "suspended" ||
                owner.account_status === "blocked") &&
                owner.suspension_reason && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="font-semibold text-red-800 mb-1">
                      سبب الإيقاف / الحظر
                    </div>

                    <p className="text-red-700 text-sm">
                      {owner.suspension_reason}
                    </p>

                    {owner.suspended_at && (
                      <p className="text-red-600 text-xs mt-2">
                        منذ: {formatDateTime(owner.suspended_at)}
                      </p>
                    )}
                  </div>
                )}
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
              لم يتم العثور على بيانات صاحب المحل.
            </div>
          )}
        </section>

        {/* Contact */}
        <section className="bg-white rounded-2xl border shadow-sm p-5 md:p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5">
            📞 معلومات التواصل
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ContactBox
              label="الهاتف"
              value={shop.phone}
            />

            <ContactBox
              label="واتساب"
              value={shop.whatsapp}
            />

            <ContactBox
              label="البريد الإلكتروني"
              value={shop.email}
            />

            <ContactBox
              label="الموقع الإلكتروني"
              value={shop.website}
              link={shop.website}
            />

            <ContactBox
              label="Instagram"
              value={shop.instagram}
              link={shop.instagram}
            />

            <ContactBox
              label="TikTok"
              value={shop.tiktok}
              link={shop.tiktok}
            />

            <ContactBox
              label="Snapchat"
              value={shop.snapchat}
              link={shop.snapchat}
            />
          </div>
        </section>

        {/* Location */}
        <section className="bg-white rounded-2xl border shadow-sm p-5 md:p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5">
            📍 الموقع والعنوان
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoBox
              label="الإمارة"
              value={shop.emirate || "غير مضافة"}
            />

            <InfoBox
              label="الدولة"
              value={shop.country || "United Arab Emirates"}
            />

            <InfoBox
              label="ساعات العمل"
              value={shop.working_hours || "غير مضافة"}
            />
          </div>

          <div className="mt-4">
            <InfoBox
              label="العنوان"
              value={shop.address || "غير مضاف"}
            />
          </div>
        </section>

        {/* Products */}
        <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  📦 منتجات المحل
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  جميع المنتجات المرتبطة بهذا المحل
                </p>
              </div>

              <div className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700">
                الإجمالي: {products.length}
              </div>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-gray-500">
                لا توجد منتجات مرتبطة بهذا المحل حتى الآن.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-right p-4 font-semibold text-gray-700">
                      المنتج
                    </th>

                    <th className="text-right p-4 font-semibold text-gray-700">
                      النوع
                    </th>

                    <th className="text-right p-4 font-semibold text-gray-700">
                      التحقق
                    </th>

                    <th className="text-right p-4 font-semibold text-gray-700">
                      السلامة
                    </th>

                    <th className="text-right p-4 font-semibold text-gray-700">
                      السعر
                    </th>

                    <th className="text-right p-4 font-semibold text-gray-700">
                      التاريخ
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-12 h-12 rounded-xl object-cover border bg-gray-50"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-100 border flex items-center justify-center">
                              📦
                            </div>
                          )}

                          <div>
                            <div className="font-semibold text-gray-900">
                              {product.name}
                            </div>

                            {product.brand && (
                              <div className="text-xs text-gray-500 mt-1">
                                {product.brand}
                              </div>
                            )}

                            {product.category && (
                              <div className="text-xs text-gray-400 mt-1">
                                {product.category}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {productTypeLabel(product.product_type)}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            product.verification_status === "verified"
                              ? "bg-green-100 text-green-700"
                              : product.verification_status === "review"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {verificationLabel(product.verification_status)}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            product.safety_status === "locked" ||
                            product.safety_status === "violation"
                              ? "bg-red-100 text-red-700"
                              : product.safety_status === "review"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {product.safety_status === "locked" && "🔒 "}
                          {safetyLabel(product.safety_status)}
                        </span>

                        {product.safety_level &&
                          product.safety_level !== "low" && (
                            <div className="text-xs text-gray-500 mt-1">
                              مستوى: {product.safety_level}
                            </div>
                          )}
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        {product.price !== null &&
                        product.price !== undefined
                          ? `${product.price} ${product.currency || "AED"}`
                          : "غير محدد"}
                      </td>

                      <td className="p-4 whitespace-nowrap text-gray-500">
                        {formatDate(product.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Shop ID */}
        <div className="mt-6 bg-gray-100 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">
            Shop ID
          </div>

          <div className="font-mono text-xs text-gray-700 break-all">
            {shop.id}
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-gray-50 border rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">
        {label}
      </div>

      <div className="font-semibold text-gray-800 break-words">
        {value || "—"}
      </div>
    </div>
  );
}

function ContactBox({ label, value, link }) {
  return (
    <div className="bg-gray-50 border rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">
        {label}
      </div>

      {link ? (
        <a
          href={
            link.startsWith("http://") || link.startsWith("https://")
              ? link
              : `https://${link}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-600 hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <div className="font-semibold text-gray-800 break-words">
          {value || "غير مضاف"}
        </div>
      )}
    </div>
  );
}
