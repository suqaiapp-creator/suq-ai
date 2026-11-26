import { createClient } from "@supabase/supabase-js";

// -----------------------------------------
// أسعار OpenAI الحالية
// السعر لكل 1,000,000 token
// -----------------------------------------

const MODEL_PRICING = {
  "gpt-5-mini": {
    input: 0.25,
    output: 2.0,
  },

  // نترك إمكانية إضافة موديلات مستقبلية
  "gpt-5": {
    input: 1.25,
    output: 10.0,
  },

  "gpt-5-nano": {
    input: 0.05,
    output: 0.40,
  },

  "gpt-5.4-mini": {
    input: 0.75,
    output: 4.50,
  },
};

// -----------------------------------------
// حساب تكلفة OpenAI
// -----------------------------------------

function calculateOpenAICost({
  model,
  inputTokens,
  outputTokens,
}) {
  const pricing =
    MODEL_PRICING[model];

  if (!pricing) {
    return null;
  }

  const inputCost =
    (Number(inputTokens || 0) /
      1_000_000) *
    pricing.input;

  const outputCost =
    (Number(outputTokens || 0) /
      1_000_000) *
    pricing.output;

  return (
    inputCost +
    outputCost
  );
}

// -----------------------------------------
// تسجيل استخدام AI
// -----------------------------------------

export async function logAIUsage({
  userId = null,
  shopId = null,
  productId = null,

  operation,

  model = null,

  status = "success",

  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,

  estimatedCost = null,

  metadata = null,
}) {
  try {
    if (
      !process.env
        .SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error(
        "SUPABASE_SERVICE_ROLE_KEY is missing"
      );

      return;
    }

    const supabase =
      createClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL,

        process.env
          .SUPABASE_SERVICE_ROLE_KEY,

        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,
          },
        }
      );

    // ---------------------------------------
    // تحويل الـ tokens إلى أرقام
    // ---------------------------------------

    const input =
      Number(
        inputTokens || 0
      );

    const output =
      Number(
        outputTokens || 0
      );

    const total =
      Number(
        totalTokens || 0
      ) ||
      input + output;

    // ---------------------------------------
    // حساب التكلفة
    // ---------------------------------------

    let finalCost =
      Number(
        estimatedCost
      );

    const automaticCost =
      calculateOpenAICost({
        model,
        inputTokens:
          input,
        outputTokens:
          output,
      });

    // إذا لم يتم إرسال تكلفة
    // نحسبها تلقائياً من الموديل
    if (
      estimatedCost === null ||
      estimatedCost === undefined
    ) {
      finalCost =
        automaticCost !== null
          ? automaticCost
          : 0;
    }

    // ---------------------------------------
    // تفاصيل التكلفة
    // ---------------------------------------

    const usageMetadata = {
      ...(metadata || {}),

      pricing_source:
        automaticCost !== null
          ? "openai_model_pricing"
          : "manual_or_unknown",

      input_tokens:
        input,

      output_tokens:
        output,

      total_tokens:
        total,

      estimated_cost_usd:
        finalCost,

      input_cost_usd:
        automaticCost !== null
          ? (
              (input /
                1_000_000) *
              MODEL_PRICING[
                model
              ].input
            )
          : null,

      output_cost_usd:
        automaticCost !== null
          ? (
              (output /
                1_000_000) *
              MODEL_PRICING[
                model
              ].output
            )
          : null,

      pricing_input_per_1m:
        automaticCost !== null
          ? MODEL_PRICING[
              model
            ].input
          : null,

      pricing_output_per_1m:
        automaticCost !== null
          ? MODEL_PRICING[
              model
            ].output
          : null,
    };

    // ---------------------------------------
    // حفظ السجل
    // ---------------------------------------

    const {
      error,
    } = await supabase
      .from("ai_usage")
      .insert({
        user_id:
          userId,

        shop_id:
          shopId,

        product_id:
          productId,

        operation,

        provider:
          "openai",

        model,

        status,

        input_tokens:
          input,

        output_tokens:
          output,

        total_tokens:
          total,

        estimated_cost:
          finalCost,

        metadata:
          usageMetadata,
      });

    if (error) {
      console.error(
        "AI usage logging error:",
        error
      );
    }
  } catch (error) {
    console.error(
      "AI usage logging failed:",
      error
    );
  }
}
