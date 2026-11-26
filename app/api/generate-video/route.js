import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateVideo } from "../../../lib/video-generator";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  let videoId = null;

  try {
    const body = await request.json();

    videoId = body?.video_id || null;

    if (!videoId) {
      return NextResponse.json(
        {
          success: false,
          error: "معرّف الفيديو مطلوب.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // جلب الفيديو
    // -----------------------------------------

    const {
      data: video,
      error: videoError,
    } = await supabase
      .from("ad_videos")
      .select("*")
      .eq("id", videoId)
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

    // -----------------------------------------
    // إذا الفيديو قيد المعالجة
    // -----------------------------------------

    if (video.status === "processing") {
      return NextResponse.json({
        success: true,
        message: "الفيديو قيد المعالجة بالفعل.",
        video: {
          id: video.id,
          status: video.status,
        },
        already_processing: true,
      });
    }

    // -----------------------------------------
    // جلب المنتج
    // -----------------------------------------

    const {
      data: product,
      error: productError,
    } = await supabase
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
          error:
            "المنتج المرتبط بالفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // حماية المنتج
    // -----------------------------------------

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

    // -----------------------------------------
    // جلب المحل
    // -----------------------------------------

    const {
      data: shop,
      error: shopError,
    } = await supabase
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
          error:
            "المحل المرتبط بالفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // جلب التصميم إذا تم اختياره
    // -----------------------------------------

    let design = null;

    if (video.design_id) {
      const {
        data: designData,
        error: designError,
      } = await supabase
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

    // -----------------------------------------
    // بناء بيانات الفيديو
    // -----------------------------------------

    const structuredPrompt = {
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        description: product.description,
        specifications:
          product.specifications,
        features: product.features,
        image_url: product.image_url,
        model_number:
          product.model_number,
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
      },

      design: design
        ? {
            id: design.id,
            image_url:
              design.image_url,
            format: design.format,
          }
        : null,

      settings: {
        mode: video.mode,
        video_type:
          video.video_type,
        format: video.format,
        duration_seconds:
          video.duration_seconds,
        style: video.style,
        background:
          video.background,
      },

      user_description:
        video.prompt || null,
    };

    // -----------------------------------------
    // إرسال الطلب لمحرك الفيديو
    // -----------------------------------------

    const engineResult =
      await generateVideo({
        product,
        shop,
        video: {
          ...video,
          prompt:
            JSON.stringify(
              structuredPrompt
            ),
        },
      });

    // -----------------------------------------
    // المحرك غير مفعّل
    // -----------------------------------------

    if (
      engineResult?.enabled === false
    ) {
      const {
        data: updatedVideo,
        error: updateError,
      } = await supabase
        .from("ad_videos")
        .update({
          prompt:
            JSON.stringify(
              structuredPrompt
            ),

          status: "pending",

          provider: null,

          provider_task_id: null,

          generation_started_at: null,

          error_message: null,

          error_code: null,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", video.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,

        message:
          "تم تجهيز الفيديو. محرك الذكاء الاصطناعي غير مفعّل حالياً.",

        video: {
          id: updatedVideo.id,
          status:
            updatedVideo.status,
        },

        engine_enabled: false,

        ai_generation_started:
          false,
      });
    }

    // -----------------------------------------
    // التأكد من وجود Task ID
    // -----------------------------------------

    if (!engineResult?.taskId) {
      throw new Error(
        "محرك الفيديو لم يرجع رقم المهمة."
      );
    }

    // -----------------------------------------
    // حفظ حالة المعالجة + Task ID
    // -----------------------------------------

    const {
      data: processingVideo,
      error: processingError,
    } = await supabase
      .from("ad_videos")
      .update({
        prompt:
          JSON.stringify(
            structuredPrompt
          ),

        status: "processing",

        provider:
          engineResult.engine ||
          "runway",

        provider_task_id:
          engineResult.taskId,

        generation_started_at:
          new Date().toISOString(),

        error_message: null,

        error_code: null,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", video.id)
      .select()
      .single();

    if (processingError) {
      throw processingError;
    }

    // -----------------------------------------
    // الرد
    // -----------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "تم إرسال الفيديو إلى محرك التوليد.",

      video: {
        id: processingVideo.id,

        status:
          processingVideo.status,

        provider:
          processingVideo.provider,

        provider_task_id:
          processingVideo.provider_task_id,
      },

      engine_enabled: true,

      ai_generation_started:
        true,

      task_id:
        engineResult.taskId,

      engine:
        engineResult.engine ||
        "runway",

      model:
        engineResult.model ||
        null,
    });
  } catch (error) {
    console.error(
      "GENERATE VIDEO ERROR:",
      error
    );

    // -----------------------------------------
    // تسجيل الخطأ
    // -----------------------------------------

    if (videoId) {
      try {
        await supabase
          .from("ad_videos")
          .update({
            status: "failed",

            error_message:
              error?.message ||
              "فشل إنشاء الفيديو.",

            error_code:
              "VIDEO_GENERATION_ERROR",

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", videoId);
      } catch (logError) {
        console.error(
          "VIDEO ERROR LOGGING FAILED:",
          logError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "حدث خطأ أثناء إنشاء الفيديو.",
      },
      { status: 500 }
    );
  }
}
