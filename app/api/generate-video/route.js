import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateVideo } from "../../../lib/video-generator";

export const runtime = "nodejs";

// -----------------------------------------
// Service Role Client
// للعمليات الداخلية فقط
// -----------------------------------------

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// -----------------------------------------
// Runway Cost Settings
// -----------------------------------------

const RUNWAY_CREDITS_PER_SECOND = 2;

const RUNWAY_START_FRAME_CREDITS = 1;

const RUNWAY_COST_PER_CREDIT =
  Number(
    process.env.RUNWAY_CREDIT_COST_USD
  ) || 0.0084;

// -----------------------------------------
// Points Settings
// -----------------------------------------

const VIDEO_POINT_OPERATIONS = {
  5: {
    operation_key: "create_video_5",
    points: 11,
  },

  8: {
    operation_key: "create_video_8",
    points: 17,
  },

  10: {
    operation_key: "create_video_10",
    points: 21,
  },
};

// -----------------------------------------
// Runway helpers
// -----------------------------------------

function calculateRunwayCredits(duration) {
  const seconds =
    Number(duration) || 5;

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

// -----------------------------------------
// Points helper
// -----------------------------------------

function getVideoPointOperation(
  duration
) {
  const seconds =
    Number(duration) || 5;

  return (
    VIDEO_POINT_OPERATIONS[seconds] ||
    null
  );
}

export async function POST(request) {
  let videoId = null;
  let userId = null;
  let shopId = null;
  let productId = null;

  try {
    // -----------------------------------------
    // التحقق من جلسة المستخدم
    // -----------------------------------------

    const cookieStore =
      await cookies();

    const supabaseAuth =
      createServerClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL,

        process.env
          .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,

        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },

            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(
                  ({
                    name,
                    value,
                    options,
                  }) => {
                    cookieStore.set(
                      name,
                      value,
                      options
                    );
                  }
                );
              } catch {}
            },
          },
        }
      );

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabaseAuth.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "يجب تسجيل الدخول أولاً.",
        },
        {
          status: 401,
        }
      );
    }

    userId = user.id;

    // -----------------------------------------
    // قراءة الطلب
    // -----------------------------------------

    const body =
      await request.json();

    videoId =
      body?.video_id || null;

    if (!videoId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "معرّف الفيديو مطلوب.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // جلب الفيديو
    // -----------------------------------------

    const {
      data: video,
      error: videoError,
    } =
      await supabaseAdmin
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
          error:
            "الفيديو غير موجود.",
        },
        {
          status: 404,
        }
      );
    }

    shopId =
      video.shop_id || null;

    productId =
      video.product_id || null;

    if (!shopId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "الفيديو غير مرتبط بمحل.",
        },
        {
          status: 403,
        }
      );
    }

    // -----------------------------------------
    // جلب المحل والتحقق من الملكية
    // -----------------------------------------

    const {
      data: shop,
      error: shopError,
    } =
      await supabaseAdmin
        .from("shops")
        .select("*")
        .eq("id", shopId)
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
        {
          status: 404,
        }
      );
    }

    // -----------------------------------------
    // حماية الملكية
    // -----------------------------------------

    if (
      shop.owner_id !== userId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ليس لديك صلاحية إنشاء هذا الفيديو.",
        },
        {
          status: 403,
        }
      );
    }

    // -----------------------------------------
    // إذا الفيديو قيد المعالجة
    // -----------------------------------------

    if (
      video.status ===
      "processing"
    ) {
      return NextResponse.json({
        success: true,

        message:
          "الفيديو قيد المعالجة بالفعل.",

        video: {
          id: video.id,
          status:
            video.status,
        },

        already_processing:
          true,
      });
    }

    // -----------------------------------------
    // التحقق من مدة الفيديو
    // -----------------------------------------

    const duration =
      Number(
        video.duration_seconds ||
          5
      );

    const pointOperation =
      getVideoPointOperation(
        duration
      );

    if (!pointOperation) {
      return NextResponse.json(
        {
          success: false,

          error:
            "مدة الفيديو غير مدعومة في نظام النقاط حالياً.",

          supported_durations:
            Object.keys(
              VIDEO_POINT_OPERATIONS
            ).map(Number),
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // جلب المنتج
    // -----------------------------------------

    const {
      data: product,
      error: productError,
    } =
      await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("shop_id", shopId)
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
        {
          status: 404,
        }
      );
    }

    // -----------------------------------------
    // حماية المنتج
    // -----------------------------------------

    if (
      product.safety_status ===
        "locked" ||
      product.safety_status ===
        "violation"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "هذا المنتج مقفل ولا يمكن إنشاء فيديو له.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      product.safety_status ===
      "review"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "هذا المنتج يحتاج إلى مراجعة قبل إنشاء الفيديو.",
        },
        {
          status: 403,
        }
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
      } =
        await supabaseAdmin
          .from("ad_images")
          .select("*")
          .eq(
            "id",
            video.design_id
          )
          .eq(
            "shop_id",
            shopId
          )
          .maybeSingle();

      if (designError) {
        throw designError;
      }

      design =
        designData || null;
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
        description:
          product.description,
        specifications:
          product.specifications,
        features:
          product.features,
        image_url:
          product.image_url,
        model_number:
          product.model_number,
      },

      shop: {
        id: shop.id,
        name: shop.name,
        logo_url:
          shop.logo_url,
        phone: shop.phone,
        whatsapp:
          shop.whatsapp,
        email: shop.email,
        instagram:
          shop.instagram,
        tiktok:
          shop.tiktok,
        snapchat:
          shop.snapchat,
        website:
          shop.website,
      },

      design: design
        ? {
            id: design.id,
            image_url:
              design.image_url,
            format:
              design.format,
          }
        : null,

      settings: {
        mode: video.mode,
        video_type:
          video.video_type,
        format:
          video.format,
        duration_seconds:
          duration,
        style:
          video.style,
        background:
          video.background,
      },

      user_description:
        video.prompt || null,
    };

    // -----------------------------------------
    // التأكد أن محرك الفيديو مفعّل
    //
    // لا نخصم نقاط إذا كان المحرك متوقفاً.
    // -----------------------------------------

    const videoGenerationEnabled =
      String(
        process.env
          .VIDEO_GENERATION_ENABLED ||
          ""
      ).toLowerCase() ===
      "true";

    if (
      !videoGenerationEnabled
    ) {
      return NextResponse.json({
        success: true,

        message:
          "تم تجهيز الفيديو. محرك الذكاء الاصطناعي غير مفعّل حالياً.",

        video: {
          id: video.id,
          status:
            video.status,
        },

        engine_enabled:
          false,

        ai_generation_started:
          false,

        points: {
          charged: 0,
          balance_after:
            null,
        },
      });
    }

    // -----------------------------------------
    // حساب تكلفة Runway
    // -----------------------------------------

    const runwayCredits =
      calculateRunwayCredits(
        duration
      );

    const runwayEstimatedCost =
      calculateRunwayCost(
        runwayCredits
      );

    // -----------------------------------------
    // خصم النقاط من جلسة المستخدم
    //
    // مهم جداً:
    // هنا نستخدم supabaseAuth
    // وليس Service Role.
    //
    // لذلك auth.uid() داخل RPC
    // سيكون المستخدم الحقيقي.
    // -----------------------------------------

    const {
      data: pointsResult,
      error: pointsError,
    } =
      await supabaseAuth.rpc(
        "charge_operation_points",
        {
          p_operation_key:
            pointOperation.operation_key,

          p_user_id:
            userId,

          p_shop_id:
            shopId,

          p_reference_type:
            "ad_video",

          p_reference_id:
            video.id,

          p_description:
            `إنشاء فيديو إعلاني لمدة ${duration} ثواني للمنتج: ${
              product.name ||
              "منتج"
            }`,

          p_metadata: {
            source:
              "generate-video",

            operation:
              pointOperation.operation_key,

            duration_seconds:
              duration,

            points_cost:
              pointOperation.points,

            runway_credits:
              runwayCredits,

            runway_estimated_cost_usd:
              runwayEstimatedCost,
          },
        }
      );

    if (pointsError) {
      console.error(
        "VIDEO POINTS CHARGE ERROR:",
        pointsError
      );

      const pointsMessage =
        pointsError?.message ||
        "تعذر خصم نقاط الفيديو.";

      const insufficient =
        pointsMessage.includes(
          "غير كاف"
        ) ||
        pointsMessage.includes(
          "رصيد النقاط"
        );

      return NextResponse.json(
        {
          success: false,

          error: insufficient
            ? pointsMessage
            : "تعذر تجهيز رصيد النقاط لإنشاء الفيديو.",

          code: insufficient
            ? "INSUFFICIENT_POINTS"
            : "POINTS_CHARGE_FAILED",

          points_required:
            pointOperation.points,

          duration_seconds:
            duration,
        },
        {
          status:
            insufficient
              ? 402
              : 500,
        }
      );
    }

    if (
      !pointsResult ||
      pointsResult.success !==
        true
    ) {
      console.error(
        "VIDEO POINTS CHARGE INVALID RESULT:",
        pointsResult
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "تعذر تأكيد خصم نقاط الفيديو.",

          code:
            "POINTS_CHARGE_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    const pointsCharged =
      Number(
        pointsResult.points_charged ||
          pointOperation.points
      );

    const pointsBalanceAfter =
      Number(
        pointsResult.balance_after ??
          0
      );

    // -----------------------------------------
    // إرسال الطلب إلى Runway
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
    // حماية إضافية
    // -----------------------------------------

    if (
      !engineResult?.taskId
    ) {
      throw new Error(
        "محرك الفيديو لم يرجع رقم المهمة."
      );
    }

    // -----------------------------------------
    // حفظ حالة المعالجة
    // -----------------------------------------

    const {
      data: processingVideo,
      error: processingError,
    } =
      await supabaseAdmin
        .from("ad_videos")
        .update({
          prompt:
            JSON.stringify(
              structuredPrompt
            ),

          status:
            "processing",

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
        .eq(
          "id",
          video.id
        )
        .select()
        .single();

    if (processingError) {
      throw processingError;
    }

    // -----------------------------------------
    // تسجيل استخدام Runway
    // -----------------------------------------

    try {
      const {
        error: usageError,
      } =
        await supabaseAdmin
          .from("ai_usage")
          .insert({
            user_id:
              userId,

            shop_id:
              shopId,

            product_id:
              productId,

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
                video.format ||
                null,

              ratio:
                engineResult.ratio ||
                null,

              video_type:
                video.video_type ||
                null,

              style:
                video.style ||
                null,

              background:
                video.background ||
                null,

              credits_per_second:
                RUNWAY_CREDITS_PER_SECOND,

              start_frame_credits:
                RUNWAY_START_FRAME_CREDITS,

              cost_per_credit_usd:
                RUNWAY_COST_PER_CREDIT,

              estimated_cost_usd:
                runwayEstimatedCost,

              points_operation:
                pointOperation.operation_key,

              points_charged:
                pointsCharged,

              points_balance_after:
                pointsBalanceAfter,

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
        id:
          processingVideo.id,

        status:
          processingVideo.status,

        provider:
          processingVideo.provider,

        provider_task_id:
          processingVideo.provider_task_id,
      },

      engine_enabled:
        true,

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

      points: {
        charged:
          pointsCharged,

        balance_after:
          pointsBalanceAfter,

        operation:
          pointOperation.operation_key,
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
        await supabaseAdmin
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
          .eq(
            "id",
            videoId
          );
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
      {
        status: 500,
      }
    );
  }
}
