import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

function isProductUnclear(product) {
  if (!product) return true;

  if (
    product.verification_status === "review" ||
    product.verification_status === "unverified"
  ) {
    return true;
  }

  if (
    product.confidence === "low" ||
    product.confidence === "منخفض" ||
    product.confidence === "medium" ||
    product.confidence === "متوسط"
  ) {
    return true;
  }

  if (
    product.name &&
    (!product.brand ||
      !product.category ||
      !product.description)
  ) {
    return true;
  }

  return false;
}

export async function POST(request) {
  let userId = null;
  let shopId = null;
  let productId = null;

  try {
    /*
     * -----------------------------------------
     * 1. التحقق من المستخدم الحالي
     * -----------------------------------------
     */

    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(
                ({ name, value, options }) => {
                  cookieStore.set(name, value, options);
                }
              );
            } catch {
              // لا نحتاج لتعديل الكوكيز هنا
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return Response.json(
        {
          error: "يجب تسجيل الدخول أولاً.",
        },
        { status: 401 }
      );
    }

    userId = user.id;

    /*
     * -----------------------------------------
     * 2. قراءة الطلب
     * -----------------------------------------
     */

    const body = await request.json();

    const incomingProduct = body?.product || null;

    productId =
      body?.productId ||
      incomingProduct?.id ||
      null;

    if (!productId) {
      return Response.json(
        {
          error: "معرف المنتج غير موجود.",
        },
        { status: 400 }
      );
    }

    /*
     * -----------------------------------------
     * 3. جلب المنتج الحقيقي من قاعدة البيانات
     * -----------------------------------------
     *
     * لا نعتمد على بيانات المنتج المرسلة من المتصفح.
     */

    const { data: product, error: productError } =
      await supabaseAdmin
        .from("products")
        .select(
          `
          id,
          shop_id,
          name,
          brand,
          category,
          price,
          currency,
          description,
          specifications,
          features,
          uses,
          target_audience,
          manufacturer,
          country_of_origin,
          size_or_volume,
          ingredients,
          warnings,
          storage,
          warranty,
          verification_notes,
          confidence,
          verification_status,
          safety_status,
          ai_status,
          model_number
        `
        )
        .eq("id", productId)
        .maybeSingle();

    if (productError) {
      console.error(
        "PRODUCT LOAD ERROR:",
        productError
      );

      return Response.json(
        {
          error: "تعذر قراءة بيانات المنتج.",
        },
        { status: 500 }
      );
    }

    if (!product) {
      return Response.json(
        {
          error: "المنتج غير موجود.",
        },
        { status: 404 }
      );
    }

    shopId = product.shop_id || null;

    /*
     * -----------------------------------------
     * 4. التحقق من ملكية المنتج
     * -----------------------------------------
     */

    if (!shopId) {
      return Response.json(
        {
          error:
            "هذا المنتج غير مرتبط بمحل.",
        },
        { status: 403 }
      );
    }

    const { data: shop, error: shopError } =
      await supabaseAdmin
        .from("shops")
        .select(
          `
          id,
          owner_id
        `
        )
        .eq("id", shopId)
        .maybeSingle();

    if (shopError) {
      console.error(
        "SHOP LOAD ERROR:",
        shopError
      );

      return Response.json(
        {
          error: "تعذر التحقق من المحل.",
        },
        { status: 500 }
      );
    }

    if (!shop) {
      return Response.json(
        {
          error: "المحل غير موجود.",
        },
        { status: 404 }
      );
    }

    if (shop.owner_id !== user.id) {
      return Response.json(
        {
          error:
            "ليس لديك صلاحية إنشاء محتوى لهذا المنتج.",
        },
        { status: 403 }
      );
    }

    /*
     * -----------------------------------------
     * 5. منع المنتجات المقفلة
     * -----------------------------------------
     */

    if (
      product.safety_status === "locked" ||
      product.verification_status === "locked"
    ) {
      return Response.json(
        {
          error:
            "لا يمكن إنشاء محتوى تسويقي لهذا المنتج لأنه مقفل للمراجعة.",
        },
        { status: 403 }
      );
    }

    /*
     * -----------------------------------------
     * 6. المنتجات غير الواضحة
     * -----------------------------------------
     *
     * إذا كانت المعلومات غير واضحة:
     * يجب أن يكون التاجر قد وافق على المسؤولية.
     */

    const unclear = isProductUnclear(product);

    if (unclear) {
      const {
        data: responsibilityAcceptance,
        error: responsibilityError,
      } = await supabaseAdmin
        .from(
          "product_responsibility_acceptances"
        )
        .select(
          "id, user_id, shop_id, product_id, policy_version, accepted_at"
        )
        .eq("user_id", user.id)
        .eq("shop_id", shopId)
        .eq("product_id", product.id)
        .maybeSingle();

      if (responsibilityError) {
        console.error(
          "RESPONSIBILITY CHECK ERROR:",
          responsibilityError
        );

        return Response.json(
          {
            error:
              "تعذر التحقق من موافقة مسؤولية المنتج.",
          },
          { status: 500 }
        );
      }

      if (!responsibilityAcceptance) {
        return Response.json(
          {
            error:
              "هذا المنتج يحتاج إلى تأكيد مسؤولية التاجر قبل إنشاء المحتوى التسويقي.",
            code: "RESPONSIBILITY_REQUIRED",
          },
          { status: 403 }
        );
      }
    }

    /*
     * -----------------------------------------
     * 7. تجهيز بيانات المنتج
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

رقم الموديل:
${product.model_number || ""}

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
     * 8. طلب الذكاء الاصطناعي
     * -----------------------------------------
     */

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    /*
     * -----------------------------------------
     * 9. قراءة استخدام AI
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
     * 10. قراءة النتيجة
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
            "تعذر قراءة نتيجة الذكاء الاصطناعي.",
        },
        { status: 500 }
      );
    }

    /*
     * -----------------------------------------
     * 11. تسجيل العملية الناجحة
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
        responsibility_required: unclear,
      },
    });

    /*
     * -----------------------------------------
     * 12. إرجاع المحتوى
     * -----------------------------------------
     */

    return Response.json(content);
  } catch (error) {
    console.error(
      "OPENAI MARKETING ERROR:",
      error
    );

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
          "حدث خطأ أثناء إنشاء المحتوى بالذكاء الاصطناعي.",
      },
      { status: 500 }
    );
  }
}
