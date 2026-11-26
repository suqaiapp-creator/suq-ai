import { createClient } from "@supabase/supabase-js";
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
  estimatedCost = 0,
  metadata = null,
}) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
    const { error } = await supabase
      .from("ai_usage")
      .insert({
        user_id: userId,
        shop_id: shopId,
        product_id: productId,
        operation,
        model,
        status,
        input_tokens: Number(inputTokens || 0),
        output_tokens: Number(outputTokens || 0),
        total_tokens: Number(
          totalTokens ||
            Number(inputTokens || 0) +
              Number(outputTokens || 0)
        ),
        estimated_cost: Number(
          estimatedCost || 0
        ),
        metadata,
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
