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

    const productName = String(product.name || "").trim();
    const brand = String(product.brand || "").trim();
    const category = String(product.category || "").trim();
    const barcode = String(product.barcode || "").trim();

    if (!productName) {
      return Response.json(
        {
          error: "اسم المنتج مطلوب",
        },
        { status: 400 }
      );
    }

    const instructions = `
أنت نظام "ذكاء المنتج" في منصة سوق AI.

مهمتك:
البحث عن المنتج الحقيقي الموجود في السوق، ثم استخراج معلومات موثوقة عنه.

بيانات المنتج التي أدخلها صاحب المتجر:

اسم المنتج:
${productName}

العلامة التجارية:
${brand || "غير محددة"}

التصنيف:
${category || "غير محدد"}

الباركود:
${barcode || "غير متوفر"}

قواعد البحث:

1. ابحث عن نفس المنتج بالاسم والعلامة التجارية.
2. إذا كان هناك باركود، استخدمه لتحديد المنتج بدقة.
3. الأولوية للموقع الرسمي للشركة أو العلامة التجارية.
4. بعد ذلك استخدم المتاجر الموثوقة وصفحات المنتجات التي تطابق نفس المنتج.
5. لا تستخدم معلومات منتج مشابه على أنها معلومات هذا المنتج.
6. لا تخترع أي معلومة.
7. لا تخمن الحجم أو المكونات أو بلد المنشأ.
8. لا تخمن الشركة المصنعة.
9. لا تخمن الضمان.
10. لا تضف فوائد صحية أو علاجية غير مثبتة.
11. إذا وجدت معلومة في مصدر موثوق، أعدها.
12. إذا وجدت اختلافًا بين المصادر، وضّح الاختلاف في verification_notes.
13. إذا لم تجد المعلومة، اكتب "غير متوفر".
14. إذا كانت المعلومة موجودة ولكن لا يمكن التأكد منها بشكل كافٍ، اكتب "يحتاج تحقق".
15. السعر الذي أدخله صاحب المتجر لا تغيّره.
16. لا تكتب إعلانًا تسويقيًا في هذه المرحلة.
17. الهدف هو بناء بطاقة معلومات حقيقية للمنتج.

مهم جدًا:
يجب أن تكون النتيجة JSON فقط.
لا تستخدم Markdown.
لا تستخدم ```json.
`;

    const userQuery = `
ابحث عن هذا المنتج الحقيقي:

"${productName}"

العلامة التجارية:
"${brand || "غير محددة"}"

التصنيف:
"${category || "غير محدد"}"

الباركود:
"${barcode || "غير متوفر"}"

ابحث بأكثر من صيغة للاسم إذا كان ذلك يساعد على العثور على المنتج الصحيح.

إذا وجدت صفحة رسمية للمنتج، اعتمد عليها أولًا.
إذا لم توجد، استخدم مصادر موثوقة تعرض نفس المنتج.
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",

      tools: [
        {
          type: "web_search",
        },
      ],

      instructions,

      input: userQuery,
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

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        result = JSON.parse(cleaned);
      } catch (parseError) {
        console.error("JSON PARSE ERROR:", parseError);
        console.error("RAW AI RESULT:", text);

        return Response.json(
          {
            error: "تم العثور على معلومات ولكن تعذر تنظيمها.",
            raw: text,
          },
          { status: 500 }
        );
      }
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
        result.verification_notes || "غير متوفر",

      confidence:
        result.confidence || "medium",

      sources:
        Array.isArray(result.sources)
          ? result.sources
          : [],
    });
  } catch (error) {
    console.error("ANALYZE PRODUCT ERROR:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "حدث خطأ أثناء البحث وتحليل المنتج.",
      },
      { status: 500 }
    );
  }
}
