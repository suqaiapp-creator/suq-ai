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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY غير موجود في إعدادات الخادم.");
  }
  if (!productImageUrl) {
    throw new Error("صورة المنتج مطلوبة.");
  }
  if (!prompt) {
    throw new Error("تعليمات التصميم مطلوبة.");
  }
  const size = SIZE_MAP[format] || SIZE_MAP["1:1"];
  /*
   * تحميل صورة المنتج من Supabase
   */
  let imageResponse;
  try {
    imageResponse = await fetch(productImageUrl);
  } catch (error) {
    throw new Error(
      `تعذر الاتصال بصورة المنتج: ${
        error?.message || "خطأ غير معروف"
      }`
    );
  }
  if (!imageResponse.ok) {
    throw new Error(
      `تعذر الوصول إلى صورة المنتج. HTTP ${imageResponse.status}`
    );
  }
  const imageBuffer = Buffer.from(
    await imageResponse.arrayBuffer()
  );
  if (!imageBuffer.length) {
    throw new Error("صورة المنتج فارغة.");
  }
  const contentType =
    imageResponse.headers.get("content-type") ||
    "image/png";
  /*
   * تحديد امتداد الصورة
   */
  let extension = "png";
  if (
    contentType.includes("jpeg") ||
    contentType.includes("jpg")
  ) {
    extension = "jpg";
  } else if (contentType.includes("webp")) {
    extension = "webp";
  }
  /*
   * تجهيز ملف الصورة لإرساله إلى OpenAI
   */
  const inputFile = new File(
    [imageBuffer],
    `product.${extension}`,
    {
      type: contentType,
    }
  );
  /*
   * تحويل تعليمات التصميم إلى نص واضح
   */
  let finalPrompt;
  if (typeof prompt === "string") {
    finalPrompt = prompt;
  } else {
    finalPrompt = `
Create a professional commercial advertising design.
Use the provided product image as the primary reference.
IMPORTANT RULES:
- Preserve the exact identity of the product.
- Do not change the product shape.
- Do not change the product logo.
- Do not invent product specifications.
- Do not invent prices.
- Do not invent offers.
- Do not add unsupported claims.
- Keep the product clearly visible.
- Create a clean professional advertising composition.
- Make all advertising text readable.
- Follow the requested format and style.
DESIGN INSTRUCTIONS:
${JSON.stringify(prompt, null, 2)}
`;
  }
  /*
   * إنشاء التصميم
   */
  let result;
  try {
    result = await openai.images.edit({
      model: MODEL,
      image: inputFile,
      prompt: finalPrompt,
      size,
      quality: "auto",
    });
  } catch (error) {
    console.error("OPENAI IMAGE GENERATION ERROR:", error);
    const message =
      error?.message ||
      error?.error?.message ||
      "فشل إنشاء التصميم بواسطة OpenAI.";
    throw new Error(
      `فشل إنشاء التصميم: ${message}`
    );
  }
  const image = result?.data?.[0];
  if (!image) {
    throw new Error(
      "OpenAI لم يرجع نتيجة للصورة."
    );
  }
  if (!image.b64_json) {
    throw new Error(
      "تم تنفيذ طلب التصميم ولكن لم يتم استلام بيانات الصورة."
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
