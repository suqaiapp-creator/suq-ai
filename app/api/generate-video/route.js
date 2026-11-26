import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      video_id,
    } = body || {};

    if (!video_id) {
      return NextResponse.json(
        {
          success: false,
          error: "معرّف الفيديو مطلوب.",
        },
        { status: 400 }
      );
    }

    /*
     * 1. جلب الفيديو
     */

    const { data: video, error: videoError } =
      await supabase
        .from("ad_videos")
        .select("*")
        .eq("id", video_id)
        .maybeSingle();

    if (videoError) {
      throw videoError;
    }

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: "الفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * 2. جلب المنتج
     */

    const { data: product, error: productError } =
      await supabase
        .from("products")
        .select("*")
        .eq("id", video.product_id)
        .eq("shop_id", video.shop_id)
        .maybeSingle();

    if (productError) {
      throw productError;
    }

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: "المنتج المرتبط بالفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * 3. منع المنتجات المقفلة
     */

    if (
      product.safety_status === "locked" ||
      product.safety_status === "violation"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "هذا المنتج مقفل ولا يمكن إنشاء فيديو له.",
        },
        { status: 403 }
      );
    }

    /*
     * 4. منع المنتجات التي تحتاج مراجعة
     */

    if (
      product.safety_status === "review"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "هذا المنتج يحتاج إلى مراجعة قبل إنشاء الفيديو.",
        },
        { status: 403 }
      );
    }

    /*
     * 5. جلب المحل
     */

    const { data: shop, error: shopError } =
      await supabase
        .from("shops")
        .select("*")
        .eq("id", video.shop_id)
        .maybeSingle();

    if (shopError) {
      throw shopError;
    }

    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error: "المحل المرتبط بالفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * 6. جلب التصميم إن وجد
     */

    let design = null;

    if (video.design_id) {
      const { data: designData, error: designError } =
        await supabase
          .from("ad_images")
          .select("*")
          .eq("id", video.design_id)
          .eq("shop_id", video.shop_id)
          .maybeSingle();

      if (designError) {
        throw designError;
      }

      design = designData || null;
    }

    /*
     * 7. بناء معلومات الفيديو
     */

    const videoPrompt = {
      video_id: video.id,

      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        description: product.description,
        specifications: product.specifications,
        features: product.features,
        image_url: product.image_url,
        model_number: product.model_number,
      },

      shop: {
        id: shop.id,
        name: shop.name,
        logo_url: shop.logo_url,
        phone: shop.phone,
        whatsapp: shop.whatsapp,
        email: shop.email,
        instagram: shop.instagram,
        tiktok: shop.tiktok,
        snapchat: shop.snapchat,
        website: shop.website,
        address: shop.address,
      },

      design: design
        ? {
            id: design.id,
            image_url: design.image_url,
            format: design.format,
            prompt: design.prompt,
          }
        : null,

      settings: {
        mode: video.mode,
        video_type: video.video_type,
        format: video.format,
        duration_seconds:
          video.duration_seconds,
        style: video.style,
        background: video.background,
      },

      custom_description:
        video.prompt || null,

      rules: [
        "Preserve the exact identity of the product.",
        "Do not change the product shape.",
        "Do not invent product specifications.",
        "Do not invent prices.",
        "Do not invent offers.",
        "Do not add unsupported claims.",
        "Keep the product clearly visible.",
        "Use the shop identity when appropriate.",
        "Create a professional advertising video.",
        "Follow the selected format.",
        "Follow the selected duration.",
        "Use the selected advertising style.",
      ],
    };

    /*
     * 8. حفظ الـ prompt المنظم
     */

    const { data: updatedVideo, error: updateError } =
      await supabase
        .from("ad_videos")
        .update({
          prompt: JSON.stringify(
            videoPrompt
          ),

          status: "processing",

          generation_started_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", video.id)
        .select()
        .single();

    if (updateError) {
      throw updateError;
    }

    /*
     * مهم:
     *
     * لا يوجد استدعاء OpenAI هنا.
     *
     * هذا فقط يجهز الطلب للمحرك
     * الحقيقي لاحقاً.
     */

    return NextResponse.json({
      success: true,

      message:
        "تم تجهيز الفيديو لمحرك التوليد.",

      video: {
        id: updatedVideo.id,
        status: updatedVideo.status,
        product_id:
          updatedVideo.product_id,
        shop_id:
          updatedVideo.shop_id,
        format:
          updatedVideo.format,
        duration_seconds:
          updatedVideo.duration_seconds,
      },

      ready_for_generation: true,

      ai_generation_started: false,
    });
  } catch (error) {
    console.error(
      "GENERATE VIDEO PREPARATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "حدث خطأ أثناء تجهيز الفيديو.",
      },
      { status: 500 }
    );
  }
}
