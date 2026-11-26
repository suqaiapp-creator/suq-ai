import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { logAIUsage } from "../../../lib/ai-usage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request) {
  let userId = null;
  let shopId = null;
  let productId = null;

  try {
    const body = await request.json();

    const product = body?.product || null;

    if (!product) {
      return Response.json(
        { error: "بيانات المنتج غير موجودة" },
        { status: 400 }
      );
    }

    productId = product.id || body.productId || null;

    /*
     * -----------------------------------------
     * 1. الحصول على المحل وصاحب المنتج
     * -----------------------------------------
     */

    if (productId) {
      const { data: productData } = await supabaseAdmin
        .from("products")
        .select(
          `
          id,
          shop_id,
          shops (
            id,
            owner_id
          )
        `
        )
        .eq("id", productId)
        .maybeSingle();

      if (productData) {
        shopId = productData.shop_id || null;
        userId = productData.shops?.owner_id || null;
      }
    }

    /*
     * -----------------------------------------
     * 2. منع التسويق للمنتجات المقفلة
     * -----------------------------------------
     */

    if (productId) {
      const { data: productStatus } = await supabaseAdmin
        .from("products")
        .select(
          "id, safety_status, verification_status"
        )
        .eq("id", productId)
        .maybeSingle();

      if (
        productStatus?.safety_status === "locked" ||
        productStatus?.verification_status === "locked"
      ) {
        return Response.json(
          {
            error:
              "لا يمكن إنشاء محتوى تسويقي لهذا المنتج لأنه مقفل للمراجعة.",
          },
          { status: 403 }
        );
      }
    }

    /*
     * -----------------------------------------
     * 3. تجهيز بيانات المنتج
     * -----------------------------------------
     */

    const prompt = `
أنت خبير تسويق للمتاجر في الإمارات.

مهمتك إنشاء محتوى تسويقي احترافي للمنتج التالي.

بيانات المنتج:
الاسم: ${product.name || ""}
العلامة التجارية: ${product.brand || ""}
التصنيف: ${product.category || ""}
السعر: ${product.price || ""}
العملة: ${product.currency || "AED"}

الوصف:
${product.description || ""}

الوصف التفصيلي:
${product.full_description || ""}

المواصفات:
${product.specifications || ""}

المميزات:
${product.features || ""}

الاستخدامات:
${product.uses || ""}

الفئة المستهدفة:
${product.target_audience || ""}

الشركة المصنعة:
${product.manufacturer || ""}

بلد المنشأ:
${product.country_of_origin || ""}

الحجم أو السعة:
${product.size_or_volume || ""}

المكونات:
${product.ingredients || ""}

التحذيرات:
${product.warnings || ""}

التخزين:
${product.storage || ""}

الضمان:
${product.warranty || ""}

ملاحظات التحقق:
${product.verification_notes || ""}

قواعد مهمة جدًا:

1. لا تخترع أي مواصفة أو معلومة غير موجودة.
2. لا تضف أرقامًا أو تقنيات أو شهادات أو ضمانات غير مذكورة.
3. إذا كانت معلومة غير موجودة، لا تخمنها.
4. لا تستخدم معلومات غير موجودة في بيانات المنتج.
5. لا تدّعي أن المنتج أصلي أو معتمد أو آمن إلا إذا كانت المعلومة مؤكدة في البيانات.
6. اجعل المحتوى مناسبًا للسوق الإماراتي.
7. استخدم لغة عربية واضحة واحترافية.
8. اجعل النص جذابًا بدون مبالغة أو ادعاءات غير مؤكدة.
9. لا تذكر التحذيرات أو المعلومات الداخلية بطريقة تسويقية مضللة.
10. لا تغير اسم المنتج أو العلامة التجارية.
11. السعر يستخدم فقط إذا كان موجودًا.
12. لا تخترع خصومات أو عروضًا أو أسعارًا جديدة.
13. لا تخترع معلومات عن الشحن أو التوصيل.
14. لا تخترع وسائل دفع.
15. اجعل كل منصة مناسبة لأسلوبها.

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

    /*
     * -----------------------------------------
     * 4. طلب الذكاء الاصطناعي
     * -----------------------------------------
     */

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    /*
     * -----------------------------------------
     * 5. تسجيل استخدام AI
     * -----------------------------------------
     */

    const usage = response.usage || {};

    const inputTokens =
      usage.input_tokens || 0;

    const outputTokens =
      usage.output_tokens || 0;

    const totalTokens =
      usage.total_tokens ||
      inputTokens + outputTokens;

    const text = response.output_text;

    /*
     * -----------------------------------------
     * 6. قراءة النتيجة
     * -----------------------------------------
     */

    let content;

    try {
      content = JSON.parse(text);
    } catch {
      await logAIUsage({
        userId,
        shopId,
        productId,
        operation: "marketing_generation",
        model: "gpt-5-mini",
        status: "failed",
        inputTokens,
        outputTokens,
        totalTokens,
        metadata: {
          source: "generate-marketing",
          reason: "invalid_json",
        },
      });

      return Response.json(
        {
          error:
            "تعذر قراءة نتيجة الذكاء الاصطناعي",
        },
        { status: 500 }
      );
    }

    /*
     * -----------------------------------------
     * 7. تسجيل العملية الناجحة
     * -----------------------------------------
     */

    await logAIUsage({
      userId,
      shopId,
      productId,
      operation: "marketing_generation",
      model: "gpt-5-mini",
      status: "success",
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: 0,
      metadata: {
        source: "generate-marketing",
      },
    });

    /*
     * -----------------------------------------
     * 8. إرجاع المحتوى
     * -----------------------------------------
     */

    return Response.json(content);
  } catch (error) {
    console.error(
      "OPENAI MARKETING ERROR:",
      error
    );

    /*
     * تسجيل فشل العملية إذا كان لدينا معرف المنتج
     */

    await logAIUsage({
      userId,
      shopId,
      productId,
      operation: "marketing_generation",
      model: "gpt-5-mini",
      status: "failed",
      estimatedCost: 0,
      metadata: {
        source: "generate-marketing",
        error:
          error?.message ||
          "unknown_error",
      },
    });

    return Response.json(
      {
        error:
          "حدث خطأ أثناء إنشاء المحتوى بالذكاء الاصطناعي",
      },
      { status: 500 }
    );
  }
}
