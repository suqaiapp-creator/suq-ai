import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateVideo } from "../../../lib/video-generator";

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
     * 2. منع إعادة تشغيل فيديو قيد المعالجة
     */

    if (video.status === "processing") {
      return NextResponse.json({
        success: true,
        message:
          "الفيديو قيد المعالجة بالفعل.",
        video: {
          id: video.id,
          status: video.status,
        },
        already_processing: true,
      });
    }

    /*
     * 3. جلب المنتج
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
          error:
            "المنتج المرتبط بالفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * 4. فحص الأمان
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
          error:
            "المحل المرتبط بالفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * 6. جلب التصميم إن وجد
     */

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

    /*
     * 7. تجهيز Prompt منظم
     */

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

    /*
     * 8. تجهيز بيانات المحرك
     */

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

    /*
     * 9. المحرك غير مفعّل
     *
     * هذا هو الوضع الحالي.
     */

    if (
      engineResult?.enabled === false
    ) {
      const { data: updatedVideo, error: updateError } =
        await supabase
          .from("ad_videos")
          .update({
            prompt:
              JSON.stringify(
                structuredPrompt
              ),

            status: "pending",

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

    /*
     * 10. المحرك مفعّل
     */

    const { data: processingVideo, error: processingError } =
      await supabase
        .from("ad_videos")
        .update({
          prompt:
            JSON.stringify(
              structuredPrompt
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

    if (processingError) {
      throw processingError;
    }

    /*
     * 11. حفظ Task ID
     *
     * نستخدم error_code مؤقتاً لتخزين
     * معرف مهمة المزود.
     *
     * لاحقاً نضيف video_provider_task_id
     * كعمود مستقل.
     */

    if (engineResult.taskId) {
      await supabase
        .from("ad_videos")
        .update({
          error_code:
            `provider_task:${engineResult.taskId}`,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", video.id);
    }

    return NextResponse.json({
      success: true,

      message:
        "تم إرسال الفيديو إلى محرك التوليد.",

      video: {
        id: processingVideo.id,
        status:
          processingVideo.status,
      },

      engine_enabled: true,

      ai_generation_started:
        true,

      task_id:
        engineResult.taskId ||
        null,

      engine:
        engineResult.engine ||
        null,

      model:
        engineResult.model ||
        null,
    });
  } catch (error) {
    console.error(
      "GENERATE VIDEO ERROR:",
      error
    );

    /*
     * نحاول تسجيل الفشل في قاعدة البيانات
     * إذا كان لدينا video_id.
     */

    try {
      const body =
        await request.clone().json();

      if (body?.video_id) {
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
          .eq("id", body.video_id);
      }
    } catch (logError) {
      console.error(
        "VIDEO ERROR LOGGING FAILED:",
        logError
      );
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
