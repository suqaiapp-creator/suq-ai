"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function DesignsPage() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [format, setFormat] = useState("1:1");
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage("❌ تعذر تحميل المنتجات");
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  }

  async function loadDesigns(productId) {
    if (!productId) {
      setDesigns([]);
      return;
    }

    const { data, error } = await supabase
      .from("ad_images")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage("❌ تعذر تحميل التصاميم");
      return;
    }

    setDesigns(data || []);
  }

  function handleProductChange(e) {
    const productId = e.target.value;

    setSelectedProduct(productId);
    setMessage("");

    loadDesigns(productId);
  }

  async function createDesignRequest() {
    if (!selectedProduct) {
      setMessage("❌ اختر منتجًا أولًا");
      return;
    }

    const product = products.find(
      (item) => item.id === selectedProduct
    );

    if (!product) {
      setMessage("❌ المنتج غير موجود");
      return;
    }

    const prompt = `
إنشاء تصميم إعلاني احترافي لمنتج:
${product.name}

العلامة التجارية:
${product.brand || ""}

التصنيف:
${product.category || ""}

السعر:
${product.price || ""} ${product.currency || "AED"}

التصميم مخصص للسوق الإماراتي.

مهم:
لا تخترع مواصفات غير موجودة.
لا تضف معلومات غير موجودة عن المنتج.

المقاس:
${format}
`;

    const { data, error } = await supabase
      .from("ad_images")
      .insert({
        product_id: selectedProduct,
        format,
        prompt,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage("❌ تعذر إنشاء طلب التصميم");
      return;
    }

    setDesigns((prev) => [data, ...prev]);

    setMessage(
      "✅ تم تجهيز طلب التصميم. ربط توليد الصورة بالذكاء الاصطناعي سيكون في الخطوة التالية."
    );
  }

  const selectedProductData = products.find(
    (item) => item.id === selectedProduct
  );

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 20,
          fontFamily: "Arial",
        }}
      >
        <h2>جاري تحميل المنتجات...</h2>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 900,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 25,
        }}
      >
        <div>
          <h1>🎨 التصاميم الإعلانية</h1>
          <p style={{ color: "#666" }}>
            جهّز تصميمًا إعلانيًا احترافيًا لمنتجك.
          </p>
        </div>

        <Link
          href="/products"
          style={{
            textDecoration: "none",
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #ccc",
            color: "#111",
          }}
        >
          ← المنتجات
        </Link>
      </div>

      {/* اختيار المنتج */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2>1️⃣ اختر المنتج</h2>

        <select
          value={selectedProduct}
          onChange={handleProductChange}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 16,
            marginTop: 10,
          }}
        >
          <option value="">اختر المنتج...</option>

          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.price
                ? ` - ${product.price} ${product.currency || "AED"}`
                : ""}
            </option>
          ))}
        </select>
      </section>

      {/* معاينة المنتج */}
      {selectedProductData && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2>📦 المنتج المختار</h2>

          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {selectedProductData.image_url ? (
              <img
                src={selectedProductData.image_url}
                alt={selectedProductData.name}
                style={{
                  width: 160,
                  height: 160,
                  objectFit: "contain",
                  borderRadius: 10,
                  border: "1px solid #eee",
                }}
              />
            ) : (
              <div
                style={{
                  width: 160,
                  height: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 60,
                  background: "#f5f5f5",
                  borderRadius: 10,
                }}
              >
                📦
              </div>
            )}

            <div>
              <h3>{selectedProductData.name}</h3>

              {selectedProductData.brand && (
                <p>
                  العلامة التجارية:{" "}
                  {selectedProductData.brand}
                </p>
              )}

              {selectedProductData.category && (
                <p>
                  التصنيف:{" "}
                  {selectedProductData.category}
                </p>
              )}

              {selectedProductData.price && (
                <p>
                  السعر: {selectedProductData.price}{" "}
                  {selectedProductData.currency || "AED"}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* المقاس */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2>2️⃣ اختر مقاس الإعلان</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 15,
          }}
        >
          <FormatButton
            value="1:1"
            label="⬛ 1:1"
            description="Instagram"
            selected={format === "1:1"}
            onClick={() => setFormat("1:1")}
          />

          <FormatButton
            value="9:16"
            label="📱 9:16"
            description="TikTok / Reels / Snapchat"
            selected={format === "9:16"}
            onClick={() => setFormat("9:16")}
          />

          <FormatButton
            value="16:9"
            label="🖥️ 16:9"
            description="YouTube / شاشة"
            selected={format === "16:9"}
            onClick={() => setFormat("16:9")}
          />
        </div>
      </section>

      {/* إنشاء */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <h2>3️⃣ تجهيز التصميم</h2>

        <p style={{ color: "#666" }}>
          سيتم إنشاء التصميم بالذكاء الاصطناعي في
          المرحلة التالية.
        </p>

        <button
          onClick={createDesignRequest}
          style={{
            padding: "15px 30px",
            borderRadius: 10,
            border: "none",
            background: "#16a34a",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          🎨 إنشاء تصميم إعلاني
        </button>
      </section>

      {/* الرسالة */}
      {message && (
        <div
          style={{
            padding: 15,
            borderRadius: 10,
            background: "#f5f5f5",
            marginBottom: 20,
            fontWeight: "bold",
          }}
        >
          {message}
        </div>
      )}

      {/* التصاميم */}
      {selectedProduct && (
        <section>
          <h2>🖼️ تصاميم المنتج</h2>

          {designs.length === 0 ? (
            <div
              style={{
                padding: 20,
                background: "#f8f8f8",
                borderRadius: 10,
                textAlign: "center",
              }}
            >
              لا توجد تصاميم لهذا المنتج حتى الآن.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 15,
              }}
            >
              {designs.map((design) => (
                <div
                  key={design.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 15,
                  }}
                >
                  {design.image_url ? (
                    <img
                      src={design.image_url}
                      alt="تصميم إعلاني"
                      style={{
                        width: "100%",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 180,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f5f5f5",
                        borderRadius: 8,
                        fontSize: 45,
                      }}
                    >
                      🎨
                    </div>
                  )}

                  <p>
                    <strong>المقاس:</strong>{" "}
                    {design.format}
                  </p>

                  <p>
                    <strong>الحالة:</strong>{" "}
                    {design.status === "pending"
                      ? "⏳ قيد الانتظار"
                      : design.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function FormatButton({
  value,
  label,
  description,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 15,
        borderRadius: 10,
        border: selected
          ? "2px solid #16a34a"
          : "1px solid #ccc",
        background: selected
          ? "#f0fdf4"
          : "#fff",
        cursor: "pointer",
        textAlign: "right",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: "bold",
          marginBottom: 5,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#666",
        }}
      >
        {description}
      </div>
    </button>
  );
}
