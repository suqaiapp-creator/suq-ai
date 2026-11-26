import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateVideo } from "../../../lib/video-generator";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -----------------------------------------
// Runway Cost Settings
// -----------------------------------------
//
// حالياً نستخدم:
// 480p = 2 Credits / second
// Image-to-video start frame = +1 Credit
//
// سعر الـ Credit حسب شراء المستخدم الحالي:
// $8.40 / 1000 Credits
//
// يمكن تغييره لاحقاً من Environment Variable.
// -----------------------------------------

const RUNWAY_CREDITS_PER_SECOND = 2;

const RUNWAY_START_FRAME_CREDITS = 1;

const RUNWAY_COST_PER_CREDIT =
  Number(
    process.env.RUNWAY_CREDIT_COST_USD
  ) || 0.0084;

function calculateRunwayCredits(duration) {
  const seconds = Number(duration) || 5;

  return (
    seconds *
      RUNWAY_CREDITS_PER_SECOND +
    RUNWAY_START_FRAME_CREDITS
  );
}

function calculateRunwayCost(credits) {
  return (
    Number(credits || 0) *
    RUNWAY_COST_PER_CREDIT
  );
}

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
    // حساب تكلفة Runway
    // -----------------------------------------

    const duration =
      Number(
        engineResult.duration ||
          video.duration_seconds ||
          5
      );

    const runwayCredits =
      calculateRunwayCredits(
        duration
      );

    const runwayEstimatedCost =
      calculateRunwayCost(
        runwayCredits
      );

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
    // تسجيل استخدام Runway في ai_usage
    // -----------------------------------------
    //
    // مهم:
    // فشل التسجيل هنا لا يفشل إنشاء الفيديو.
    // لأن الفيديو تم إرساله فعلياً إلى Runway.
    // -----------------------------------------

    try {
      const {
        error: usageError,
      } = await supabase
        .from("ai_usage")
        .insert({
          user_id:
            shop.owner_id || null,

          shop_id:
            video.shop_id || null,

          product_id:
            video.product_id || null,

          operation:
            "video_generation",

          provider:
            engineResult.engine ||
            "runway",

          model:
            engineResult.model ||
            null,

          status:
            "processing",

          input_tokens: 0,

          output_tokens: 0,

          total_tokens: 0,

          credits_used:
            runwayCredits,

          estimated_cost:
            runwayEstimatedCost,

          metadata: {
            video_id:
              video.id,

            provider_task_id:
              engineResult.taskId,

            duration_seconds:
              duration,

            format:
              video.format || null,

            ratio:
              engineResult.ratio || null,

            video_type:
              video.video_type || null,

            style:
              video.style || null,

            background:
              video.background || null,

            credits_per_second:
              RUNWAY_CREDITS_PER_SECOND,

            start_frame_credits:
              RUNWAY_START_FRAME_CREDITS,

            cost_per_credit_usd:
              RUNWAY_COST_PER_CREDIT,

            estimated_cost_usd:
              runwayEstimatedCost,

            note:
              "Runway usage recorded at task creation. Final status/cost will be updated after task completion.",
          },
        });

      if (usageError) {
        console.error(
          "AI USAGE LOGGING ERROR:",
          usageError
        );
      }
    } catch (usageLogError) {
      console.error(
        "AI USAGE LOGGING FAILED:",
        usageLogError
      );
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

      usage: {
        credits:
          runwayCredits,

        estimated_cost_usd:
          runwayEstimatedCost,
      },
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
