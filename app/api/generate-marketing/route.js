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
أنت خبير تسويق للمتاجر في الإمارات.

مهمتك إنشاء محتوى تسويقي احترافي للمنتج التالي.

بيانات المنتج:
الاسم: ${product.name || ""}
العلامة التجارية: ${product.brand || ""}
التصنيف: ${product.category || ""}
السعر: ${product.price || ""}
العملة: ${product.currency || "AED"}

الوصف الذي أدخله صاحب المنتج:
${product.description || ""}

المواصفات:
${product.specifications || ""}

المميزات:
${product.features || ""}

قواعد مهمة جدًا:
1. لا تخترع أي مواصفة أو معلومة غير موجودة في البيانات.
2. لا تضف أرقامًا أو تقنيات أو شهادات أو ضمانات غير مذكورة.
3. إذا كانت معلومة غير موجودة، لا تخمنها.
4. اجعل المحتوى مناسبًا للسوق الإماراتي.
5. استخدم لغة عربية واضحة واحترافية.
6. اجعل النص جذابًا بدون مبالغة أو ادعاءات غير مؤكدة.

أرجع النتيجة بصيغة JSON فقط بهذا الشكل:

{
  "marketing_description": "",
  "instagram": "",
  "whatsapp": "",
  "tiktok_snapchat": "",
  "seo_title": "",
  "seo_description": "",
  "seo_keywords": "",
  "call_to_action": ""
}
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const text = response.output_text;

    let content;

    try {
      content = JSON.parse(text);
    } catch {
      return Response.json(
        {
          error: "تعذر قراءة نتيجة الذكاء الاصطناعي",
          raw: text,
        },
        { status: 500 }
      );
    }

    return Response.json(content);
  } catch (error) {
    console.error("OPENAI ERROR:", error);

    return Response.json(
      {
        error: "حدث خطأ أثناء إنشاء المحتوى بالذكاء الاصطناعي",
      },
      { status: 500 }
    );
  }
}
