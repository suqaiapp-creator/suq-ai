import OpenAI from "openai";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-image-2";

const SIZE_MAP = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
};

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

  const size = SIZE_MAP[format] || SIZE_MAP["1:1"];

  const imageResponse = await fetch(productImageUrl);

  if (!imageResponse.ok) {
    throw new Error(
      "تعذر الوصول إلى صورة المنتج."
    );
  }

  const imageBuffer =
    Buffer.from(
      await imageResponse.arrayBuffer()
    );

  const contentType =
    imageResponse.headers.get("content-type") ||
    "image/png";

  const extension =
    contentType.includes("jpeg") ||
    contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
      ? "webp"
      : "png";

  const inputFile = new File(
    [imageBuffer],
    `product.${extension}`,
    {
      type: contentType,
    }
  );

  const result =
    await openai.images.edit({
      model: MODEL,
      image: inputFile,
      prompt: JSON.stringify(prompt),
      size,
      quality: "auto",
    });

  const image =
    result?.data?.[0];

  if (!image?.b64_json) {
    throw new Error(
      "لم يتم استلام الصورة الناتجة."
    );
  }

  return {
    b64_json: image.b64_json,
    revised_prompt:
      image.revised_prompt || null,
    model: MODEL,
    size,
  };
}
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
