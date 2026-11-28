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

const MARKETING_OPERATION_KEY = "create_marketing";

// =========================================================
// Product clarity
// =========================================================

function isProductUnclear(product) {
  if (!product) {
    return true;
  }

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
    (
      !product.brand ||
      !product.category ||
      !product.description
    )
  ) {
    return true;
  }

  return false;
}

// =========================================================
// Refund helper
// =========================================================

async function refundMarketingPoints({
  supabaseAuth,
  transactionId,
  userId,
  shopId,
  productId,
  reason,
  stage,
  errorMessage,
}) {
  if (!transactionId) {
    return {
      success: false,
      refunded: false,
      error: "لا توجد عملية نقاط لاسترجاعها.",
    };
  }

  try {
    const {
      data: refundResult,
      error: refundError,
    } = await supabaseAuth.rpc(
      "refund_operation_points",
      {
        p_transaction_id: transactionId,

        p_reason:
          reason ||
          "استرجاع نقاط بسبب فشل عملية التسويق.",

        p_metadata: {
          source:
            "generate-marketing",

          user_id:
            userId,

          shop_id:
            shopId,

          product_id:
            productId,

          stage:
            stage || "unknown",

          error:
            errorMessage || null,
        },
      }
    );

    if (refundError) {
      console.error(
        "MARKETING POINTS REFUND ERROR:",
        refundError
      );

      return {
        success: false,
        refunded: false,
        error: refundError.message,
      };
    }

    return {
      success: true,
      ...(refundResult || {}),
    };
  } catch (error) {
    console.error(
      "MARKETING REFUND UNEXPECTED ERROR:",
      error
    );

    return {
      success: false,
      refunded: false,
      error:
        error?.message ||
        "تعذر استرجاع النقاط.",
    };
  }
}

// =========================================================
// Resolve transaction safely
// =========================================================

async function resolvePointsTransaction({
  userId,
  referenceType,
  referenceId,
}) {
  if (!userId || !referenceType || !referenceId) {
    return null;
  }

  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("point_transactions")
      .select(
        "id, user_id, amount, type, reference_type, reference_id, provider"
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "reference_type",
        referenceType
      )
      .eq(
        "reference_id",
        referenceId
      )
      .eq(
        "type",
        "debit"
      )
      .eq(
        "provider",
        "suq_ai_points"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "RESOLVE POINT TRANSACTION ERROR:",
        error
      );

      return null;
    }

    return data || null;
  } catch (error) {
    console.error(
      "RESOLVE POINT TRANSACTION UNEXPECTED ERROR:",
      error
    );

    return null;
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(request) {
  let userId = null;
  let shopId = null;
  let productId = null;

  let supabaseAuth = null;

  let pointsTransactionId = null;
  let pointsCharged = 0;
  let balanceAfter = null;

  let product = null;
  let unclear = false;

  let operationReferenceId = null;

  try {
    // =====================================================
    // 1. User session
    // =====================================================

    const cookieStore = await cookies();

    supabaseAuth = createServerClient(
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
                  cookieStore.set(
                    name,
                    value,
                    options
                  );
                }
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return Response.json(
        {
          error:
            "يجب تسجيل الدخول أولاً.",
        },
        {
          status: 401,
        }
      );
    }

    userId = user.id;

    // =====================================================
    // 2. Read request
    // =====================================================

    const body =
      await request.json();

    const incomingProduct =
      body?.product || null;

    productId =
      body?.productId ||
      incomingProduct?.id ||
      null;

    if (!productId) {
      return Response.json(
        {
          error:
            "معرف المنتج غير موجود.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // 3. Load product
    // =====================================================

    const {
      data: productData,
      error: productError,
    } =
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
          error:
            "تعذر قراءة بيانات المنتج.",
        },
        {
          status: 500,
        }
      );
    }

    if (!productData) {
      return Response.json(
        {
          error:
            "المنتج غير موجود.",
        },
        {
          status: 404,
        }
      );
    }

    product = productData;

    // =====================================================
    // 4. Validate shop
    // =====================================================

    shopId =
      product.shop_id || null;

    if (!shopId) {
      return Response.json(
        {
          error:
            "هذا المنتج غير مرتبط بمحل.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: shop,
      error: shopError,
    } =
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
          error:
            "تعذر التحقق من المحل.",
        },
        {
          status: 500,
        }
      );
    }

    if (!shop) {
      return Response.json(
        {
          error:
            "المحل غير موجود.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // 5. Shop ownership
    // =====================================================

    if (shop.owner_id !== user.id) {
      return Response.json(
        {
          error:
            "ليس لديك صلاحية إنشاء محتوى لهذا المنتج.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 6. Product protection
    // =====================================================

    if (
      product.safety_status === "locked" ||
      product.safety_status === "violation" ||
      product.verification_status === "locked"
    ) {
      return Response.json(
        {
          error:
            "لا يمكن إنشاء محتوى تسويقي لهذا المنتج لأنه مقفل للمراجعة.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 7. Product clarity
    // =====================================================

    unclear =
      isProductUnclear(product);

    // =====================================================
    // 8. Trader responsibility
    // =====================================================

    if (unclear) {
      const {
        data: responsibilityAcceptance,
        error: responsibilityError,
      } =
        await supabaseAdmin
          .from(
            "product_responsibility_acceptances"
          )
          .select(
            `
            id,
            user_id,
            shop_id,
            product_id,
            policy_version,
            accepted_at
            `
          )
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "shop_id",
            shopId
          )
          .eq(
            "product_id",
            product.id
          )
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
          {
            status: 500,
          }
        );
      }

      if (!responsibilityAcceptance) {
        return Response.json(
          {
            error:
              "هذا المنتج يحتاج إلى تأكيد مسؤولية التاجر قبل إنشاء المحتوى التسويقي.",

            code:
              "RESPONSIBILITY_REQUIRED",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // 9. Independent operation reference
    // =====================================================

    operationReferenceId =
      crypto.randomUUID();

    // =====================================================
    // 10. Charge points
    // =====================================================

    const {
      data: pointsResult,
      error: pointsError,
    } =
      await supabaseAuth.rpc(
        "charge_operation_points",
        {
          p_operation_key:
            MARKETING_OPERATION_KEY,

          p_user_id:
            user.id,

          p_shop_id:
            shopId,

          p_reference_type:
            "marketing_generation",

          p_reference_id:
            operationReferenceId,

          p_description:
            `إنشاء محتوى تسويقي للمنتج: ${
              product.name ||
              "منتج"
            }`,

          p_metadata: {
            source:
              "generate-marketing",

            operation:
              MARKETING_OPERATION_KEY,

            product_id:
              product.id,

            product_name:
              product.name || null,

            responsibility_required:
              unclear,
          },
        }
      );

    if (pointsError) {
      console.error(
        "MARKETING POINTS CHARGE ERROR:",
        pointsError
      );

      const pointsMessage =
        pointsError?.message ||
        "تعذر خصم نقاط العملية.";

      const insufficient =
        pointsMessage.includes(
          "غير كاف"
        ) ||
        pointsMessage.includes(
          "رصيد النقاط"
        ) ||
        pointsMessage.includes(
          "تحتاج"
        );

      return Response.json(
        {
          error: insufficient
            ? pointsMessage
            : "تعذر تجهيز رصيد النقاط لإنشاء المحتوى.",

          code: insufficient
            ? "INSUFFICIENT_POINTS"
            : "POINTS_CHARGE_FAILED",
        },
        {
          status:
            insufficient
              ? 402
              : 500,
        }
      );
    }

    // =====================================================
    // 11. Validate charge result
    // =====================================================

    if (
      !pointsResult ||
      pointsResult.success !== true
    ) {
      console.error(
        "MARKETING POINTS CHARGE INVALID RESULT:",
        pointsResult
      );

      // ---------------------------------------------------
      // محاولة العثور على عملية الخصم من قاعدة البيانات
      // باستخدام المرجع الفريد للعملية.
      // ---------------------------------------------------

      const recoveredTransaction =
        await resolvePointsTransaction({
          userId:
            user.id,

          referenceType:
            "marketing_generation",

          referenceId:
            operationReferenceId,
        });

      if (recoveredTransaction?.id) {
        pointsTransactionId =
          recoveredTransaction.id;

        pointsCharged =
          Number(
            recoveredTransaction.amount ||
              0
          );

        // في هذه الحالة تم العثور على الخصم فعليًا،
        // لذلك نسترجعه قبل إنهاء العملية.

        const refundResult =
          await refundMarketingPoints({
            supabaseAuth,
            transactionId:
              pointsTransactionId,
            userId,
            shopId,
            productId,
            reason:
              "استرجاع نقاط بسبب نتيجة غير صالحة من عملية خصم نقاط التسويق.",
            stage:
              "invalid_charge_result_recovered",
            errorMessage:
              "Charge RPC returned an invalid result after a debit transaction was found.",
          });

        return Response.json(
          {
            error:
              "تعذر تأكيد عملية النقاط وتم استرجاع النقاط تلقائيًا.",

            code:
              "POINTS_CHARGE_INVALID_RESULT",

            pointsRefunded:
              !!refundResult?.refunded,

            refundTransactionId:
              refundResult?.refund_transaction_id ||
              null,
          },
          {
            status: 500,
          }
        );
      }

      // إذا لم نجد أي عملية خصم فعلية،
      // نوقف العملية بدون محاولة استرجاع وهمي.

      return Response.json(
        {
          error:
            "تعذر تأكيد خصم نقاط العملية.",

          code:
            "POINTS_CHARGE_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 12. Resolve transaction ID
    // =====================================================

    pointsTransactionId =
      pointsResult.transaction_id ||
      null;

    // -----------------------------------------------------
    // إذا لم يرجع RPC رقم العملية، نبحث عنه بالمرجع.
    // -----------------------------------------------------

    if (!pointsTransactionId) {
      const recoveredTransaction =
        await resolvePointsTransaction({
          userId:
            user.id,

          referenceType:
            "marketing_generation",

          referenceId:
            operationReferenceId,
        });

      if (recoveredTransaction?.id) {
        pointsTransactionId =
          recoveredTransaction.id;

        pointsCharged =
          Number(
            recoveredTransaction.amount ||
              0
          );
      }
    }

    // -----------------------------------------------------
    // إذا لم نستطع الحصول على transaction ID،
    // لا نكمل إلى OpenAI.
    // -----------------------------------------------------

    if (!pointsTransactionId) {
      console.error(
        "MARKETING POINTS TRANSACTION ID MISSING:",
        {
          pointsResult,
          operationReferenceId,
          userId,
          shopId,
          productId,
        }
      );

      return Response.json(
        {
          error:
            "تعذر تأكيد مرجع عملية النقاط، ولم يتم تشغيل الذكاء الاصطناعي.",

          code:
            "POINTS_TRANSACTION_REFERENCE_MISSING",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 13. Points values
    // =====================================================

    pointsCharged =
      Number(
        pointsResult.points_charged ??
          pointsCharged ??
          0
      );

    balanceAfter =
      Number(
        pointsResult.balance_after ??
          0
      );

    // =====================================================
    // 14. Prompt
    // =====================================================

    const prompt = `
أنت خبير تسويق للمتاجر في الإمارات.

مهمتك إنشاء محتوى تسويقي احترافي للمنتج التالي.

بيانات المنتج:

الاسم:
${product.name || ""}

العلامة التجارية:
${product.brand || ""}

التصنيف:
${product.category || ""}

السعر:
${product.price || ""}

العملة:
${product.currency || "AED"}

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

    // =====================================================
    // 15. OpenAI
    // =====================================================

    let response;

    try {
      response =
        await openai.responses.create({
          model:
            "gpt-5-mini",

          input:
            prompt,
        });
    } catch (openaiError) {
      console.error(
        "OPENAI API ERROR:",
        openaiError
      );

      const refundResult =
        await refundMarketingPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          reason:
            "استرجاع نقاط بسبب فشل الاتصال بخدمة الذكاء الاصطناعي.",
          stage:
            "openai_request",
          errorMessage:
            openaiError?.message ||
            "OpenAI request failed",
        });

      try {
        await logAIUsage({
          userId,
          shopId,
          productId,
          operation:
            "marketing_generation",
          model:
            "gpt-5-mini",
          status:
            "failed",
          metadata: {
            source:
              "generate-marketing",

            stage:
              "openai_request",

            error:
              openaiError?.message ||
              "OpenAI request failed",

            points_transaction_id:
              pointsTransactionId,

            points_charged:
              pointsCharged,

            points_refunded:
              !!refundResult?.refunded,

            refund_transaction_id:
              refundResult?.refund_transaction_id ||
              null,

            operation_reference_id:
              operationReferenceId,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOG ERROR:",
          usageError
        );
      }

      return Response.json(
        {
          error:
            "حدث خطأ أثناء إنشاء المحتوى بالذكاء الاصطناعي.",

          pointsRefunded:
            !!refundResult?.refunded,

          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 16. Usage
    // =====================================================

    const usage =
      response?.usage || {};

    const inputTokens =
      Number(
        usage.input_tokens || 0
      );

    const outputTokens =
      Number(
        usage.output_tokens || 0
      );

    const totalTokens =
      Number(
        usage.total_tokens || 0
      ) ||
      inputTokens +
        outputTokens;

    const text =
      response?.output_text ||
      "";

    // =====================================================
    // 17. Empty response
    // =====================================================

    if (!text.trim()) {
      const refundResult =
        await refundMarketingPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          reason:
            "استرجاع نقاط بسبب عدم الحصول على نتيجة من الذكاء الاصطناعي.",
          stage:
            "empty_openai_response",
          errorMessage:
            "OpenAI returned empty response",
        });

      try {
        await logAIUsage({
          userId,
          shopId,
          productId,
          operation:
            "marketing_generation",
          model:
            "gpt-5-mini",
          status:
            "failed",
          inputTokens,
          outputTokens,
          totalTokens,
          metadata: {
            source:
              "generate-marketing",

            stage:
              "empty_openai_response",

            points_transaction_id:
              pointsTransactionId,

            points_charged:
              pointsCharged,

            points_refunded:
              !!refundResult?.refunded,

            refund_transaction_id:
              refundResult?.refund_transaction_id ||
              null,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOG ERROR:",
          usageError
        );
      }

      return Response.json(
        {
          error:
            "لم يتم الحصول على محتوى من الذكاء الاصطناعي.",

          pointsRefunded:
            !!refundResult?.refunded,

          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 18. Parse JSON
    // =====================================================

    let content;

    try {
      content =
        JSON.parse(text);
    } catch (parseError) {
      console.error(
        "OPENAI JSON PARSE ERROR:",
        parseError
      );

      const refundResult =
        await refundMarketingPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          reason:
            "استرجاع نقاط بسبب فشل قراءة نتيجة المحتوى التسويقي.",
          stage:
            "json_parse",
          errorMessage:
            parseError?.message ||
            "Invalid JSON response",
        });

      try {
        await logAIUsage({
          userId,
          shopId,
          productId,
          operation:
            "marketing_generation",
          model:
            "gpt-5-mini",
          status:
            "failed",
          inputTokens,
          outputTokens,
          totalTokens,
          metadata: {
            source:
              "generate-marketing",

            stage:
              "json_parse",

            points_transaction_id:
              pointsTransactionId,

            points_charged:
              pointsCharged,

            points_refunded:
              !!refundResult?.refunded,

            refund_transaction_id:
              refundResult?.refund_transaction_id ||
              null,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOG ERROR:",
          usageError
        );
      }

      return Response.json(
        {
          error:
            "تعذر قراءة نتيجة الذكاء الاصطناعي.",

          pointsRefunded:
            !!refundResult?.refunded,

          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 19. Validate content object
    // =====================================================

    if (
      !content ||
      typeof content !== "object" ||
      Array.isArray(content)
    ) {
      const refundResult =
        await refundMarketingPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          reason:
            "استرجاع نقاط بسبب نتيجة تسويقية غير صالحة.",
          stage:
            "invalid_content",
          errorMessage:
            "Marketing result is not a valid object",
        });

      try {
        await logAIUsage({
          userId,
          shopId,
          productId,
          operation:
            "marketing_generation",
          model:
            "gpt-5-mini",
          status:
            "failed",
          inputTokens,
          outputTokens,
          totalTokens,
          metadata: {
            source:
              "generate-marketing",

            stage:
              "invalid_content",

            points_transaction_id:
              pointsTransactionId,

            points_charged:
              pointsCharged,

            points_refunded:
              !!refundResult?.refunded,

            refund_transaction_id:
              refundResult?.refund_transaction_id ||
              null,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOG ERROR:",
          usageError
        );
      }

      return Response.json(
        {
          error:
            "نتيجة المحتوى التسويقي غير صالحة.",

          pointsRefunded:
            !!refundResult?.refunded,

          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 20. Successful usage log
    // =====================================================

    try {
      await logAIUsage({
        userId,
        shopId,
        productId,

        operation:
          "marketing_generation",

        model:
          "gpt-5-mini",

        status:
          "success",

        inputTokens,
        outputTokens,
        totalTokens,

        metadata: {
          source:
            "generate-marketing",

          responsibility_required:
            unclear,

          points_operation:
            MARKETING_OPERATION_KEY,

          points_charged:
            pointsCharged,

          points_balance_after:
            balanceAfter,

          points_transaction_id:
            pointsTransactionId,

          operation_reference_id:
            operationReferenceId,
        },
      });
    } catch (usageError) {
      console.error(
        "AI USAGE LOG ERROR:",
        usageError
      );
    }

    // =====================================================
    // 21. Result
    // =====================================================

    return Response.json({
      ...content,

      points: {
        charged:
          pointsCharged,

        balance_after:
          balanceAfter,

        operation:
          MARKETING_OPERATION_KEY,

        transaction_id:
          pointsTransactionId,
      },
    });

  } catch (error) {
    console.error(
      "MARKETING UNEXPECTED ERROR:",
      error
    );

    // =====================================================
    // Unexpected refund
    // =====================================================

    let refundResult = null;

    if (
      supabaseAuth &&
      pointsTransactionId
    ) {
      refundResult =
        await refundMarketingPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          reason:
            "استرجاع نقاط بسبب خطأ غير متوقع أثناء إنشاء المحتوى التسويقي.",
          stage:
            "unexpected_error",
          errorMessage:
            error?.message ||
            "Unexpected marketing error",
        });
    }

    // =====================================================
    // Failed usage log
    // =====================================================

    try {
      await logAIUsage({
        userId,
        shopId,
        productId,

        operation:
          "marketing_generation",

        model:
          "gpt-5-mini",

        status:
          "failed",

        metadata: {
          source:
            "generate-marketing",

          stage:
            "unexpected_error",

          error:
            error?.message ||
            "unknown_error",

          points_operation:
            MARKETING_OPERATION_KEY,

          points_transaction_id:
            pointsTransactionId,

          points_charged:
            pointsCharged,

          points_refunded:
            !!refundResult?.refunded,

          refund_transaction_id:
            refundResult?.refund_transaction_id ||
            null,

          operation_reference_id:
            operationReferenceId,
        },
      });
    } catch (usageError) {
      console.error(
        "AI USAGE LOG ERROR:",
        usageError
      );
    }

    return Response.json(
      {
        error:
          "حدث خطأ أثناء إنشاء المحتوى التسويقي.",

        pointsRefunded:
          !!refundResult?.refunded,

        refundTransactionId:
          refundResult?.refund_transaction_id ||
          null,
      },
      {
        status: 500,
      }
    );
  }
}
