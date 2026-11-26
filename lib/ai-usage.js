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
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is missing");
      return;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const input = Number(inputTokens || 0);
    const output = Number(outputTokens || 0);

    const total =
      Number(totalTokens || 0) || input + output;

    const { error } = await supabase
      .from("ai_usage")
      .insert({
        user_id: userId,
        shop_id: shopId,
        product_id: productId,
        operation,
        model,
        status,
        input_tokens: input,
        output_tokens: output,
        total_tokens: total,
        estimated_cost: Number(estimatedCost || 0),
        metadata,
      });

    if (error) {
      console.error("AI usage logging error:", error);
    }
  } catch (error) {
    console.error("AI usage logging failed:", error);
  }
}
