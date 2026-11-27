import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { buildDesignPrompt } from "../../../lib/design-generator";
import { generateDesignImage } from "../../../lib/image-generator";
import { logAIUsage } from "../../../lib/ai-usage";

export const runtime = "nodejs";

// =========================================================
// Supabase
// =========================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================================================
// Helpers
// =========================================================

async function getAuthenticatedClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server component / route handler may not allow writes.
          }
        },
      },
    }
  );
}

async function refundDesignPoints(
  supabaseAuth,
  transactionId,
  reason,
  metadata = {}
) {
  if (!transactionId) {
    return {
      success: false,
      refunded: false,
      reason: "لا توجد عملية نقاط لاسترجاعها",
    };
  }

  const { data, error } = await supabaseAuth.rpc(
    "refund_operation_points",
    {
      p_transaction_id: transactionId,
      p_reason: reason,
      p_metadata: metadata,
    }
  );

  if (error) {
    console.error("Refund points error:", error);

    return {
      success: false,
      refunded: false,
      error: error.message,
    };
  }

  return {
    success: true,
    ...(data || {}),
  };
}

async function logDesignFailure({
  userId,
  shopId,
  productId,
  designId,
  errorMessage,
  stage,
}) {
  try {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      shop_id: shopId,
      action: "design_generation_failed",
      entity_type: "ad_image",
      entity_id: designId || null,
      description: errorMessage,
      metadata: {
        stage,
        product_id: productId,
        design_id: designId,
      },
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(request) {
  let user = null;
  let shop = null;
  let product = null;
  let design = null;
  let pointsTransactionId = null;

  try {
    // =====================================================
    // Auth
    // =====================================================

    const supabaseAuth = await getAuthenticatedClient();

    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !authenticatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: "يجب تسجيل الدخول أولاً",
        },
        { status: 401 }
      );
    }

    user = authenticatedUser;

    // =====================================================
    // Body
    // =====================================================

    const body = await request.json();

    const {
      product_id,
      template,
      template_id,
      mode,
      style,
      background,
      format,
      title,
      price,
      discount,
      cta,
      custom_text,
    } = body || {};

    if (!product_id) {
      return NextResponse.json(
        {
          success: false,
          error: "معرّف المنتج مطلوب",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // Load product
    // =====================================================

    const { data: productData, error: productError } =
      await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", product_id)
        .maybeSingle();

    if (productError) {
      console.error("Product load error:", productError);

      return NextResponse.json(
        {
          success: false,
          error: "تعذر قراءة بيانات المنتج",
        },
        { status: 500 }
      );
    }

    if (!productData) {
      return NextResponse.json(
        {
          success: false,
          error: "المنتج غير موجود",
        },
        { status: 404 }
      );
    }

    product = productData;

    // =====================================================
    // Load shop
    // =====================================================

    if (!product.shop_id) {
      return NextResponse.json(
        {
          success: false,
          error: "المنتج غير مرتبط بمتجر",
        },
        { status: 400 }
      );
    }

    const { data: shopData, error: shopError } = await supabaseAdmin
      .from("shops")
      .select("*")
      .eq("id", product.shop_id)
      .maybeSingle();

    if (shopError) {
      console.error("Shop load error:", shopError);

      return NextResponse.json(
        {
          success: false,
          error: "تعذر قراءة بيانات المتجر",
        },
        { status: 500 }
      );
    }

    if (!shopData) {
      return NextResponse.json(
        {
          success: false,
          error: "المتجر غير موجود",
        },
        { status: 404 }
      );
    }

    shop = shopData;

    // =====================================================
    // Ownership
    // =====================================================

    if (shop.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "غير مصرح لك باستخدام هذا المنتج",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // Product safety
    // =====================================================

    const safetyStatus = product.safety_status || "clear";
    const safetyLevel = product.safety_level || "low";

    const blockedStatuses = ["locked", "violation", "blocked"];

    if (blockedStatuses.includes(safetyStatus)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "لا يمكن إنشاء تصميم لهذا المنتج لأنه مقفل أو عليه مخالفة.",
        },
        { status: 403 }
      );
    }

    if (safetyLevel === "critical") {
      return NextResponse.json(
        {
          success: false,
          error:
            "لا يمكن إنشاء تصميم لهذا المنتج بسبب مستوى الخطورة المرتفع.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // Unclear product responsibility
    // =====================================================

    const confidence =
      typeof product.confidence === "number"
        ? product.confidence
        : Number(product.confidence || 0);

    const isUnclearProduct =
      product.ai_status === "unclear" ||
      product.verification_status === "review" ||
      (confidence > 0 && confidence < 0.7);

    if (isUnclearProduct) {
      const { data: acceptance, error: acceptanceError } =
        await supabaseAdmin
          .from("product_responsibility_acceptances")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();

      if (acceptanceError) {
        console.error(
          "Responsibility acceptance error:",
          acceptanceError
        );

        return NextResponse.json(
          {
            success: false,
            error: "تعذر التحقق من إقرار المسؤولية",
          },
          { status: 500 }
        );
      }

      if (!acceptance) {
        return NextResponse.json(
          {
            success: false,
            code: "RESPONSIBILITY_ACCEPTANCE_REQUIRED",
            error:
              "هذا المنتج يحتاج إلى تأكيد مسؤوليتك عن صحة البيانات قبل إنشاء التصميم.",
          },
          { status: 409 }
        );
      }
    }

    // =====================================================
    // Product image
    // =====================================================

    if (!product.image_url) {
      return NextResponse.json(
        {
          success: false,
          error: "المنتج لا يحتوي على صورة",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // Build prompt
    // =====================================================

    let prompt;

    try {
      prompt = buildDesignPrompt({
        product,
        shop,
        template: template || template_id || null,
        mode: mode || "simple",
        style: style || "professional",
        background: background || "clean",
        format: format || "1:1",
        title: title || product.name,
        price: price ?? product.price,
        discount: discount || null,
        cta: cta || null,
        customText: custom_text || null,
      });
    } catch (error) {
      console.error("Prompt build error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "تعذر تجهيز طلب التصميم",
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Create ad image record
    // =====================================================

    const { data: createdDesign, error: designInsertError } =
      await supabaseAdmin
        .from("ad_images")
        .insert({
          product_id: product.id,
          shop_id: shop.id,
          status: "pending",
          generation_started_at: null,
          generated_at: null,
          completed_at: null,
          error_message: null,
          error_code: null,
        })
        .select("*")
        .single();

    if (designInsertError) {
      console.error(
        "Design insert error:",
        designInsertError
      );

      return NextResponse.json(
        {
          success: false,
          error: "تعذر إنشاء سجل التصميم",
        },
        { status: 500 }
      );
    }

    design = createdDesign;

    // =====================================================
    // Charge points
    // =====================================================

    const { data: pointsResult, error: pointsError } =
      await supabaseAuth.rpc(
        "charge_operation_points",
        {
          p_operation_key: "create_design",
          p_user_id: user.id,
          p_shop_id: shop.id,
          p_reference_type: "ad_image",
          p_reference_id: design.id,
          p_description: "إنشاء تصميم إعلاني",
          p_metadata: {
            product_id: product.id,
            design_id: design.id,
            mode: mode || "simple",
            format: format || "1:1",
          },
        }
      );

    if (pointsError) {
      console.error("Charge points error:", pointsError);

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            pointsError.message || "تعذر خصم النقاط",
          error_code: "POINTS_CHARGE_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error:
            pointsError.message ||
            "رصيد النقاط غير كافٍ أو تعذر خصم النقاط.",
        },
        { status: 402 }
      );
    }

    pointsTransactionId =
      pointsResult?.transaction_id || null;

    // =====================================================
    // Start generation
    // =====================================================

    const { error: generatingError } = await supabaseAdmin
      .from("ad_images")
      .update({
        status: "generating",
        generation_started_at: new Date().toISOString(),
        error_message: null,
        error_code: null,
      })
      .eq("id", design.id);

    if (generatingError) {
      console.error(
        "Generating status error:",
        generatingError
      );

      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب فشل بدء عملية التصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "set_generating",
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            generatingError.message ||
            "تعذر بدء عملية التصميم",
          error_code: "GENERATION_START_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      await logDesignFailure({
        userId: user.id,
        shopId: shop.id,
        productId: product.id,
        designId: design.id,
        errorMessage:
          generatingError.message ||
          "تعذر بدء عملية التصميم",
        stage: "set_generating",
      });

      return NextResponse.json(
        {
          success: false,
          error: "تعذر بدء عملية التصميم",
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Generate image
    // =====================================================

    let generated;

    try {
      generated = await generateDesignImage({
        prompt,
        productImageUrl: product.image_url,
        format: format || "1:1",
        mode: mode || "simple",
        style: style || "professional",
        background: background || "clean",
      });
    } catch (generationError) {
      console.error(
        "Design generation error:",
        generationError
      );

      const errorMessage =
        generationError?.message ||
        "فشل إنشاء التصميم";

      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب فشل إنشاء التصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "generate_image",
          error: errorMessage,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message: errorMessage,
          error_code: "IMAGE_GENERATION_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      await logDesignFailure({
        userId: user.id,
        shopId: shop.id,
        productId: product.id,
        designId: design.id,
        errorMessage,
        stage: "generate_image",
      });

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Validate generated result
    // =====================================================

    if (!generated) {
      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب عدم وجود نتيجة للتصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "validate_generation",
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message: "لم يتم الحصول على نتيجة من محرك التصميم",
          error_code: "EMPTY_GENERATION_RESULT",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error: "لم يتم الحصول على نتيجة من محرك التصميم",
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Resolve generated image URL
    // =====================================================

    const generatedUrl =
      typeof generated === "string"
        ? generated
        : generated.url ||
          generated.image_url ||
          generated.output_url ||
          generated.data?.url ||
          null;

    if (!generatedUrl) {
      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب عدم وجود رابط لصورة التصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "resolve_generated_url",
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            "محرك التصميم أعاد نتيجة بدون رابط صورة",
          error_code: "MISSING_GENERATED_URL",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error: "تعذر الحصول على صورة التصميم",
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Download generated image
    // =====================================================

    let imageResponse;

    try {
      imageResponse = await fetch(generatedUrl);
    } catch (downloadError) {
      console.error(
        "Generated image download error:",
        downloadError
      );

      const errorMessage =
        downloadError?.message ||
        "تعذر تحميل صورة التصميم";

      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب فشل تحميل صورة التصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "download_generated_image",
          error: errorMessage,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message: errorMessage,
          error_code: "IMAGE_DOWNLOAD_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    if (!imageResponse.ok) {
      const errorMessage =
        "تعذر تحميل الصورة الناتجة من محرك التصميم";

      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب فشل تحميل الصورة الناتجة",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "download_generated_image",
          http_status: imageResponse.status,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message: errorMessage,
          error_code: "IMAGE_DOWNLOAD_HTTP_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    // =====================================================
    // Upload to Supabase Storage
    // =====================================================

    const storagePath =
      `${shop.id}/${product.id}/${design.id}.png`;

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("ad-images")
        .upload(storagePath, imageBuffer, {
          contentType: "image/png",
          upsert: true,
        });

    if (uploadError) {
      console.error(
        "Design storage upload error:",
        uploadError
      );

      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب فشل حفظ صورة التصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "storage_upload",
          error: uploadError.message,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message: uploadError.message,
          error_code: "STORAGE_UPLOAD_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error: "تعذر حفظ صورة التصميم",
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Public URL
    // =====================================================

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage
      .from("ad-images")
      .getPublicUrl(storagePath);

    if (!publicUrl) {
      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب فشل إنشاء رابط التصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "public_url",
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message: "تعذر إنشاء رابط صورة التصميم",
          error_code: "PUBLIC_URL_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error: "تعذر إنشاء رابط صورة التصميم",
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Complete design
    // =====================================================

    const { data: completedDesign, error: completeError } =
      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "completed",
          image_url: publicUrl,
          generated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: null,
          error_code: null,
        })
        .eq("id", design.id)
        .select("*")
        .single();

    if (completeError) {
      console.error(
        "Complete design error:",
        completeError
      );

      const refundResult = await refundDesignPoints(
        supabaseAuth,
        pointsTransactionId,
        "استرجاع نقاط بسبب فشل حفظ نتيجة التصميم",
        {
          design_id: design.id,
          product_id: product.id,
          stage: "complete_design",
          error: completeError.message,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message: completeError.message,
          error_code: "DESIGN_COMPLETE_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", design.id);

      await logDesignFailure({
        userId: user.id,
        shopId: shop.id,
        productId: product.id,
        designId: design.id,
        errorMessage: completeError.message,
        stage: "complete_design",
      });

      return NextResponse.json(
        {
          success: false,
          error: "تعذر حفظ نتيجة التصميم",
          pointsRefunded: !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id || null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // AI Usage log
    // =====================================================

    try {
      await logAIUsage({
        userId: user.id,
        shopId: shop.id,
        productId: product.id,
        operation: "create_design",
        model:
          generated?.model ||
          generated?.provider ||
          "design-engine",
        status: "completed",
        metadata: {
          design_id: design.id,
          template: template || template_id || null,
          mode: mode || "simple",
          style: style || "professional",
          background: background || "clean",
          format: format || "1:1",
          points_transaction_id: pointsTransactionId,
          points_charged:
            pointsResult?.points_charged || 0,
        },
      });
    } catch (usageError) {
      // لا نفشل التصميم إذا فشل تسجيل الاستخدام.
      console.error(
        "AI usage logging error:",
        usageError
      );
    }

    // =====================================================
    // Activity log
    // =====================================================

    try {
      await supabaseAdmin.from("activity_logs").insert({
        user_id: user.id,
        shop_id: shop.id,
        action: "design_generated",
        entity_type: "ad_image",
        entity_id: design.id,
        description: "تم إنشاء التصميم بنجاح",
        metadata: {
          product_id: product.id,
          design_id: design.id,
          points_charged:
            pointsResult?.points_charged || 0,
          points_transaction_id: pointsTransactionId,
        },
      });
    } catch (activityError) {
      console.error(
        "Activity success log error:",
        activityError
      );
    }

    // =====================================================
    // Success
    // =====================================================

    return NextResponse.json({
      success: true,
      design: completedDesign,
      image_url: publicUrl,
      pointsCharged:
        pointsResult?.points_charged || 0,
      pointsBalance:
        pointsResult?.balance_after ?? null,
      pointsTransactionId,
      pointsRefunded: false,
    });
  } catch (error) {
    console.error(
      "Generate design unexpected error:",
      error
    );

    // =====================================================
    // Unexpected failure after charging
    // =====================================================

    let refundResult = null;

    if (user?.id && pointsTransactionId) {
      try {
        const supabaseAuth = await getAuthenticatedClient();

        refundResult = await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب خطأ غير متوقع أثناء إنشاء التصميم",
          {
            design_id: design?.id || null,
            product_id: product?.id || null,
            stage: "unexpected_error",
            error:
              error?.message ||
              "Unexpected design generation error",
          }
        );
      } catch (refundError) {
        console.error(
          "Unexpected refund error:",
          refundError
        );
      }
    }

    if (design?.id) {
      try {
        await supabaseAdmin
          .from("ad_images")
          .update({
            status: "failed",
            error_message:
              error?.message ||
              "حدث خطأ غير متوقع",
            error_code: "UNEXPECTED_ERROR",
            completed_at: new Date().toISOString(),
          })
          .eq("id", design.id);
      } catch (updateError) {
        console.error(
          "Failed design update error:",
          updateError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "حدث خطأ غير متوقع أثناء إنشاء التصميم",
        pointsRefunded: !!refundResult?.refunded,
        refundTransactionId:
          refundResult?.refund_transaction_id || null,
      },
      { status: 500 }
    );
  }
}
