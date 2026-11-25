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

    if (!product.image_url) {
      return Response.json(
        {
          error: "صورة المنتج غير موجودة",
        },
        {
          status: 400,
        }
      );
    }

    const selectedFormat = format || "1:1";

    const prompt = `
Create a professional commercial advertising design using the provided product image as the PRIMARY PRODUCT REFERENCE.

PRODUCT:
${product.name || ""}

BRAND:
${product.brand || ""}

CATEGORY:
${product.category || ""}

PRICE:
${product.price || ""} ${product.currency || "AED"}

DESCRIPTION:
${product.description || ""}

FEATURES:
${product.features || ""}

DESIGN FORMAT:
${selectedFormat}

TARGET MARKET:
United Arab Emirates.

CRITICAL PRODUCT PRESERVATION RULES:

1. The uploaded product image is the exact real product.
2. Preserve the product's bottle, packaging, shape, proportions, colors, cap, label, logo and overall identity.
3. Do NOT replace the product with a newly invented bottle.
4. Do NOT redesign the packaging.
5. Do NOT change the brand.
6. Do NOT create a different bottle.
7. Do NOT invent another product.
8. Keep the original product clearly recognizable.
9. The product must remain the main focus of the advertisement.
10. You may improve the background, lighting, shadows and commercial composition around the product.
11. Do not invent product specifications.
12. Do not add fake certifications, warranties or claims.
13. Do not create fake logos.
14. Create a premium advertising composition suitable for the UAE market.
15. Leave clean visual space for Arabic marketing text.
16. Keep the advertisement elegant and suitable for a premium Emirati fragrance brand.
`;

    /*
     * Download the original product image
     * from Supabase Storage.
     */
    const imageResponse = await fetch(
      product.image_url
    );

    if (!imageResponse.ok) {
      throw new Error(
        "تعذر تحميل صورة المنتج الأصلية"
      );
    }

    const imageArrayBuffer =
      await imageResponse.arrayBuffer();

    const imageBuffer =
      Buffer.from(imageArrayBuffer);

    /*
     * Create a File for OpenAI.
     */
    const productImage =
      new File(
        [imageBuffer],
        "product.png",
        {
          type:
            imageResponse.headers.get(
              "content-type"
            ) || "image/png",
        }
      );

    /*
     * Use GPT Image 2 editing
     * with the real product image.
     */
    const response =
      await openai.images.edit({
        model: "gpt-image-2",
        image: productImage,
        prompt,
        size:
          selectedFormat === "9:16"
            ? "1024x1536"
            : selectedFormat === "16:9"
            ? "1536x1024"
            : "1024x1024",
      });

    const imageBase64 =
      response.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error(
        "لم يتم الحصول على الصورة من OpenAI"
      );
    }

    /*
     * Convert Base64 to image.
     */
    const imageBufferResult =
      Buffer.from(
        imageBase64,
        "base64"
      );

    /*
     * Save generated advertisement
     * in Supabase Storage.
     */
    const filePath =
      `${product.id}/${Date.now()}.png`;

    const {
      error: uploadError,
    } = await supabase.storage
      .from("ad-images")
      .upload(
        filePath,
        imageBufferResult,
        {
          contentType: "image/png",
          cacheControl: "3600",
          upsert: false,
        }
      );

    if (uploadError) {
      console.error(
        "SUPABASE STORAGE ERROR:",
        uploadError
      );

      throw new Error(
        "تعذر حفظ التصميم"
      );
    }

    /*
     * Get public image URL.
     */
    const {
      data: publicUrlData,
    } = supabase.storage
      .from("ad-images")
      .getPublicUrl(filePath);

    const imageUrl =
      publicUrlData?.publicUrl;

    if (!imageUrl) {
      throw new Error(
        "تعذر الحصول على رابط التصميم"
      );
    }

    /*
     * Update design record.
     */
    if (designId) {
      const {
        error: updateError,
      } = await supabase
        .from("ad_images")
        .update({
          image_url: imageUrl,
          status: "completed",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

      if (updateError) {
        console.error(
          "DATABASE UPDATE ERROR:",
          updateError
        );

        throw new Error(
          "تم إنشاء التصميم لكن تعذر تحديث البيانات"
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
          "حدث خطأ أثناء إنشاء التصميم",
      },
      {
        status: 500,
      }
    );
  }
}
