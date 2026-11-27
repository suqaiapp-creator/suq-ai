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
            // Ignore cookie write errors in route handlers.
          }
        },
      },
    }
  );
}

function clean(value) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();

  return text || null;
}

function isBlockedProduct(product) {
  const safetyStatus = String(product?.safety_status || "").toLowerCase();
  const safetyLevel = String(product?.safety_level || "").toLowerCase();

  return (
    safetyStatus === "locked" ||
    safetyStatus === "violation" ||
    safetyStatus === "blocked" ||
    safetyLevel === "critical"
  );
}

function needsResponsibilityAcceptance(product) {
  const safetyStatus = String(
    product?.safety_status || ""
  ).toLowerCase();

  const verificationStatus = String(
    product?.verification_status || ""
  ).toLowerCase();

  const aiStatus = String(
    product?.ai_status || ""
  ).toLowerCase();

  return (
    safetyStatus === "review" ||
    safetyStatus === "unclear" ||
    verificationStatus === "unverified" ||
    verificationStatus === "review" ||
    aiStatus === "pending" ||
    aiStatus === "review"
  );
}

async function refundPoints(
  supabaseAuth,
  transactionId,
  reason,
  metadata = {}
) {
  if (!transactionId) {
    return {
      success: false,
      skipped: true,
      reason: "missing_transaction_id",
    };
  }

  try {
    const { data, error } = await supabaseAuth.rpc(
      "refund_operation_points",
      {
        p_transaction_id: transactionId,
        p_reason: reason,
        p_metadata: metadata,
      }
    );

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || "Refund failed",
    };
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(request) {
  const supabaseAuth = await getAuthenticatedClient();

  let chargedTransactionId = null;
  let operationReferenceId = null;

  try {
    // -------------------------------------------------------
    // Authentication
    // -------------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "يجب تسجيل الدخول أولاً",
        },
        { status: 401 }
      );
    }

    // -------------------------------------------------------
    // Body
    // -------------------------------------------------------

    const body = await request.json();

    const {
      design_id,
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
    } = body;

    if (!design_id) {
      return NextResponse.json(
        {
          success: false,
          error: "معرّف التصميم مطلوب",
        },
        { status: 400 }
      );
    }

    if (!product_id) {
      return NextResponse.json(
        {
          success: false,
          error: "معرّف المنتج مطلوب",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------
    // Load design
    // -------------------------------------------------------

    const { data: design, error: designError } =
      await supabaseAdmin
        .from("ad_images")
        .select("*")
        .eq("id", design_id)
        .maybeSingle();

    if (designError) {
      throw new Error(
        `تعذر قراءة التصميم: ${designError.message}`
      );
    }

    if (!design) {
      return NextResponse.json(
        {
          success: false,
          error: "التصميم غير موجود",
        },
        { status: 404 }
      );
    }

    // -------------------------------------------------------
    // Load shop
    // -------------------------------------------------------

    if (!design.shop_id) {
      return NextResponse.json(
        {
          success: false,
          error: "التصميم غير مرتبط بمحل",
        },
        { status: 400 }
      );
    }

    const { data: shop, error: shopError } =
      await supabaseAdmin
        .from("shops")
        .select("*")
        .eq("id", design.shop_id)
        .maybeSingle();

    if (shopError) {
      throw new Error(
        `تعذر قراءة المحل: ${shopError.message}`
      );
    }

    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error: "المحل غير موجود",
        },
        { status: 404 }
      );
    }

    // -------------------------------------------------------
    // Ownership
    // -------------------------------------------------------

    if (shop.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "غير مصرح لك بتعديل هذا التصميم",
        },
        { status: 403 }
      );
    }

    // -------------------------------------------------------
    // Load product
    // -------------------------------------------------------

    const { data: product, error: productError } =
      await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", product_id)
        .eq("shop_id", design.shop_id)
        .maybeSingle();

    if (productError) {
      throw new Error(
        `تعذر قراءة المنتج: ${productError.message}`
      );
    }

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: "المنتج غير موجود أو غير مرتبط بالمحل",
        },
        { status: 404 }
      );
    }

    // -------------------------------------------------------
    // Product safety
    // -------------------------------------------------------

    if (isBlockedProduct(product)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "لا يمكن تعديل تصميم هذا المنتج لأنه مقفل أو مخالف.",
        },
        { status: 403 }
      );
    }

    // -------------------------------------------------------
    // Responsibility acceptance
    // -------------------------------------------------------

    if (needsResponsibilityAcceptance(product)) {
      const { data: acceptance, error: acceptanceError } =
        await supabaseAdmin
          .from("product_responsibility_acceptances")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();

      if (acceptanceError) {
        throw new Error(
          `تعذر التحقق من إقرار المسؤولية: ${acceptanceError.message}`
        );
      }

      if (!acceptance) {
        return NextResponse.json(
          {
            success: false,
            error:
              "يجب تأكيد مسؤولية المنتج قبل تعديل التصميم.",
            requires_responsibility_acceptance: true,
          },
          { status: 400 }
        );
      }
    }

    // -------------------------------------------------------
    // Product image
    // -------------------------------------------------------

    const productImage =
      product.image_url ||
      product.image ||
      null;

    if (!productImage) {
      return NextResponse.json(
        {
          success: false,
          error: "المنتج لا يحتوي على صورة.",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------
    // Existing design status
    // -------------------------------------------------------

    const designStatus = String(
      design.status || ""
    ).toLowerCase();

    if (
      designStatus === "generating" ||
      designStatus === "processing"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "التصميم قيد الإنشاء حالياً.",
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------------
    // Settings
    // -------------------------------------------------------

    const settings = {
      template:
        clean(template) ||
        clean(template_id) ||
        "product",

      template_id:
        clean(template_id) ||
        clean(template) ||
        "product",

      mode:
        clean(mode) ||
        "simple",

      style:
        clean(style) ||
        "professional",

      background:
        clean(background) ||
        "clean",

      format:
        clean(format) ||
        "1:1",

      title:
        clean(title) ||
        product.name ||
        "",

      price:
        price === ""
          ? null
          : price === undefined
            ? null
            : price === null
              ? null
              : Number(price),

      discount:
        clean(discount),

      cta:
        clean(cta),

      custom_text:
        clean(custom_text),
    };

    // -------------------------------------------------------
    // Operation reference
    // -------------------------------------------------------

    operationReferenceId = crypto.randomUUID();

    // -------------------------------------------------------
    // Charge 1 point
    // -------------------------------------------------------

    const { data: chargeData, error: chargeError } =
      await supabaseAuth.rpc(
        "charge_operation_points",
        {
          p_operation: "edit_design",
          p_shop_id: design.shop_id,
          p_reference_type: "design_edit",
          p_reference_id: operationReferenceId,
          p_metadata: {
            design_id: design.id,
            product_id: product.id,
            mode: settings.mode,
            template: settings.template,
            format: settings.format,
          },
        }
      );

    if (chargeError) {
      return NextResponse.json(
        {
          success: false,
          error:
            chargeError.message ||
            "تعذر خصم نقطة التعديل.",
        },
        { status: 400 }
      );
    }

    if (!chargeData?.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            chargeData?.message ||
            "تعذر خصم نقطة التعديل.",
        },
        { status: 400 }
      );
    }

    chargedTransactionId =
      chargeData.transaction_id || null;

    // -------------------------------------------------------
    // Mark design as generating
    // -------------------------------------------------------

    const generationStartedAt =
      new Date().toISOString();

    const { error: generatingError } =
      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "generating",
          generation_started_at:
            generationStartedAt,
          error_message: null,
          error_code: null,
        })
        .eq("id", design.id);

    if (generatingError) {
      const refund = await refundPoints(
        supabaseAuth,
        chargedTransactionId,
        "فشل تحديث حالة التصميم قبل التعديل",
        {
          design_id: design.id,
          operation_reference_id:
            operationReferenceId,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            generatingError.message ||
            "تعذر بدء تعديل التصميم.",
          refunded: refund.success,
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------------
    // Build prompt
    // -------------------------------------------------------

    const prompt = await buildDesignPrompt({
      product,
      shop,
      template: settings.template,
      template_id: settings.template_id,
      mode: settings.mode,
      style: settings.style,
      background: settings.background,
      format: settings.format,
      title: settings.title,
      price: settings.price,
      discount: settings.discount,
      cta: settings.cta,
      custom_text: settings.custom_text,
    });

    // -------------------------------------------------------
    // Generate image
    // -------------------------------------------------------

    let generated;

    try {
      generated = await generateDesignImage({
        prompt,
        imageUrl: productImage,
        productImage,
        product,
        shop,
        design,
        settings,
      });
    } catch (generationError) {
      const refund = await refundPoints(
        supabaseAuth,
        chargedTransactionId,
        "فشل توليد التصميم المعدل",
        {
          design_id: design.id,
          operation_reference_id:
            operationReferenceId,
          error:
            generationError?.message || null,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            generationError?.message ||
            "فشل توليد التصميم.",
          error_code: "EDIT_GENERATION_FAILED",
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error:
            generationError?.message ||
            "فشل توليد التصميم.",
          refunded: refund.success,
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------------
    // Validate generated result
    // -------------------------------------------------------

    if (!generated) {
      const refund = await refundPoints(
        supabaseAuth,
        chargedTransactionId,
        "لم يتم الحصول على نتيجة من محرك التصميم",
        {
          design_id: design.id,
          operation_reference_id:
            operationReferenceId,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            "لم يتم الحصول على نتيجة من محرك التصميم.",
          error_code: "EMPTY_GENERATION_RESULT",
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error:
            "لم يتم الحصول على نتيجة من محرك التصميم.",
          refunded: refund.success,
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------------
    // Resolve generated URL
    // -------------------------------------------------------

    const generatedUrl =
      generated.image_url ||
      generated.url ||
      generated.output_url ||
      null;

    if (!generatedUrl) {
      const refund = await refundPoints(
        supabaseAuth,
        chargedTransactionId,
        "نتيجة التصميم لا تحتوي على رابط صورة",
        {
          design_id: design.id,
          operation_reference_id:
            operationReferenceId,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            "نتيجة التصميم لا تحتوي على رابط صورة.",
          error_code: "MISSING_IMAGE_URL",
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error:
            "نتيجة التصميم لا تحتوي على رابط صورة.",
          refunded: refund.success,
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------------
    // Save settings + image
    // -------------------------------------------------------

    const completedAt =
      new Date().toISOString();

    const { data: updatedDesign, error: updateError } =
      await supabaseAdmin
        .from("ad_images")
        .update({
          image_url: generatedUrl,
          status: "completed",
          generated_at: completedAt,
          completed_at: completedAt,
          generation_started_at:
            generationStartedAt,
          error_message: null,
          error_code: null,
          design_settings: settings,
        })
        .eq("id", design.id)
        .select("*")
        .single();

    if (updateError) {
      const refund = await refundPoints(
        supabaseAuth,
        chargedTransactionId,
        "فشل حفظ التصميم المعدل",
        {
          design_id: design.id,
          operation_reference_id:
            operationReferenceId,
        }
      );

      await supabaseAdmin
        .from("ad_images")
        .update({
          status: "failed",
          error_message:
            updateError.message ||
            "فشل حفظ التصميم المعدل.",
          error_code: "DESIGN_UPDATE_FAILED",
        })
        .eq("id", design.id);

      return NextResponse.json(
        {
          success: false,
          error:
            updateError.message ||
            "فشل حفظ التصميم المعدل.",
          refunded: refund.success,
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------------
    // AI usage log
    // -------------------------------------------------------

    try {
      await logAIUsage({
        userId: user.id,
        shopId: design.shop_id,
        productId: product.id,
        operation: "edit_design",
        model:
          generated.model ||
          "design-engine",
        status: "success",
        estimatedCost:
          generated.estimatedCost ??
          null,
        metadata: {
          design_id: design.id,
          operation_reference_id:
            operationReferenceId,
          points_charged:
            chargeData.points_charged ||
            chargeData.cost ||
            1,
          settings,
        },
      });
    } catch {
      // Usage logging must never break a successful design.
    }

    // -------------------------------------------------------
    // Activity log
    // -------------------------------------------------------

    try {
      await supabaseAdmin
        .from("activity_logs")
        .insert({
          user_id: user.id,
          shop_id: design.shop_id,
          action: "edit_design",
          entity_type: "ad_image",
          entity_id: design.id,
          description:
            "تم تعديل تصميم المنتج وإعادة توليده.",
          metadata: {
            product_id: product.id,
            operation_reference_id:
              operationReferenceId,
            settings,
            points_charged:
              chargeData.points_charged ||
              chargeData.cost ||
              1,
          },
        });
    } catch {
      // Activity logging must not fail the operation.
    }

    // -------------------------------------------------------
    // Success
    // -------------------------------------------------------

    return NextResponse.json({
      success: true,
      design: updatedDesign,
      image_url: generatedUrl,
      points_charged:
        chargeData.points_charged ||
        chargeData.cost ||
        1,
      balance:
        chargeData.balance ??
        null,
      transaction_id:
        chargedTransactionId,
      operation_reference_id:
        operationReferenceId,
      message:
        "تم تعديل التصميم بنجاح.",
    });
  } catch (error) {
    // -------------------------------------------------------
    // Unexpected failure
    // -------------------------------------------------------

    let refund = null;

    if (chargedTransactionId) {
      refund = await refundPoints(
        supabaseAuth,
        chargedTransactionId,
        "فشل غير متوقع أثناء تعديل التصميم",
        {
          design_id: null,
          operation_reference_id:
            operationReferenceId,
          error:
            error?.message || null,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "حدث خطأ غير متوقع أثناء تعديل التصميم.",
        refunded:
          refund?.success || false,
      },
      { status: 500 }
    );
  }
}
