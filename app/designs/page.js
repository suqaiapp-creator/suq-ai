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
  const [generating, setGenerating] = useState(false);
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

  async function createDesign() {
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

    setGenerating(true);
    setMessage("⏳ جاري تجهيز التصميم...");

    try {
      // إنشاء سجل التصميم أولًا
      const { data: design, error: insertError } =
        await supabase
          .from("ad_images")
          .insert({
            product_id: selectedProduct,
            format,
            status: "generating",
          })
          .select()
          .single();

      if (insertError) {
        console.error(insertError);
        throw new Error("تعذر إنشاء طلب التصميم");
      }

      // طلب إنشاء الصورة
      const response = await fetch(
        "/api/generate-ad-image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product,
            format,
            designId: design.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        await supabase
          .from("ad_images")
          .update({
            status: "failed",
          })
          .eq("id", design.id);

        throw new Error(
          result.error || "تعذر إنشاء الصورة"
        );
      }

      setMessage("✅ تم إنشاء التصميم بنجاح.");

      await loadDesigns(selectedProduct);
    } catch (error) {
      console.error(error);

      setMessage(
        `❌ ${error.message || "حدث خطأ أثناء إنشاء التصميم"}`
      );

      await loadDesigns(selectedProduct);
    } finally {
      setGenerating(false);
    }
  }

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

  const selectedProductData = products.find(
    (item) => item.id === selectedProduct
  );

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
            أنشئ تصاميم إعلانية احترافية لمنتجاتك.
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
            </option>
          ))}
        </select>
      </section>

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
            label="⬛ 1:1"
            description="Instagram"
            selected={format === "1:1"}
            onClick={() => setFormat("1:1")}
          />

          <FormatButton
            label="📱 9:16"
            description="TikTok / Reels / Snapchat"
            selected={format === "9:16"}
            onClick={() => setFormat("9:16")}
          />

          <FormatButton
            label="🖥️ 16:9"
            description="YouTube / شاشة"
            selected={format === "16:9"}
            onClick={() => setFormat("16:9")}
          />
        </div>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <h2>3️⃣ إنشاء التصميم</h2>

        <p style={{ color: "#666" }}>
          سيتم إنشاء صورة إعلانية للمنتج بالمقاس
          الذي اخترته.
        </p>

        <button
          onClick={createDesign}
          disabled={generating}
          style={{
            padding: "15px 30px",
            borderRadius: 10,
            border: "none",
            background: generating
              ? "#999"
              : "#16a34a",
            color: "#fff",
            fontSize: 18,
            cursor: generating
              ? "not-allowed"
              : "pointer",
          }}
        >
          {generating
            ? "⏳ جاري إنشاء التصميم..."
            : "🎨 إنشاء تصميم إعلاني"}
        </button>
      </section>

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
                      : design.status === "generating"
                      ? "⏳ جاري الإنشاء"
                      : design.status === "completed"
                      ? "✅ مكتمل"
                      : "❌ فشل"}
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
