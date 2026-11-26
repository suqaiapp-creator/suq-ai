import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateDesignImage({
  productImageUrl,
  prompt,
  format = "1:1",
}) {
  if (!productImageUrl) {
    throw new Error("صورة المنتج مطلوبة.");
  }

  if (!prompt) {
    throw new Error("تعليمات التصميم مطلوبة.");
  }

  const sizeMap = {
    "1:1": "1024x1024",
    "4:5": "1024x1536",
    "9:16": "1024x1536",
    "16:9": "1536x1024",
  };

  const size = sizeMap[format] || "1024x1024";

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: JSON.stringify(prompt),
    size,
    quality: "auto",
  });

  const image = response?.data?.[0];

  if (!image) {
    throw new Error("لم يتم إنشاء الصورة.");
  }

  return {
    b64_json: image.b64_json || null,
    revised_prompt: image.revised_prompt || null,
  };
}
