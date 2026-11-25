import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export async function POST(request) {
  try {
    const { product, format, designId } = await request.json();

    if (!product) {
      return Response.json(
        { error: "بيانات المنتج غير موجودة" },
        { status: 400 }
      );
    }

    const prompt = `
Create a professional commercial advertising image for this product.

Product name:
${product.name || ""}

Brand:
${product.brand || ""}

Category:
${product.category || ""}

Price:
${product.price || ""} ${product.currency || "AED"}

Product description:
${product.description || ""}

Features:
${product.features || ""}

Design format:
${format || "1:1"}

Target market:
United Arab Emirates.

Important rules:
- Keep the product appearance accurate.
- Do not invent product specifications.
- Do not add fake certifications or claims.
- Create a premium commercial advertising composition.
- Make the product the main focus.
- Use clean professional lighting.
- Leave suitable space for Arabic advertising text.
- Do not generate fake logos.
`;

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size:
        format === "9:16"
          ? "1024x1536"
          : format === "16:9"
          ? "1536x1024"
          : "1024x1024",
    });

    const imageBase64 = response.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("لم يتم الحصول على الصورة");
    }

    const imageBuffer = Buffer.from(
      imageBase64,
      "base64"
    );

    const filePath = `${product.id}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("ad-images")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new Error("تعذر حفظ الصورة");
    }

    const { data: publicUrlData } = supabase.storage
      .from("ad-images")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    if (designId) {
      await supabase
        .from("ad_images")
        .update({
          image_url: imageUrl,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", designId);
    }

    return Response.json({
      success: true,
      image_url: imageUrl,
    });
  } catch (error) {
    console.error("IMAGE GENERATION ERROR:", error);

    return Response.json(
      {
        error:
          error.message ||
          "حدث خطأ أثناء إنشاء الصورة",
      },
      { status: 500 }
    );
  }
}
