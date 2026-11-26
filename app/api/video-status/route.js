import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RUNWAY_API_URL =
  "https://api.dev.runwayml.com";

const RUNWAY_VERSION =
  "2024-11-06";

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
// حساب الاستخدام
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
// العثور على سجل AI Usage الخاص بالفيديو
// -----------------------------------------

async function findVideoUsage(videoId) {
  if (!videoId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from("ai_usage")
    .select("*")
    .contains("metadata", {
      video_id: videoId,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "AI USAGE FIND ERROR:",
      error
    );

    return null;
  }

  return data || null;
}

// -----------------------------------------
// تحديث سجل AI Usage
// -----------------------------------------

async function updateVideoUsage({
  video,
  status,
  providerStatus,
  errorMessage = null,
}) {
  try {
    const usage =
      await findVideoUsage(
        video.id
      );

    if (!usage) {
      console.warn(
        "AI USAGE RECORD NOT FOUND FOR VIDEO:",
        video.id
      );

      return;
    }

    const duration =
      Number(
        video.duration_seconds
      ) || 5;

    const credits =
      Number(
        usage.credits_used
      ) ||
      calculateRunwayCredits(
        duration
      );

    const cost =
      Number(
        usage.estimated_cost
      ) ||
      calculateRunwayCost(
        credits
      );

    const updatedMetadata = {
      ...(usage.metadata || {}),

      video_id:
        video.id,

      provider_task_id:
        video.provider_task_id ||
        null,

      duration_seconds:
        duration,

      credits_used:
        credits,

      cost_per_credit_usd:
        RUNWAY_COST_PER_CREDIT,

      estimated_cost_usd:
        cost,

      provider_status:
        providerStatus || null,

      final_status:
        status,

      completed_at:
        status === "completed"
          ? new Date().toISOString()
          : usage.metadata
              ?.completed_at ||
            null,

      error_message:
        errorMessage || null,
    };

    const {
      error: updateError,
    } = await supabase
      .from("ai_usage")
      .update({
        status,

        credits_used:
          credits,

        estimated_cost:
          cost,

        metadata:
          updatedMetadata,
      })
      .eq("id", usage.id);

    if (updateError) {
      console.error(
        "AI USAGE UPDATE ERROR:",
        updateError
      );
    }
  } catch (error) {
    console.error(
      "AI USAGE UPDATE FAILED:",
      error
    );
  }
}

export async function POST(request) {
  let videoId = null;

  try {
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
          error:
            "الفيديو غير موجود.",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // إذا اكتمل الفيديو مسبقاً
    // -----------------------------------------

    if (
      video.status ===
        "completed" &&
      video.video_url
    ) {
      return NextResponse.json({
        success: true,
        status: "completed",
        video_url:
          video.video_url,
        already_completed:
          true,
      });
    }

    // -----------------------------------------
    // إذا المحرك غير مفعّل
    // -----------------------------------------

    if (
      process.env
        .VIDEO_GENERATION_ENABLED !==
      "true"
    ) {
      return NextResponse.json({
        success: true,
        status:
          video.status,
        engine_enabled:
          false,
        message:
          "محرك الفيديو غير مفعّل حالياً.",
      });
    }

    // -----------------------------------------
    // التأكد من وجود Task ID
    // -----------------------------------------

    if (
      !video.provider_task_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "لا يوجد رقم مهمة لمحرك الفيديو.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // التأكد من وجود Runway API
    // -----------------------------------------

    if (
      !process.env
        .RUNWAYML_API_SECRET
    ) {
      throw new Error(
        "RUNWAYML_API_SECRET غير موجود في إعدادات الخادم."
      );
    }

    // -----------------------------------------
    // فحص حالة المهمة
    // -----------------------------------------

    const response =
      await fetch(
        `${RUNWAY_API_URL}/v1/tasks/${video.provider_task_id}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${process.env.RUNWAYML_API_SECRET}`,

            "X-Runway-Version":
              RUNWAY_VERSION,
          },

          cache: "no-store",
        }
      );

    let result = null;

    try {
      result =
        await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      console.error(
        "RUNWAY TASK STATUS ERROR:",
        result
      );

      const providerMessage =
        result?.error ||
        result?.message ||
        result?.issues?.[0]
          ?.message ||
        `HTTP ${response.status}`;

      throw new Error(
        `تعذر الحصول على حالة الفيديو: ${providerMessage}`
      );
    }

    const runwayStatus =
      String(
        result?.status || ""
      ).toUpperCase();

    // -----------------------------------------
    // ما زال يعمل
    // -----------------------------------------

    if (
      runwayStatus === "PENDING" ||
      runwayStatus === "RUNNING"
    ) {
      const {
        error: updateError,
      } = await supabase
        .from("ad_videos")
        .update({
          status:
            "processing",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", video.id);

      if (updateError) {
        throw updateError;
      }

      // نضمن بقاء سجل AI Usage بحالة processing
      await updateVideoUsage({
        video,
        status:
          "processing",
        providerStatus:
          runwayStatus,
      });

      return NextResponse.json({
        success: true,

        status:
          "processing",

        provider_status:
          runwayStatus,

        task_id:
          video.provider_task_id,
      });
    }

    // -----------------------------------------
    // فشل أو إلغاء
    // -----------------------------------------

    if (
      runwayStatus === "FAILED" ||
      runwayStatus === "CANCELLED"
    ) {
      const errorMessage =
        result?.failure ||
        result?.error ||
        result?.message ||
        "فشل إنشاء الفيديو.";

      const finalStatus =
        runwayStatus ===
        "CANCELLED"
          ? "cancelled"
          : "failed";

      const {
        error: updateError,
      } = await supabase
        .from("ad_videos")
        .update({
          status:
            finalStatus,

          error_message:
            String(
              errorMessage
            ),

          error_code:
            runwayStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", video.id);

      if (updateError) {
        throw updateError;
      }

      // تحديث سجل تكلفة الذكاء الاصطناعي
      await updateVideoUsage({
        video,
        status:
          finalStatus,
        providerStatus:
          runwayStatus,
        errorMessage:
          String(
            errorMessage
          ),
      });

      return NextResponse.json({
        success: true,

        status:
          finalStatus,

        provider_status:
          runwayStatus,

        error:
          String(
            errorMessage
          ),
      });
    }

    // -----------------------------------------
    // نجح التوليد
    // -----------------------------------------

    if (
      runwayStatus ===
      "SUCCEEDED"
    ) {
      const outputUrl =
        Array.isArray(
          result?.output
        )
          ? result.output[0]
          : result?.output;

      if (!outputUrl) {
        throw new Error(
          "تم إنشاء الفيديو لكن لم يتم استلام رابط الفيديو."
        );
      }

      // ---------------------------------------
      // تحميل الفيديو من Runway
      // ---------------------------------------

      const videoResponse =
        await fetch(
          outputUrl
        );

      if (!videoResponse.ok) {
        throw new Error(
          `تعذر تحميل الفيديو الناتج. HTTP ${videoResponse.status}`
        );
      }

      const videoBuffer =
        Buffer.from(
          await videoResponse.arrayBuffer()
        );

      if (!videoBuffer.length) {
        throw new Error(
          "ملف الفيديو الناتج فارغ."
        );
      }

      // ---------------------------------------
      // مسار الفيديو داخل Supabase Storage
      // ---------------------------------------

      const filePath =
        `${video.shop_id}/${video.product_id}/${video.id}.mp4`;

      // ---------------------------------------
      // رفع الفيديو إلى Storage
      // ---------------------------------------

      const {
        error: uploadError,
      } = await supabase.storage
        .from("ad-videos")
        .upload(
          filePath,
          videoBuffer,
          {
            contentType:
              "video/mp4",

            cacheControl:
              "31536000",

            upsert: true,
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      // ---------------------------------------
      // الحصول على الرابط النهائي
      // ---------------------------------------

      const {
        data: publicUrlData,
      } =
        supabase.storage
          .from(
            "ad-videos"
          )
          .getPublicUrl(
            filePath
          );

      const finalVideoUrl =
        publicUrlData
          ?.publicUrl;

      if (!finalVideoUrl) {
        throw new Error(
          "تعذر إنشاء رابط الفيديو النهائي."
        );
      }

      // ---------------------------------------
      // تحديث قاعدة البيانات
      // ---------------------------------------

      const now =
        new Date().toISOString();

      const {
        data: completedVideo,
        error: completedError,
      } =
        await supabase
          .from("ad_videos")
          .update({
            video_url:
              finalVideoUrl,

            status:
              "completed",

            generated_at:
              now,

            completed_at:
              now,

            error_message:
              null,

            error_code:
              null,

            updated_at:
              now,
          })
          .eq("id", video.id)
          .select()
          .single();

      if (completedError) {
        throw completedError;
      }

      // ---------------------------------------
      // تحديث سجل AI Usage
      // ---------------------------------------

      await updateVideoUsage({
        video:
          completedVideo,

        status:
          "completed",

        providerStatus:
          runwayStatus,
      });

      // ---------------------------------------
      // النتيجة النهائية
      // ---------------------------------------

      return NextResponse.json({
        success: true,

        status:
          "completed",

        video_url:
          completedVideo.video_url,

        task_id:
          video.provider_task_id,
      });
    }

    // -----------------------------------------
    // حالة غير معروفة
    // -----------------------------------------

    return NextResponse.json({
      success: true,

      status:
        video.status,

      provider_status:
        runwayStatus,

      message:
        "تم استلام حالة غير متوقعة من محرك الفيديو.",
    });
  } catch (error) {
    console.error(
      "VIDEO STATUS ERROR:",
      error
    );

    // -----------------------------------------
    // تسجيل الخطأ في الفيديو
    // -----------------------------------------

    if (videoId) {
      try {
        await supabase
          .from("ad_videos")
          .update({
            status:
              "failed",

            error_message:
              error?.message ||
              "فشل فحص حالة الفيديو.",

            error_code:
              "VIDEO_STATUS_ERROR",

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            videoId
          );

        // -------------------------------------
        // تسجيل الخطأ في AI Usage
        // -------------------------------------

        const {
          data: failedVideo,
        } =
          await supabase
            .from("ad_videos")
            .select("*")
            .eq(
              "id",
              videoId
            )
            .maybeSingle();

        if (failedVideo) {
          await updateVideoUsage({
            video:
              failedVideo,

            status:
              "failed",

            providerStatus:
              "STATUS_ERROR",

            errorMessage:
              error?.message ||
              "فشل فحص حالة الفيديو.",
          });
        }
      } catch (updateError) {
        console.error(
          "VIDEO STATUS DB ERROR:",
          updateError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "حدث خطأ أثناء فحص الفيديو.",
      },
      { status: 500 }
    );
  }
}
