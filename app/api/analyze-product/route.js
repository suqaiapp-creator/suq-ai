import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { product } = await request.json();

    if (!product) {
      return Response.json(
        {
          error: "بيانات المنتج غير موجودة",
        },
        { status: 400 }
      );
    }

    const productName = product.name || "";
    const brand = product.brand || "";
    const category = product.category || "";
    const barcode = product.barcode || "";

    const searchQuery = `
ابحث عن المنتج التالي بشكل دقيق:

اسم المنتج: ${productName}
العلامة التجارية: ${brand}
التصنيف: ${category}
الباركود: ${barcode || "غير متوفر"}

أريد معلومات المنتج الحقيقي نفسه، وليس معلومات عامة عن نفس الفئة.

الأولوية للمصادر التالية:
1. الموقع الرسمي للعلامة التجارية.
2. صفحات المنتج الرسمية.
3. المتاجر الموثوقة التي تعرض نفس المنتج.
4. مصادر موثوقة أخرى عند الحاجة.

إذا وجدت اختلافًا بين المصادر، لا تخترع نتيجة. اذكر أن المعلومة تحتاج تحقق.
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",

      tools: [
        {
          type: "web_search",
        },
      ],

      input: [
        {
          role: "system",
          content: `
أنت "ذكاء المنتج" في منصة سوق AI.

مهمتك البحث عن المنتج الحقيقي وتجهيز ملف معلومات احترافي لصاحب المتجر.

مهم جدًا:

- لا تخترع معلومات.
- لا تعتبر تخمينك حقيقة.
- لا تستخدم معلومات منتج مشابه على أنها معلومات المنتج المطلوب.
- إذا لم تجد معلومة موثوقة، اكتب "غير متوفر".
- إذا وجدت المعلومة لكن المصدر غير كافٍ، اكتب "يحتاج تحقق".
- لا تخترع المكونات.
- لا تخترع الحجم.
- لا تخترع بلد المنشأ.
- لا تخترع الشركة المصنعة.
- لا تخترع الضمان.
- لا تخترع فوائد صحية أو علاجية.
- لا تخترع أرقامًا أو شهادات.
- السعر الذي يدخله صاحب المتجر لا يتم تغييره.
- الهدف هو تجهيز معلومات المنتج، وليس كتابة إعلان.

أريد نتيجة JSON فقط.
          `,
        },
        {
          role: "user",
          content: searchQuery,
        },
      ],
    });

    const text = response.output_text;

    if (!text) {
      return Response.json(
        {
          error: "لم يتم الحصول على نتيجة من البحث.",
        },
        { status: 500 }
      );
    }

    const cleanupJson = (value) => {
      return value
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
    };

    let result;

    try {
      result = JSON.parse(cleanupJson(text));
    } catch (parseError) {
      console.error(
        "JSON PARSE ERROR:",
        parseError
      );

      console.error("RAW AI RESULT:", text);

      return Response.json(
        {
          error:
            "تم البحث عن المنتج ولكن تعذر تنظيم النتيجة.",
          raw: text,
        },
        { status: 500 }
      );
    }

    return Response.json({
      product_name:
        result.product_name || productName,

      brand:
        result.brand || brand || "غير متوفر",

      category:
        result.category || category || "غير متوفر",

      short_description:
        result.short_description || "غير متوفر",

      full_description:
        result.full_description || "غير متوفر",

      specifications:
        result.specifications || "غير متوفر",

      features:
        result.features || "غير متوفر",

      uses:
        result.uses || "غير متوفر",

      target_audience:
        result.target_audience || "غير متوفر",

      manufacturer:
        result.manufacturer || "غير متوفر",

      country_of_origin:
        result.country_of_origin || "غير متوفر",

      size_or_volume:
        result.size_or_volume || "غير متوفر",

      ingredients:
        result.ingredients || "غير متوفر",

      warnings:
        result.warnings || "غير متوفر",

      storage:
        result.storage || "غير متوفر",

      warranty:
        result.warranty || "غير متوفر",

      verification_notes:
        result.verification_notes || "",

      confidence:
        result.confidence || "medium",

      sources:
        Array.isArray(result.sources)
          ? result.sources
          : [],
    });
  } catch (error) {
    console.error(
      "ANALYZE PRODUCT ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "حدث خطأ أثناء البحث وتحليل المنتج.",
      },
      { status: 500 }
    );
  }
}
