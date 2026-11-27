import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateVideo } from "../../../lib/video-generator";

export const runtime = "nodejs";

// =========================================================
// Service Role Client
// للعمليات الداخلية فقط
// =========================================================

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

// =========================================================
// Runway Cost Settings
// =========================================================

const RUNWAY_CREDITS_PER_SECOND = 2;

const RUNWAY_START_FRAME_CREDITS = 1;

const RUNWAY_COST_PER_CREDIT =
  Number(
    process.env.RUNWAY_CREDIT_COST_USD
  ) || 0.0084;

// =========================================================
// Points Settings
// =========================================================

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

// =========================================================
// Runway helpers
// =========================================================

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

// =========================================================
// Points helper
// =========================================================

function getVideoPointOperation(duration) {
  const seconds =
    Number(duration) || 5;

  return (
    VIDEO_POINT_OPERATIONS[seconds] ||
    null
  );
}

// =========================================================
// Refund helper
// =========================================================

async function refundVideoPoints({
  supabaseAuth,
  transactionId,
  userId,
  shopId,
  productId,
  videoId,
  reason,
  stage,
  errorMessage,
}) {
  if (!transactionId) {
    return {
      success: false,
      refunded: false,
      error:
        "لا توجد عملية نقاط لاسترجاعها.",
    };
  }

  try {
    const {
      data: refundResult,
      error: refundError,
    } =
      await supabaseAuth.rpc(
        "refund_operation_points",
        {
          p_transaction_id:
            transactionId,

          p_reason:
            reason ||
            "استرجاع نقاط بسبب فشل عملية الفيديو.",

          p_metadata: {
            source:
              "generate-video",

            user_id:
              userId,

            shop_id:
              shopId,

            product_id:
              productId,

            video_id:
              videoId,

            stage:
              stage || "unknown",

            error:
              errorMessage || null,
          },
        }
      );

    if (refundError) {
      console.error(
        "VIDEO POINTS REFUND ERROR:",
        refundError
      );

      return {
        success: false,
        refunded: false,
        error:
          refundError.message,
      };
    }

    return {
      success: true,
      ...(refundResult || {}),
    };
  } catch (error) {
    console.error(
      "VIDEO REFUND UNEXPECTED ERROR:",
      error
    );

    return {
      success: false,
      refunded: false,
      error:
        error?.message ||
        "تعذر استرجاع النقاط.",
    };
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(request) {
  let videoId = null;
  let userId = null;
  let shopId = null;
  let productId = null;

  let supabaseAuth = null;

  let pointsTransactionId = null;
  let pointsCharged = 0;
  let pointsBalanceAfter = null;

  try {
    // =====================================================
    // 1. جلسة المستخدم
    // =====================================================

    const cookieStore =
      await cookies();

    supabaseAuth =
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

    // =====================================================
    // 2. قراءة الطلب
    // =====================================================

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

    // =====================================================
    // 3. جلب الفيديو
    // =====================================================

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

    // =====================================================
    // 4. جلب المحل والتحقق من الملكية
    // =====================================================

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

    // =====================================================
    // 5. إذا الفيديو قيد المعالجة
    // =====================================================

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

    // =====================================================
    // 6. مدة الفيديو
    // =====================================================

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

    // =====================================================
    // 7. جلب المنتج
    // =====================================================

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

    // =====================================================
    // 8. حماية المنتج
    // =====================================================

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

    // =====================================================
    // 9. جلب التصميم
    // =====================================================

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

    // =====================================================
    // 10. بيانات الفيديو
    // =====================================================

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
        phone:
          shop.phone,
        whatsapp:
          shop.whatsapp,
        email:
          shop.email,
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
        mode:
          video.mode,

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

    // =====================================================
    // 11. التأكد من تفعيل محرك الفيديو
    //
    // لا نخصم نقاط إذا المحرك غير مفعّل.
    // =====================================================

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

    // =====================================================
    // 12. حساب تكلفة Runway
    // =====================================================

    const runwayCredits =
      calculateRunwayCredits(
        duration
      );

    const runwayEstimatedCost =
      calculateRunwayCost(
        runwayCredits
      );

    // =====================================================
    // 13. إنشاء مرجع مستقل للعملية
    //
    // مهم:
    // لا نستخدم video.id كـ reference_id.
    //
    // حتى إذا فشلت المحاولة وتم استرجاع النقاط،
    // يستطيع المستخدم إعادة المحاولة لنفس الفيديو.
    // =====================================================

    const operationReferenceId =
      crypto.randomUUID();

    // =====================================================
    // 14. خصم النقاط
    // =====================================================

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
            "video_generation",

          p_reference_id:
            operationReferenceId,

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

            video_id:
              video.id,

            product_id:
              product.id,

            duration_seconds:
              duration,

            points_cost:
              pointOperation.points,

            runway_credits:
              runwayCredits,

            runway_estimated_cost_usd:
              runwayEstimatedCost,

            operation_reference_id:
              operationReferenceId,
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
        ) ||
        pointsMessage.includes(
          "تحتاج"
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

    pointsTransactionId =
      pointsResult.transaction_id ||
      null;

    pointsCharged =
      Number(
        pointsResult.points_charged ||
          pointOperation.points
      );

    pointsBalanceAfter =
      Number(
        pointsResult.balance_after ??
          0
      );

    // =====================================================
    // 15. إرسال الطلب إلى Runway
    // =====================================================

    let engineResult;

    try {
      engineResult =
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
    } catch (engineError) {
      console.error(
        "RUNWAY GENERATION ERROR:",
        engineError
      );

      const errorMessage =
        engineError?.message ||
        "فشل إرسال الفيديو إلى محرك Runway.";

      const refundResult =
        await refundVideoPoints({
          supabaseAuth,

          transactionId:
            pointsTransactionId,

          userId,

          shopId,

          productId,

          videoId,

          reason:
            "استرجاع نقاط بسبب فشل إرسال الفيديو إلى محرك Runway.",

          stage:
            "runway_request",

          errorMessage,
        });

      await supabaseAdmin
        .from("ad_videos")
        .update({
          status:
            "failed",

          error_message:
            errorMessage,

          error_code:
            "RUNWAY_REQUEST_FAILED",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          video.id
        );

      return NextResponse.json(
        {
          success: false,

          error:
            errorMessage,

          pointsRefunded:
            !!refundResult?.refunded,

          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 16. التأكد من وجود taskId
    // =====================================================

    if (
      !engineResult?.taskId
    ) {
      const errorMessage =
        "محرك الفيديو لم يرجع رقم المهمة.";

      const refundResult =
        await refundVideoPoints({
          supabaseAuth,

          transactionId:
            pointsTransactionId,

          userId,

          shopId,

          productId,

          videoId,

          reason:
            "استرجاع نقاط بسبب عدم الحصول على رقم مهمة Runway.",

          stage:
            "validate_runway_response",

          errorMessage,
        });

      await supabaseAdmin
        .from("ad_videos")
        .update({
          status:
            "failed",

          error_message:
            errorMessage,

          error_code:
            "RUNWAY_TASK_ID_MISSING",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          video.id
        );

      return NextResponse.json(
        {
          success: false,

          error:
            errorMessage,

          pointsRefunded:
            !!refundResult?.refunded,

          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 17. حفظ حالة المعالجة
    // =====================================================

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

          error_message:
            null,

          error_code:
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          video.id
        )
        .select()
        .single();

    // =====================================================
    // إذا فشل حفظ حالة المهمة
    // =====================================================

    if (processingError) {
      console.error(
        "VIDEO PROCESSING UPDATE ERROR:",
        processingError
      );

      const errorMessage =
        processingError.message ||
        "تعذر حفظ حالة الفيديو.";

      const refundResult =
        await refundVideoPoints({
          supabaseAuth,

          transactionId:
            pointsTransactionId,

          userId,

          shopId,

          productId,

          videoId,

          reason:
            "استرجاع نقاط بسبب فشل حفظ حالة الفيديو.",

          stage:
            "save_processing_status",

          errorMessage,
        });

      await supabaseAdmin
        .from("ad_videos")
        .update({
          status:
            "failed",

          error_message:
            errorMessage,

          error_code:
            "PROCESSING_STATUS_SAVE_FAILED",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          video.id
        );

      return NextResponse.json(
        {
          success: false,

          error:
            "تعذر حفظ حالة الفيديو.",

          pointsRefunded:
            !!refundResult?.refunded,

          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 18. تسجيل استخدام Runway
    // =====================================================

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

            input_tokens:
              0,

            output_tokens:
              0,

            total_tokens:
              0,

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

              points_transaction_id:
                pointsTransactionId,

              operation_reference_id:
                operationReferenceId,

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

    // =====================================================
    // 19. الرد
    // =====================================================

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

        transaction_id:
          pointsTransactionId,

        operation_reference_id:
          operationReferenceId,
      },
    });
  } catch (error) {
    console.error(
      "GENERATE VIDEO ERROR:",
      error
    );

    // =====================================================
    // استرجاع النقاط في أي خطأ غير متوقع
    // =====================================================

    let refundResult = null;

    if (
      supabaseAuth &&
      pointsTransactionId
    ) {
      refundResult =
        await refundVideoPoints({
          supabaseAuth,

          transactionId:
            pointsTransactionId,

          userId,

          shopId,

          productId,

          videoId,

          reason:
            "استرجاع نقاط بسبب خطأ غير متوقع أثناء إنشاء الفيديو.",

          stage:
            "unexpected_error",

          errorMessage:
            error?.message ||
            "Unexpected video generation error",
        });
    }

    // =====================================================
    // تسجيل حالة الفشل
    // =====================================================

    if (videoId) {
      try {
        await supabaseAdmin
          .from("ad_videos")
          .update({
            status:
              "failed",

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

        pointsRefunded:
          !!refundResult?.refunded,

        refundTransactionId:
          refundResult?.refund_transaction_id ||
          null,
      },
      {
        status: 500,
      }
    );
  }
}
