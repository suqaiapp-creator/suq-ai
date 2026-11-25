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
        {
          error: "بيانات المنتج غير موجودة",
        },
        {
          status: 400,
        }
      );
    }

    const selectedFormat = format || "1:1";

    const prompt = `
Create a professional commercial advertising image for this product.

PRODUCT INFORMATION:

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
${selectedFormat}

Target market:
United Arab Emirates.

IMPORTANT RULES:

- Keep the product appearance accurate.
- Do not invent product specifications.
- Do not invent certifications.
- Do not invent guarantees or warranties.
- Do not add technical claims that are not provided.
- Do not change the product identity.
- Make the product the main visual focus.
- Create a premium commercial advertising composition.
- Use professional studio lighting.
- Use a clean and attractive background.
- Leave suitable visual space for Arabic advertising text.
- Do not generate fake logos.
- Do not create fake brands.
- Make the design suitable for an Emirati/UAE market.
- Make the advertisement look professional and ready for social media.
`;

    const response = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size:
        selectedFormat === "9:16"
          ? "1024x1536"
          : selectedFormat === "16:9"
          ? "1536x1024"
          : "1024x1024",
    });

    const imageBase64 = response.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("لم يتم الحصول على الصورة من OpenAI");
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
      console.error(
        "SUPABASE STORAGE ERROR:",
        uploadError
      );

      throw new Error("تعذر حفظ الصورة في التخزين");
    }

    const { data: publicUrlData } =
      supabase.storage
        .from("ad-images")
        .getPublicUrl(filePath);

    const imageUrl =
      publicUrlData?.publicUrl;

    if (!imageUrl) {
      throw new Error(
        "تعذر الحصول على رابط الصورة"
      );
    }

    if (designId) {
      const { error: updateError } =
        await supabase
          .from("ad_images")
          .update({
            image_url: imageUrl,
            status: "completed",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", designId);

      if (updateError) {
        console.error(
          "DATABASE UPDATE ERROR:",
          updateError
        );

        throw new Error(
          "تم إنشاء الصورة لكن تعذر تحديث حالة التصميم"
        );
      }
    }

    return Response.json({
      success: true,
      image_url: imageUrl,
    });
  } catch (error) {
    console.error(
      "IMAGE GENERATION ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "حدث خطأ أثناء إنشاء الصورة",
      },
      {
        status: 500,
      }
    );
  }
}
