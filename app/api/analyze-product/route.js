import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { product } = await request.json();

    if (!product) {
      return Response.json(
        { error: "بيانات المنتج غير موجودة" },
        { status: 400 }
      );
    }

    const prompt = `
أنت نظام "ذكاء المنتج" لمنصة سوق AI.

مهمتك تحليل بيانات المنتج وتجهيز ملف منتج احترافي يساعد صاحب المتجر لاحقًا في التسويق.

بيانات المنتج الحالية:

اسم المنتج:
${product.name || "غير متوفر"}

العلامة التجارية:
${product.brand || "غير متوفر"}

التصنيف:
${product.category || "غير متوفر"}

السعر:
${product.price || "غير متوفر"}

الباركود:
${product.barcode || "غير متوفر"}

الوصف الذي أدخله المستخدم:
${product.description || "غير متوفر"}

المواصفات:
${product.specifications || "غير متوفر"}

المميزات:
${product.features || "غير متوفر"}

قواعد مهمة جدًا:

1. لا تخترع معلومات على أنها حقيقة.
2. إذا كانت معلومة غير معروفة، اكتب "غير متوفر".
3. لا تخترع مواصفات أو أرقام أو شهادات أو ضمانات.
4. لا تخترع فوائد طبية أو علاجية.
5. إذا كان المنتج طبيًا أو صحيًا، لا تذكر ادعاءات علاجية غير مؤكدة.
6. يمكنك تنظيم المعلومات الموجودة وتحسين صياغتها.
7. يمكنك اقتراح معلومات تحتاج إلى تحقق، لكن يجب أن تكون واضحة بأنها "تحتاج تحقق".
8. الهدف هو إنشاء ملف منتج يمكن مراجعته واعتماده من صاحب المتجر.
9. استخدم العربية الواضحة والمناسبة للسوق الإماراتي.

أرجع JSON فقط بهذا الشكل:

{
  "product_name": "",
  "brand": "",
  "category": "",
  "short_description": "",
  "full_description": "",
  "specifications": "",
  "features": "",
  "uses": "",
  "target_audience": "",
  "manufacturer": "",
  "country_of_origin": "",
  "size_or_volume": "",
  "ingredients": "",
  "warnings": "",
  "storage": "",
  "warranty": "",
  "verification_notes": "",
  "confidence": "high"
}
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const text = response.output_text;

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      return Response.json(
        {
          error: "تعذر قراءة نتيجة ذكاء المنتج",
          raw: text,
        },
        { status: 500 }
      );
    }

    return Response.json(result);
  } catch (error) {
    console.error("ANALYZE PRODUCT ERROR:", error);

    return Response.json(
      {
        error: "حدث خطأ أثناء تحليل المنتج بالذكاء الاصطناعي",
      },
      { status: 500 }
    );
  }
}
