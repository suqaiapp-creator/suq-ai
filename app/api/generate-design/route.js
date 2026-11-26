import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDesignPrompt } from "../../../lib/design-generator";
import { generateDesignImage } from "../../../lib/image-generator";
import { logAIUsage } from "../../../lib/ai-usage";

export const runtime = "nodejs";

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

export async function POST(request) {
  let designId = null;

  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "غير مصرح" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "الجلسة غير صالحة" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      productId,
      mode,
      template,
      style,
      background,
      format,
      description,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "معرّف المنتج مطلوب" },
        { status: 400 }
      );
    }

    if (!["simple", "professional"].includes(mode)) {
      return NextResponse.json(
        { error: "نوع التصميم غير صحيح" },
        { status: 400 }
      );
    }

    const allowedFormats = [
      "1:1",
      "4:5",
      "9:16",
      "16:9",
    ];

    if (!allowedFormats.includes(format)) {
      return NextResponse.json(
        { error: "مقاس التصميم غير صحيح" },
        { status: 400 }
      );
    }

    const { data: product, error: productError } =
      await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const { data: shop, error: shopError } =
      await supabase
        .from("shops")
        .select("*")
        .eq("id", product.shop_id)
        .single();

    if (shopError || !shop) {
      return NextResponse.json(
        { error: "المحل غير موجود" },
        { status: 404 }
      );
    }

    if (shop.owner_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "غير مصرح لك باستخدام هذا المنتج.",
        },
        { status: 403 }
      );
    }

    const isLocked =
      product.verification_status === "locked" ||
      product.safety_status === "locked" ||
      product.safety_status === "violation" ||
      product.safety_level === "critical";

    if (isLocked) {
      return NextResponse.json(
        {
          error:
            "هذا المنتج مقفل ولا يمكن استخدامه في التصميم.",
        },
        { status: 403 }
      );
    }

    const isUnclear =
      product.verification_status === "review" ||
      product.verification_status === "unverified" ||
      product.confidence === "low" ||
      product.confidence === "medium" ||
      !product.brand ||
      !product.category ||
      !product.description;

    if (isUnclear) {
      const { data: acceptance } =
        await supabase
          .from(
            "product_responsibility_acceptances"
          )
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();

      if (!acceptance) {
        return NextResponse.json(
          {
            error:
              "يجب تأكيد مسؤولية المنتج قبل إنشاء التصميم.",
            requiresResponsibility: true,
          },
          { status: 400 }
        );
      }
    }

    if (!product.image_url) {
      return NextResponse.json(
        {
          error:
            "المنتج لا يحتوي على صورة.",
        },
        { status: 400 }
      );
    }

    const designPrompt = buildDesignPrompt({
      product,
      shop,
      mode,
      template,
      style,
      background,
      format,
      description,
    });

    const { data: design, error: insertError } =
      await supabase
        .from("ad_images")
        .insert({
          product_id: product.id,
          shop_id: shop.id,
          image_url: null,
          format,
          prompt: designPrompt,
          status: "pending",
          generated_at: null,
          completed_at: null,
          error_message: null,
          error_code: null,
          generation_started_at: null,
        })
        .select("id, status, created_at")
        .single();

    if (insertError || !design) {
      console.error(
        "Create design error:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "تعذر إنشاء طلب التصميم.",
        },
        { status: 500 }
      );
    }

    designId = design.id;

    await supabase
      .from("ad_images")
      .update({
        status: "generating",
        generation_started_at: new Date().toISOString(),
        error_message: null,
        error_code: null,
      })
      .eq("id", designId);

    try {
      const generated = await generateDesignImage({
        productImageUrl: product.image_url,
        prompt: designPrompt,
        format,
      });

      if (!generated?.b64_json) {
        throw new Error(
          "لم يتم استلام الصورة الناتجة من محرك الصور."
        );
      }

      const imageBuffer = Buffer.from(
        generated.b64_json,
        "base64"
      );

      const storagePath =
        `${shop.id}/${product.id}/${designId}.png`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("ad-images")
        .upload(
          storagePath,
          imageBuffer,
          {
            contentType: "image/png",
            upsert: false,
          }
        );

      if (uploadError) {
        throw new Error(
          `تعذر حفظ الصورة: ${uploadError.message}`
        );
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("ad-images")
        .getPublicUrl(storagePath);

      const imageUrl =
        publicUrlData?.publicUrl;

      if (!imageUrl) {
        throw new Error(
          "تعذر الحصول على رابط الصورة."
        );
      }

      const completedAt =
        new Date().toISOString();

      const {
        error: updateError,
      } = await supabase
        .from("ad_images")
        .update({
          image_url: imageUrl,
          status: "completed",
          generated_at: completedAt,
          completed_at: completedAt,
          error_message: null,
          error_code: null,
        })
        .eq("id", designId);

      if (updateError) {
        throw new Error(
          `تعذر تحديث التصميم: ${updateError.message}`
        );
      }

      await logAIUsage({
        userId: user.id,
        shopId: shop.id,
        productId: product.id,
        operation: "design_generation",
        model: generated.model || "gpt-image-2",
        status: "success",
        estimatedCost: 0,
        metadata: {
          design_id: designId,
          format,
          mode,
          template: template || null,
          style: style || null,
          background: background || null,
        },
      });

      return NextResponse.json({
        success: true,
        designId,
        status: "completed",
        imageUrl,
      });
    } catch (generationError) {
      console.error(
        "Image generation error:",
        generationError
      );

      const errorMessage =
        generationError?.message ||
        "فشل توليد التصميم.";

      await supabase
        .from("ad_images")
        .update({
          status: "failed",
          error_message: errorMessage,
          error_code: "GENERATION_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", designId);

      await logAIUsage({
        userId: user.id,
        shopId: shop.id,
        productId: product.id,
        operation: "design_generation",
        model: "gpt-image-2",
        status: "failed",
        estimatedCost: 0,
        metadata: {
          design_id: designId,
          error: errorMessage,
          format,
          mode,
        },
      });

      return NextResponse.json(
        {
          success: false,
          designId,
          status: "failed",
          error:
            "تعذر توليد التصميم. تم تسجيل سبب الخطأ.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(
      "Generate design API error:",
      error
    );

    if (designId) {
      await supabase
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            error?.message ||
            "خطأ غير متوقع.",
          error_code: "UNEXPECTED_ERROR",
          completed_at:
            new Date().toISOString(),
        })
        .eq("id", designId);
    }

    return NextResponse.json(
      {
        error:
          "حدث خطأ غير متوقع أثناء إنشاء التصميم.",
      },
      { status: 500 }
    );
  }
}
