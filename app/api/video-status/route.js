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
    // إذا اكتمل الفيديو مسبقاً
    // -----------------------------------------

    if (
      video.status === "completed" &&
      video.video_url
    ) {
      return NextResponse.json({
        success: true,
        status: "completed",
        video_url: video.video_url,
        already_completed: true,
      });
    }

    // -----------------------------------------
    // إذا المحرك غير مفعّل
    // -----------------------------------------

    if (
      process.env.VIDEO_GENERATION_ENABLED !==
      "true"
    ) {
      return NextResponse.json({
        success: true,
        status: video.status,
        engine_enabled: false,
        message:
          "محرك الفيديو غير مفعّل حالياً.",
      });
    }

    // -----------------------------------------
    // التأكد من وجود Task ID
    // -----------------------------------------

    if (!video.provider_task_id) {
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
      !process.env.RUNWAYML_API_SECRET
    ) {
      throw new Error(
        "RUNWAYML_API_SECRET غير موجود في إعدادات الخادم."
      );
    }

    // -----------------------------------------
    // فحص حالة المهمة
    // -----------------------------------------

    const response = await fetch(
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
      result = await response.json();
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
        result?.issues?.[0]?.message ||
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
          status: "processing",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", video.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,

        status: "processing",

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
        runwayStatus === "CANCELLED"
          ? "cancelled"
          : "failed";

      const {
        error: updateError,
      } = await supabase
        .from("ad_videos")
        .update({
          status: finalStatus,

          error_message:
            String(errorMessage),

          error_code:
            runwayStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", video.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,

        status: finalStatus,

        provider_status:
          runwayStatus,

        error:
          String(errorMessage),
      });
    }

    // -----------------------------------------
    // نجح التوليد
    // -----------------------------------------

    if (
      runwayStatus === "SUCCEEDED"
    ) {
      const outputUrl =
        Array.isArray(result?.output)
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
        await fetch(outputUrl);

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
          .from("ad-videos")
          .getPublicUrl(
            filePath
          );

      const finalVideoUrl =
        publicUrlData?.publicUrl;

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
      // النتيجة النهائية
      // ---------------------------------------

      return NextResponse.json({
        success: true,

        status: "completed",

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

      status: video.status,

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
              "فشل فحص حالة الفيديو.",

            error_code:
              "VIDEO_STATUS_ERROR",

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", videoId);
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
