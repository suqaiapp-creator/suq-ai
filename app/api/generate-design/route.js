import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildDesignPrompt } from "../../../lib/design-generator";
import { generateDesignImage } from "../../../lib/image-generator";
import { logAIUsage } from "../../../lib/ai-usage";

export const runtime = "nodejs";

// -----------------------------------------
// Service Role Client
// للعمليات الداخلية الموثوقة فقط
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

const ALLOWED_MODES = [
  "simple",
  "professional",
];

const ALLOWED_FORMATS = [
  "1:1",
  "4:5",
  "9:16",
  "16:9",
];

const DESIGN_OPERATION_KEY = "create_design";
const DESIGN_POINTS_COST = 3;

function getErrorMessage(error) {
  if (!error) {
    return "خطأ غير معروف.";
  }

  if (typeof error === "string") {
    return error;
  }

  return (
    error.message ||
    error.error?.message ||
    error.details ||
    error.hint ||
    "خطأ غير معروف."
  );
}

async function markDesignFailed(
  designId,
  errorMessage,
  errorCode = "GENERATION_FAILED"
) {
  if (!designId) {
    return;
  }

  try {
    await supabaseAdmin
      .from("ad_images")
      .update({
        status: "failed",
        error_message: errorMessage,
        error_code: errorCode,
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", designId);
  } catch (error) {
    console.error(
      "Failed to update design error:",
      error
    );
  }
}

export async function POST(request) {
  let designId = null;
  let pointsCharged = false;
  let pointsTransactionId = null;

  try {
    // -----------------------------------------
    // 1. جلسة المستخدم
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
        { status: 401 }
      );
    }

    // -----------------------------------------
    // 2. قراءة الطلب
    // -----------------------------------------

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "بيانات الطلب غير صحيحة.",
        },
        { status: 400 }
      );
    }

    const {
      productId,
      mode,
      template,
      style,
      background,
      format,
      description,
    } = body || {};

    // -----------------------------------------
    // 3. التحقق من البيانات
    // -----------------------------------------

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "معرّف المنتج مطلوب.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_MODES.includes(mode)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "نوع التصميم غير صحيح.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_FORMATS.includes(format)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "مقاس التصميم غير صحيح.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 4. جلب المنتج
    // Service Role لأننا تحققنا من الملكية
    // -----------------------------------------

    const {
      data: product,
      error: productError,
    } =
      await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

    if (
      productError ||
      !product
    ) {
      console.error(
        "PRODUCT FETCH ERROR:",
        productError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "المنتج غير موجود.",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // 5. shop_id
    // -----------------------------------------

    if (!product.shop_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "هذا المنتج غير مرتبط بمحل.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 6. جلب المحل
    // -----------------------------------------

    const {
      data: shop,
      error: shopError,
    } =
      await supabaseAdmin
        .from("shops")
        .select("*")
        .eq(
          "id",
          product.shop_id
        )
        .maybeSingle();

    if (shopError) {
      console.error(
        "SHOP FETCH ERROR:",
        shopError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر قراءة بيانات المحل.",
        },
        { status: 500 }
      );
    }

    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error:
            "المحل غير موجود.",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // 7. حماية الملكية
    // -----------------------------------------

    if (
      shop.owner_id !== user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ليس لديك صلاحية استخدام هذا المنتج.",
        },
        { status: 403 }
      );
    }

    // -----------------------------------------
    // 8. فحص المنتج المقفل
    // -----------------------------------------

    const isLocked =
      product.verification_status ===
        "locked" ||
      product.safety_status ===
        "locked" ||
      product.safety_status ===
        "violation" ||
      product.safety_level ===
        "critical";

    if (isLocked) {
      return NextResponse.json(
        {
          success: false,
          error:
            "هذا المنتج مقفل ولا يمكن استخدامه في التصميم.",
          locked: true,
        },
        { status: 403 }
      );
    }

    // -----------------------------------------
    // 9. فحص وضوح المنتج
    // -----------------------------------------

    const isUnclear =
      product.verification_status ===
        "review" ||
      product.verification_status ===
        "unverified" ||
      product.ai_status ===
        "pending" ||
      product.confidence ===
        "low" ||
      product.confidence ===
        "medium" ||
      !product.brand ||
      !product.category ||
      !product.description;

    if (isUnclear) {
      const {
        data: acceptance,
        error: acceptanceError,
      } =
        await supabaseAdmin
          .from(
            "product_responsibility_acceptances"
          )
          .select("id")
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "product_id",
            product.id
          )
          .maybeSingle();

      if (acceptanceError) {
        console.error(
          "RESPONSIBILITY ACCEPTANCE ERROR:",
          acceptanceError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر التحقق من تأكيد مسؤولية المنتج.",
          },
          { status: 500 }
        );
      }

      if (!acceptance) {
        return NextResponse.json(
          {
            success: false,
            error:
              "يجب تأكيد مسؤولية المنتج قبل إنشاء التصميم.",
            requiresResponsibility:
              true,
          },
          { status: 400 }
        );
      }
    }

    // -----------------------------------------
    // 10. صورة المنتج
    // -----------------------------------------

    if (!product.image_url) {
      return NextResponse.json(
        {
          success: false,
          error:
            "المنتج لا يحتوي على صورة.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 11. بناء Prompt
    // -----------------------------------------

    const designPrompt =
      buildDesignPrompt({
        product,
        shop,
        mode,
        template,
        style,
        background,
        format,
        description,
      });

    // -----------------------------------------
    // 12. إنشاء سجل التصميم
    // -----------------------------------------

    const {
      data: design,
      error: insertError,
    } =
      await supabaseAdmin
        .from("ad_images")
        .insert({
          product_id:
            product.id,

          shop_id:
            shop.id,

          image_url: null,

          format,

          prompt:
            designPrompt,

          status:
            "pending",

          generated_at:
            null,

          completed_at:
            null,

          error_message:
            null,

          error_code:
            null,

          generation_started_at:
            null,
        })
        .select(
          "id, status, created_at"
        )
        .single();

    if (
      insertError ||
      !design
    ) {
      console.error(
        "CREATE DESIGN ERROR:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر إنشاء طلب التصميم.",
        },
        { status: 500 }
      );
    }

    designId = design.id;

    // -----------------------------------------
    // 13. خصم النقاط
    //
    // مهم:
    // نستخدم supabaseAuth وليس supabaseAdmin
    // حتى auth.uid() داخل RPC يكون المستخدم الحقيقي.
    // -----------------------------------------

    const {
      data: pointsResult,
      error: pointsError,
    } =
      await supabaseAuth.rpc(
        "charge_operation_points",
        {
          p_operation_key:
            DESIGN_OPERATION_KEY,

          p_user_id:
            user.id,

          p_shop_id:
            shop.id,

          p_reference_type:
            "ad_image",

          p_reference_id:
            designId,

          p_description:
            `إنشاء تصميم للمنتج: ${
              product.name ||
              "منتج"
            }`,

          p_metadata: {
            design_id:
              designId,

            product_id:
              product.id,

            operation:
              DESIGN_OPERATION_KEY,

            points_cost:
              DESIGN_POINTS_COST,

            mode,

            format,

            template:
              template || null,

            style:
              style || null,

            background:
              background || null,
          },
        }
      );

    if (
      pointsError ||
      !pointsResult?.success
    ) {
      console.error(
        "POINTS CHARGE ERROR:",
        pointsError ||
          pointsResult
      );

      const errorMessage =
        pointsError?.message ||
        "تعذر خصم نقاط العملية.";

      await markDesignFailed(
        designId,
        errorMessage,
        "POINTS_CHARGE_FAILED"
      );

      const insufficient =
        errorMessage.includes(
          "غير كاف"
        ) ||
        errorMessage.includes(
          "رصيد النقاط"
        );

      return NextResponse.json(
        {
          success: false,

          designId,

          status:
            "failed",

          error:
            insufficient
              ? errorMessage
              : "تعذر تجهيز رصيد النقاط لإنشاء التصميم.",

          code:
            insufficient
              ? "INSUFFICIENT_POINTS"
              : "POINTS_CHARGE_FAILED",

          pointsRequired:
            DESIGN_POINTS_COST,
        },
        {
          status:
            insufficient
              ? 402
              : 500,
        }
      );
    }

    pointsCharged =
      pointsResult.charged ===
      true;

    pointsTransactionId =
      pointsResult.transaction_id ||
      null;

    // -----------------------------------------
    // 14. تحويل الحالة إلى generating
    // -----------------------------------------

    const {
      error: generatingError,
    } =
      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "generating",

          generation_started_at:
            new Date().toISOString(),

          error_message:
            null,

          error_code:
            null,
        })
        .eq(
          "id",
          designId
        );

    if (generatingError) {
      console.error(
        "GENERATING STATUS ERROR:",
        generatingError
      );

      await markDesignFailed(
        designId,
        generatingError.message,
        "STATUS_UPDATE_FAILED"
      );

      return NextResponse.json(
        {
          success: false,
          designId,
          error:
            "تعذر تجهيز طلب التصميم.",
          pointsCharged,
          pointsTransactionId,
        },
        { status: 500 }
      );
    }

    // -----------------------------------------
    // 15. تشغيل مولد الصورة
    // -----------------------------------------

    try {
      const generated =
        await generateDesignImage({
          productImageUrl:
            product.image_url,

          prompt:
            designPrompt,

          format,
        });

      if (
        !generated?.b64_json
      ) {
        throw new Error(
          "لم يتم استلام الصورة الناتجة من محرك الصور."
        );
      }

      // -----------------------------------------
      // 16. Base64 → Buffer
      // -----------------------------------------

      const imageBuffer =
        Buffer.from(
          generated.b64_json,
          "base64"
        );

      if (
        !imageBuffer.length
      ) {
        throw new Error(
          "بيانات الصورة الناتجة فارغة."
        );
      }

      // -----------------------------------------
      // 17. Storage
      // -----------------------------------------

      const storagePath =
        `${shop.id}/${product.id}/${designId}.png`;

      const {
        error: uploadError,
      } =
        await supabaseAdmin.storage
          .from("ad-images")
          .upload(
            storagePath,
            imageBuffer,
            {
              contentType:
                "image/png",

              upsert:
                false,
            }
          );

      if (uploadError) {
        throw new Error(
          `تعذر حفظ الصورة في التخزين: ${uploadError.message}`
        );
      }

      // -----------------------------------------
      // 18. Public URL
      // -----------------------------------------

      const {
        data:
          publicUrlData,
      } =
        supabaseAdmin.storage
          .from("ad-images")
          .getPublicUrl(
            storagePath
          );

      const imageUrl =
        publicUrlData?.publicUrl;

      if (!imageUrl) {
        throw new Error(
          "تعذر الحصول على رابط الصورة الناتجة."
        );
      }

      // -----------------------------------------
      // 19. إكمال التصميم
      // -----------------------------------------

      const completedAt =
        new Date().toISOString();

      const {
        error: updateError,
      } =
        await supabaseAdmin
          .from("ad_images")
          .update({
            image_url:
              imageUrl,

            status:
              "completed",

            generated_at:
              completedAt,

            completed_at:
              completedAt,

            error_message:
              null,

            error_code:
              null,
          })
          .eq(
            "id",
            designId
          );

      if (updateError) {
        throw new Error(
          `تعذر تحديث سجل التصميم: ${updateError.message}`
        );
      }

      // -----------------------------------------
      // 20. تسجيل AI Usage
      // -----------------------------------------

      try {
        await logAIUsage({
          userId:
            user.id,

          shopId:
            shop.id,

          productId:
            product.id,

          operation:
            "design_generation",

          model:
            generated.model ||
            "gpt-image-2",

          status:
            "success",

          estimatedCost:
            0,

          metadata: {
            design_id:
              designId,

            format,

            mode,

            template:
              template || null,

            style:
              style || null,

            background:
              background || null,

            points_charged:
              pointsCharged
                ? DESIGN_POINTS_COST
                : 0,

            points_transaction_id:
              pointsTransactionId,

            points_operation:
              DESIGN_OPERATION_KEY,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOGGING ERROR:",
          usageError
        );
      }

      // -----------------------------------------
      // 21. النجاح
      // -----------------------------------------

      return NextResponse.json({
        success: true,

        designId,

        status:
          "completed",

        imageUrl,

        pointsCharged:
          pointsCharged
            ? DESIGN_POINTS_COST
            : 0,

        pointsTransactionId,

        pointsBalanceAfter:
          pointsResult.balance_after ??
          null,
      });
    } catch (generationError) {
      console.error(
        "IMAGE GENERATION ERROR:",
        generationError
      );

      const errorMessage =
        getErrorMessage(
          generationError
        );

      await markDesignFailed(
        designId,
        errorMessage,
        "GENERATION_FAILED"
      );

      try {
        await logAIUsage({
          userId:
            user.id,

          shopId:
            shop.id,

          productId:
            product.id,

          operation:
            "design_generation",

          model:
            "gpt-image-2",

          status:
            "failed",

          estimatedCost:
            0,

          metadata: {
            design_id:
              designId,

            error:
              errorMessage,

            format,

            mode,

            points_charged:
              pointsCharged
                ? DESIGN_POINTS_COST
                : 0,

            points_transaction_id:
              pointsTransactionId,

            points_operation:
              DESIGN_OPERATION_KEY,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOGGING FAILED:",
          usageError
        );
      }

      return NextResponse.json(
        {
          success: false,

          designId,

          status:
            "failed",

          error:
            errorMessage,

          pointsCharged:
            pointsCharged
              ? DESIGN_POINTS_COST
              : 0,

          pointsTransactionId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(
      "GENERATE DESIGN API ERROR:",
      error
    );

    const errorMessage =
      getErrorMessage(error);

    if (designId) {
      await markDesignFailed(
        designId,
        errorMessage,
        "UNEXPECTED_ERROR"
      );
    }

    return NextResponse.json(
      {
        success: false,

        designId,

        error:
          errorMessage,

        pointsCharged:
          pointsCharged
            ? DESIGN_POINTS_COST
            : 0,

        pointsTransactionId,
      },
      { status: 500 }
    );
  }
}
