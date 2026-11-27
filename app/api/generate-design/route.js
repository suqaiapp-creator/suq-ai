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
// Auth client
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
            // Route handler may not allow cookie writes.
          }
        },
      },
    }
  );
}

// =========================================================
// Refund points
// =========================================================

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

// =========================================================
// Failure log
// =========================================================

async function logDesignFailure({
  userId,
  shopId,
  productId,
  designId,
  errorMessage,
  stage,
  operation = "design",
}) {
  try {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      shop_id: shopId,
      action:
        operation === "edit_design"
          ? "design_edit_failed"
          : "design_generation_failed",
      entity_type: "ad_image",
      entity_id: designId || null,
      description: errorMessage,
      metadata: {
        stage,
        operation,
        product_id: productId,
        design_id: designId,
      },
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
}

// =========================================================
// Product safety / responsibility
// =========================================================

async function validateProduct({
  user,
  product,
}) {
  const safetyStatus = product.safety_status || "clear";
  const safetyLevel = product.safety_level || "low";

  const blockedStatuses = [
    "locked",
    "violation",
    "blocked",
  ];

  if (blockedStatuses.includes(safetyStatus)) {
    return {
      valid: false,
      status: 403,
      error:
        "لا يمكن إنشاء أو تعديل تصميم لهذا المنتج لأنه مقفل أو عليه مخالفة.",
    };
  }

  if (safetyLevel === "critical") {
    return {
      valid: false,
      status: 403,
      error:
        "لا يمكن إنشاء أو تعديل تصميم لهذا المنتج بسبب مستوى الخطورة المرتفع.",
    };
  }

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

      return {
        valid: false,
        status: 500,
        error: "تعذر التحقق من إقرار المسؤولية",
      };
    }

    if (!acceptance) {
      return {
        valid: false,
        status: 409,
        code: "RESPONSIBILITY_ACCEPTANCE_REQUIRED",
        error:
          "هذا المنتج يحتاج إلى تأكيد مسؤوليتك عن صحة البيانات قبل إنشاء أو تعديل التصميم.",
      };
    }
  }

  return {
    valid: true,
  };
}

// =========================================================
// Build design prompt
// =========================================================

function createPrompt({
  product,
  shop,
  template,
  mode,
  style,
  background,
  format,
  title,
  price,
  discount,
  cta,
  customText,
}) {
  return buildDesignPrompt({
    product,
    shop,
    template: template || null,
    mode: mode || "simple",
    style: style || "professional",
    background: background || "clean",
    format: format || "1:1",
    title: title || product.name,
    price: price ?? product.price,
    discount: discount || null,
    cta: cta || null,
    customText: customText || null,
  });
}

// =========================================================
// Resolve generated URL
// =========================================================

function resolveGeneratedUrl(generated) {
  if (!generated) {
    return null;
  }

  if (typeof generated === "string") {
    return generated;
  }

  return (
    generated.url ||
    generated.image_url ||
    generated.output_url ||
    generated.data?.url ||
    null
  );
}

// =========================================================
// Mark design failed
// =========================================================

async function markDesignFailed({
  designId,
  errorMessage,
  errorCode,
}) {
  if (!designId) return;

  try {
    await supabaseAdmin
      .from("ad_images")
      .update({
        status: "failed",
        error_message: errorMessage,
        error_code: errorCode,
        completed_at: new Date().toISOString(),
      })
      .eq("id", designId);
  } catch (error) {
    console.error(
      "Failed to update design status:",
      error
    );
  }
}

// =========================================================
// Charge points
// =========================================================

async function chargeDesignPoints({
  supabaseAuth,
  user,
  shop,
  operationKey,
  referenceType,
  referenceId,
  description,
  metadata,
}) {
  const { data, error } =
    await supabaseAuth.rpc(
      "charge_operation_points",
      {
        p_operation_key: operationKey,
        p_user_id: user.id,
        p_shop_id: shop.id,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
        p_description: description,
        p_metadata: metadata,
      }
    );

  if (error) {
    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
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
  let operation = "create_design";

  try {
    // =====================================================
    // Auth
    // =====================================================

    const supabaseAuth =
      await getAuthenticatedClient();

    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (
      authError ||
      !authenticatedUser
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "يجب تسجيل الدخول أولاً",
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
      action,
      operation: requestedOperation,

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
    } = body || {};

    // =====================================================
    // Determine operation
    // =====================================================

    operation =
      action === "edit" ||
      requestedOperation === "edit_design"
        ? "edit_design"
        : "create_design";

    // =====================================================
    // Basic validation
    // =====================================================

    if (
      operation === "edit_design" &&
      !design_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "معرّف التصميم مطلوب للتعديل",
        },
        { status: 400 }
      );
    }

    if (
      operation === "create_design" &&
      !product_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "معرّف المنتج مطلوب",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // EDIT MODE
    // =====================================================

    if (operation === "edit_design") {
      // ===================================================
      // Load existing design
      // ===================================================

      const {
        data: existingDesign,
        error: designLoadError,
      } = await supabaseAdmin
        .from("ad_images")
        .select("*")
        .eq("id", design_id)
        .maybeSingle();

      if (designLoadError) {
        console.error(
          "Design load error:",
          designLoadError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر قراءة التصميم",
          },
          { status: 500 }
        );
      }

      if (!existingDesign) {
        return NextResponse.json(
          {
            success: false,
            error:
              "التصميم غير موجود",
          },
          { status: 404 }
        );
      }

      design = existingDesign;

      // ===================================================
      // Resolve product from design
      // ===================================================

      const editProductId =
        existingDesign.product_id ||
        product_id;

      if (!editProductId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "التصميم غير مرتبط بمنتج",
          },
          { status: 400 }
        );
      }

      // ===================================================
      // Load product
      // ===================================================

      const {
        data: productData,
        error: productError,
      } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", editProductId)
        .maybeSingle();

      if (productError) {
        console.error(
          "Product load error:",
          productError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر قراءة بيانات المنتج",
          },
          { status: 500 }
        );
      }

      if (!productData) {
        return NextResponse.json(
          {
            success: false,
            error:
              "المنتج غير موجود",
          },
          { status: 404 }
        );
      }

      product = productData;

      // ===================================================
      // Load shop
      // ===================================================

      if (!product.shop_id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "المنتج غير مرتبط بمتجر",
          },
          { status: 400 }
        );
      }

      const {
        data: shopData,
        error: shopError,
      } = await supabaseAdmin
        .from("shops")
        .select("*")
        .eq("id", product.shop_id)
        .maybeSingle();

      if (shopError) {
        console.error(
          "Shop load error:",
          shopError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر قراءة بيانات المتجر",
          },
          { status: 500 }
        );
      }

      if (!shopData) {
        return NextResponse.json(
          {
            success: false,
            error:
              "المتجر غير موجود",
          },
          { status: 404 }
        );
      }

      shop = shopData;

      // ===================================================
      // Ownership
      // ===================================================

      if (shop.owner_id !== user.id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "غير مصرح لك بتعديل هذا التصميم",
          },
          { status: 403 }
        );
      }

      // ===================================================
      // Product safety
      // ===================================================

      const safetyValidation =
        await validateProduct({
          user,
          product,
        });

      if (!safetyValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            ...(safetyValidation.code
              ? {
                  code:
                    safetyValidation.code,
                }
              : {}),
            error:
              safetyValidation.error,
          },
          {
            status:
              safetyValidation.status,
          }
        );
      }

      // ===================================================
      // Product image
      // ===================================================

      if (!product.image_url) {
        return NextResponse.json(
          {
            success: false,
            error:
              "المنتج لا يحتوي على صورة",
          },
          { status: 400 }
        );
      }

      // ===================================================
      // Build prompt
      // ===================================================

      let prompt;

      try {
        prompt = createPrompt({
          product,
          shop,
          template:
            template ||
            template_id ||
            null,
          mode:
            mode || "simple",
          style:
            style ||
            "professional",
          background:
            background ||
            "clean",
          format:
            format || "1:1",
          title:
            title ||
            product.name,
          price:
            price ??
            product.price,
          discount:
            discount || null,
          cta:
            cta || null,
          customText:
            custom_text || null,
        });
      } catch (error) {
        console.error(
          "Edit prompt build error:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر تجهيز تعديل التصميم",
          },
          { status: 500 }
        );
      }

      // ===================================================
      // Charge edit points
      // ===================================================

      const pointsResult =
        await chargeDesignPoints({
          supabaseAuth,
          user,
          shop,
          operationKey:
            "edit_design",
          referenceType:
            "ad_image_edit",
          referenceId:
            design.id,
          description:
            "تعديل تصميم إعلاني",
          metadata: {
            product_id:
              product.id,
            design_id:
              design.id,
            mode:
              mode || "simple",
            format:
              format || "1:1",
          },
        });

      if (!pointsResult.success) {
        console.error(
          "Edit charge points error:",
          pointsResult.error
        );

        return NextResponse.json(
          {
            success: false,
            error:
              pointsResult.error?.message ||
              "رصيد النقاط غير كافٍ أو تعذر خصم النقاط.",
          },
          { status: 402 }
        );
      }

      pointsTransactionId =
        pointsResult.data
          ?.transaction_id || null;

      // ===================================================
      // Set generating
      // ===================================================

      const {
        error: generatingError,
      } = await supabaseAdmin
        .from("ad_images")
        .update({
          status: "generating",
          generation_started_at:
            new Date().toISOString(),
          error_message: null,
          error_code: null,
        })
        .eq("id", design.id)
        .eq("shop_id", shop.id);

      if (generatingError) {
        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب فشل بدء تعديل التصميم",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_set_generating",
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage:
            generatingError.message,
          errorCode:
            "EDIT_GENERATION_START_FAILED",
        });

        await logDesignFailure({
          userId: user.id,
          shopId: shop.id,
          productId:
            product.id,
          designId:
            design.id,
          errorMessage:
            generatingError.message,
          stage:
            "edit_set_generating",
          operation:
            "edit_design",
        });

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر بدء تعديل التصميم",
            pointsRefunded:
              !!refundResult?.refunded,
            refundTransactionId:
              refundResult?.refund_transaction_id ||
              null,
          },
          { status: 500 }
        );
      }

      // ===================================================
      // Generate edited image
      // ===================================================

      let generated;

      try {
        generated =
          await generateDesignImage({
            prompt,
            productImageUrl:
              product.image_url,
            format:
              format || "1:1",
            mode:
              mode || "simple",
            style:
              style ||
              "professional",
            background:
              background ||
              "clean",
          });
      } catch (generationError) {
        console.error(
          "Edit generation error:",
          generationError
        );

        const errorMessage =
          generationError?.message ||
          "فشل تعديل التصميم";

        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب فشل تعديل التصميم",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_generate_image",
              error:
                errorMessage,
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage,
          errorCode:
            "EDIT_IMAGE_GENERATION_FAILED",
        });

        await logDesignFailure({
          userId: user.id,
          shopId: shop.id,
          productId:
            product.id,
          designId:
            design.id,
          errorMessage,
          stage:
            "edit_generate_image",
          operation:
            "edit_design",
        });

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
          { status: 500 }
        );
      }

      // ===================================================
      // Validate result
      // ===================================================

      const generatedUrl =
        resolveGeneratedUrl(
          generated
        );

      if (!generatedUrl) {
        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب عدم وجود نتيجة لتعديل التصميم",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_validate_result",
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage:
            "لم يتم الحصول على نتيجة من محرك التصميم",
          errorCode:
            "EDIT_EMPTY_GENERATION_RESULT",
        });

        return NextResponse.json(
          {
            success: false,
            error:
              "لم يتم الحصول على نتيجة لتعديل التصميم",
            pointsRefunded:
              !!refundResult?.refunded,
            refundTransactionId:
              refundResult?.refund_transaction_id ||
              null,
          },
          { status: 500 }
        );
      }

      // ===================================================
      // Download
      // ===================================================

      let imageResponse;

      try {
        imageResponse =
          await fetch(
            generatedUrl
          );
      } catch (downloadError) {
        const errorMessage =
          downloadError?.message ||
          "تعذر تحميل الصورة المعدلة";

        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب فشل تحميل التصميم المعدل",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_download",
              error:
                errorMessage,
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage,
          errorCode:
            "EDIT_IMAGE_DOWNLOAD_FAILED",
        });

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
          { status: 500 }
        );
      }

      if (!imageResponse.ok) {
        const errorMessage =
          "تعذر تحميل الصورة المعدلة من محرك التصميم";

        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب فشل تحميل الصورة المعدلة",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_download_http",
              http_status:
                imageResponse.status,
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage,
          errorCode:
            "EDIT_IMAGE_DOWNLOAD_HTTP_FAILED",
        });

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
          { status: 500 }
        );
      }

      const imageBuffer =
        Buffer.from(
          await imageResponse.arrayBuffer()
        );

      // ===================================================
      // Storage
      // ===================================================

      const storagePath =
        `${shop.id}/${product.id}/${design.id}.png`;

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
              upsert: true,
            }
          );

      if (uploadError) {
        console.error(
          "Edit storage upload error:",
          uploadError
        );

        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب فشل حفظ التصميم المعدل",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_storage_upload",
              error:
                uploadError.message,
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage:
            uploadError.message,
          errorCode:
            "EDIT_STORAGE_UPLOAD_FAILED",
        });

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر حفظ التصميم المعدل",
            pointsRefunded:
              !!refundResult?.refunded,
            refundTransactionId:
              refundResult?.refund_transaction_id ||
              null,
          },
          { status: 500 }
        );
      }

      // ===================================================
      // Public URL
      // ===================================================

      const {
        data: {
          publicUrl,
        },
      } =
        supabaseAdmin.storage
          .from("ad-images")
          .getPublicUrl(
            storagePath
          );

      if (!publicUrl) {
        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب فشل إنشاء رابط التصميم المعدل",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_public_url",
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage:
            "تعذر إنشاء رابط التصميم المعدل",
          errorCode:
            "EDIT_PUBLIC_URL_FAILED",
        });

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر إنشاء رابط التصميم المعدل",
            pointsRefunded:
              !!refundResult?.refunded,
            refundTransactionId:
              refundResult?.refund_transaction_id ||
              null,
          },
          { status: 500 }
        );
      }

      // ===================================================
      // Save edited design
      // ===================================================

      const {
        data: updatedDesign,
        error: updateError,
      } =
        await supabaseAdmin
          .from("ad_images")
          .update({
            status:
              "completed",
            image_url:
              publicUrl,
            generated_at:
              new Date().toISOString(),
            completed_at:
              new Date().toISOString(),
            error_message:
              null,
            error_code:
              null,
          })
          .eq(
            "id",
            design.id
          )
          .eq(
            "shop_id",
            shop.id
          )
          .select("*")
          .single();

      if (updateError) {
        console.error(
          "Edit complete error:",
          updateError
        );

        const refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            "استرجاع نقطة بسبب فشل حفظ نتيجة تعديل التصميم",
            {
              design_id:
                design.id,
              product_id:
                product.id,
              stage:
                "edit_complete",
              error:
                updateError.message,
            }
          );

        await markDesignFailed({
          designId:
            design.id,
          errorMessage:
            updateError.message,
          errorCode:
            "EDIT_COMPLETE_FAILED",
        });

        await logDesignFailure({
          userId: user.id,
          shopId: shop.id,
          productId:
            product.id,
          designId:
            design.id,
          errorMessage:
            updateError.message,
          stage:
            "edit_complete",
          operation:
            "edit_design",
        });

        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر حفظ نتيجة تعديل التصميم",
            pointsRefunded:
              !!refundResult?.refunded,
            refundTransactionId:
              refundResult?.refund_transaction_id ||
              null,
          },
          { status: 500 }
        );
      }

      // ===================================================
      // Usage log
      // ===================================================

      try {
        await logAIUsage({
          userId:
            user.id,
          shopId:
            shop.id,
          productId:
            product.id,
          operation:
            "edit_design",
          model:
            generated?.model ||
            generated?.provider ||
            "design-engine",
          status:
            "completed",
          metadata: {
            design_id:
              design.id,
            template:
              template ||
              template_id ||
              null,
            mode:
              mode || "simple",
            style:
              style ||
              "professional",
            background:
              background ||
              "clean",
            format:
              format || "1:1",
            points_transaction_id:
              pointsTransactionId,
            points_charged:
              pointsResult.data
                ?.points_charged ||
              0,
          },
        });
      } catch (usageError) {
        console.error(
          "Edit usage logging error:",
          usageError
        );
      }

      // ===================================================
      // Activity
      // ===================================================

      try {
        await supabaseAdmin
          .from("activity_logs")
          .insert({
            user_id:
              user.id,
            shop_id:
              shop.id,
            action:
              "design_edited",
            entity_type:
              "ad_image",
            entity_id:
              design.id,
            description:
              "تم تعديل التصميم بنجاح",
            metadata: {
              product_id:
                product.id,
              design_id:
                design.id,
              points_charged:
                pointsResult.data
                  ?.points_charged ||
                0,
              points_transaction_id:
                pointsTransactionId,
            },
          });
      } catch (activityError) {
        console.error(
          "Edit activity log error:",
          activityError
        );
      }

      // ===================================================
      // Edit success
      // ===================================================

      return NextResponse.json({
        success: true,
        operation:
          "edit_design",
        design:
          updatedDesign,
        image_url:
          publicUrl,
        pointsCharged:
          pointsResult.data
            ?.points_charged ||
          0,
        pointsBalance:
          pointsResult.data
            ?.balance_after ??
          null,
        pointsTransactionId,
        pointsRefunded:
          false,
      });
    }

    // =====================================================
    // CREATE MODE
    // =====================================================

    // =====================================================
    // Load product
    // =====================================================

    const {
      data: productData,
      error: productError,
    } =
      await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", product_id)
        .maybeSingle();

    if (productError) {
      console.error(
        "Product load error:",
        productError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر قراءة بيانات المنتج",
        },
        { status: 500 }
      );
    }

    if (!productData) {
      return NextResponse.json(
        {
          success: false,
          error:
            "المنتج غير موجود",
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
          error:
            "المنتج غير مرتبط بمتجر",
        },
        { status: 400 }
      );
    }

    const {
      data: shopData,
      error: shopError,
    } =
      await supabaseAdmin
        .from("shops")
        .select("*")
        .eq("id", product.shop_id)
        .maybeSingle();

    if (shopError) {
      console.error(
        "Shop load error:",
        shopError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر قراءة بيانات المتجر",
        },
        { status: 500 }
      );
    }

    if (!shopData) {
      return NextResponse.json(
        {
          success: false,
          error:
            "المتجر غير موجود",
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
          error:
            "غير مصرح لك باستخدام هذا المنتج",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // Product safety
    // =====================================================

    const safetyValidation =
      await validateProduct({
        user,
        product,
      });

    if (!safetyValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          ...(safetyValidation.code
            ? {
                code:
                  safetyValidation.code,
              }
            : {}),
          error:
            safetyValidation.error,
        },
        {
          status:
            safetyValidation.status,
        }
      );
    }

    // =====================================================
    // Product image
    // =====================================================

    if (!product.image_url) {
      return NextResponse.json(
        {
          success: false,
          error:
            "المنتج لا يحتوي على صورة",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // Build prompt
    // =====================================================

    let prompt;

    try {
      prompt = createPrompt({
        product,
        shop,
        template:
          template ||
          template_id ||
          null,
        mode:
          mode || "simple",
        style:
          style ||
          "professional",
        background:
          background ||
          "clean",
        format:
          format || "1:1",
        title:
          title ||
          product.name,
        price:
          price ??
          product.price,
        discount:
          discount || null,
        cta:
          cta || null,
        customText:
          custom_text || null,
      });
    } catch (error) {
      console.error(
        "Prompt build error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر تجهيز طلب التصميم",
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Create design record
    // =====================================================

    const {
      data: createdDesign,
      error: designInsertError,
    } =
      await supabaseAdmin
        .from("ad_images")
        .insert({
          product_id:
            product.id,
          shop_id:
            shop.id,
          status:
            "pending",
          generation_started_at:
            null,
          generated_at:
            null,
          completed_at:
            null,
          error_message:
            null,
          error_code:
            null,
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
          error:
            "تعذر إنشاء سجل التصميم",
        },
        { status: 500 }
      );
    }

    design =
      createdDesign;

    // =====================================================
    // Charge create points
    // =====================================================

    const pointsResult =
      await chargeDesignPoints({
        supabaseAuth,
        user,
        shop,
        operationKey:
          "create_design",
        referenceType:
          "ad_image",
        referenceId:
          design.id,
        description:
          "إنشاء تصميم إعلاني",
        metadata: {
          product_id:
            product.id,
          design_id:
            design.id,
          mode:
            mode || "simple",
          format:
            format || "1:1",
        },
      });

    if (!pointsResult.success) {
      console.error(
        "Charge points error:",
        pointsResult.error
      );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage:
          pointsResult.error
            ?.message ||
          "تعذر خصم النقاط",
        errorCode:
          "POINTS_CHARGE_FAILED",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            pointsResult.error
              ?.message ||
            "رصيد النقاط غير كافٍ أو تعذر خصم النقاط.",
        },
        { status: 402 }
      );
    }

    pointsTransactionId =
      pointsResult.data
        ?.transaction_id ||
      null;

    // =====================================================
    // Start generation
    // =====================================================

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
          design.id
        );

    if (generatingError) {
      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب فشل بدء عملية التصميم",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "set_generating",
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage:
          generatingError.message,
        errorCode:
          "GENERATION_START_FAILED",
      });

      await logDesignFailure({
        userId:
          user.id,
        shopId:
          shop.id,
        productId:
          product.id,
        designId:
          design.id,
        errorMessage:
          generatingError.message,
        stage:
          "set_generating",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر بدء عملية التصميم",
          pointsRefunded:
            !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Generate image
    // =====================================================

    let generated;

    try {
      generated =
        await generateDesignImage({
          prompt,
          productImageUrl:
            product.image_url,
          format:
            format || "1:1",
          mode:
            mode || "simple",
          style:
            style ||
            "professional",
          background:
            background ||
            "clean",
        });
    } catch (generationError) {
      console.error(
        "Design generation error:",
        generationError
      );

      const errorMessage =
        generationError?.message ||
        "فشل إنشاء التصميم";

      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب فشل إنشاء التصميم",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "generate_image",
            error:
              errorMessage,
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage,
        errorCode:
          "IMAGE_GENERATION_FAILED",
      });

      await logDesignFailure({
        userId:
          user.id,
        shopId:
          shop.id,
        productId:
          product.id,
        designId:
          design.id,
        errorMessage,
        stage:
          "generate_image",
      });

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
        { status: 500 }
      );
    }

    // =====================================================
    // Resolve generated URL
    // =====================================================

    const generatedUrl =
      resolveGeneratedUrl(
        generated
      );

    if (!generatedUrl) {
      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب عدم وجود نتيجة للتصميم",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "resolve_generated_url",
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage:
          "محرك التصميم أعاد نتيجة بدون رابط صورة",
        errorCode:
          "MISSING_GENERATED_URL",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر الحصول على صورة التصميم",
          pointsRefunded:
            !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Download generated image
    // =====================================================

    let imageResponse;

    try {
      imageResponse =
        await fetch(
          generatedUrl
        );
    } catch (downloadError) {
      const errorMessage =
        downloadError?.message ||
        "تعذر تحميل صورة التصميم";

      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب فشل تحميل صورة التصميم",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "download_generated_image",
            error:
              errorMessage,
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage,
        errorCode:
          "IMAGE_DOWNLOAD_FAILED",
      });

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
        { status: 500 }
      );
    }

    if (!imageResponse.ok) {
      const errorMessage =
        "تعذر تحميل الصورة الناتجة من محرك التصميم";

      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب فشل تحميل الصورة الناتجة",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "download_generated_image",
            http_status:
              imageResponse.status,
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage,
        errorCode:
          "IMAGE_DOWNLOAD_HTTP_FAILED",
      });

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
        { status: 500 }
      );
    }

    const imageBuffer =
      Buffer.from(
        await imageResponse.arrayBuffer()
      );

    // =====================================================
    // Storage
    // =====================================================

    const storagePath =
      `${shop.id}/${product.id}/${design.id}.png`;

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
            upsert: true,
          }
        );

    if (uploadError) {
      console.error(
        "Design storage upload error:",
        uploadError
      );

      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب فشل حفظ صورة التصميم",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "storage_upload",
            error:
              uploadError.message,
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage:
          uploadError.message,
        errorCode:
          "STORAGE_UPLOAD_FAILED",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر حفظ صورة التصميم",
          pointsRefunded:
            !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Public URL
    // =====================================================

    const {
      data: {
        publicUrl,
      },
    } =
      supabaseAdmin.storage
        .from("ad-images")
        .getPublicUrl(
          storagePath
        );

    if (!publicUrl) {
      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب فشل إنشاء رابط التصميم",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "public_url",
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage:
          "تعذر إنشاء رابط صورة التصميم",
        errorCode:
          "PUBLIC_URL_FAILED",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر إنشاء رابط صورة التصميم",
          pointsRefunded:
            !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Complete
    // =====================================================

    const {
      data: completedDesign,
      error: completeError,
    } =
      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "completed",
          image_url:
            publicUrl,
          generated_at:
            new Date().toISOString(),
          completed_at:
            new Date().toISOString(),
          error_message:
            null,
          error_code:
            null,
        })
        .eq(
          "id",
          design.id
        )
        .select("*")
        .single();

    if (completeError) {
      const refundResult =
        await refundDesignPoints(
          supabaseAuth,
          pointsTransactionId,
          "استرجاع نقاط بسبب فشل حفظ نتيجة التصميم",
          {
            design_id:
              design.id,
            product_id:
              product.id,
            stage:
              "complete_design",
            error:
              completeError.message,
          }
        );

      await markDesignFailed({
        designId:
          design.id,
        errorMessage:
          completeError.message,
        errorCode:
          "DESIGN_COMPLETE_FAILED",
      });

      await logDesignFailure({
        userId:
          user.id,
        shopId:
          shop.id,
        productId:
          product.id,
        designId:
          design.id,
        errorMessage:
          completeError.message,
        stage:
          "complete_design",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر حفظ نتيجة التصميم",
          pointsRefunded:
            !!refundResult?.refunded,
          refundTransactionId:
            refundResult?.refund_transaction_id ||
            null,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // Usage log
    // =====================================================

    try {
      await logAIUsage({
        userId:
          user.id,
        shopId:
          shop.id,
        productId:
          product.id,
        operation:
          "create_design",
        model:
          generated?.model ||
          generated?.provider ||
          "design-engine",
        status:
          "completed",
        metadata: {
          design_id:
            design.id,
          template:
            template ||
            template_id ||
            null,
          mode:
            mode || "simple",
          style:
            style ||
            "professional",
          background:
            background ||
            "clean",
          format:
            format || "1:1",
          points_transaction_id:
            pointsTransactionId,
          points_charged:
            pointsResult.data
              ?.points_charged ||
            0,
        },
      });
    } catch (usageError) {
      console.error(
        "AI usage logging error:",
        usageError
      );
    }

    // =====================================================
    // Activity
    // =====================================================

    try {
      await supabaseAdmin
        .from("activity_logs")
        .insert({
          user_id:
            user.id,
          shop_id:
            shop.id,
          action:
            "design_generated",
          entity_type:
            "ad_image",
          entity_id:
            design.id,
          description:
            "تم إنشاء التصميم بنجاح",
          metadata: {
            product_id:
              product.id,
            design_id:
              design.id,
            points_charged:
              pointsResult.data
                ?.points_charged ||
              0,
            points_transaction_id:
              pointsTransactionId,
          },
        });
    } catch (activityError) {
      console.error(
        "Activity success log error:",
        activityError
      );
    }

    // =====================================================
    // Create success
    // =====================================================

    return NextResponse.json({
      success: true,
      operation:
        "create_design",
      design:
        completedDesign,
      image_url:
        publicUrl,
      pointsCharged:
        pointsResult.data
          ?.points_charged ||
        0,
      pointsBalance:
        pointsResult.data
          ?.balance_after ??
        null,
      pointsTransactionId,
      pointsRefunded:
        false,
    });
  } catch (error) {
    console.error(
      "Generate/edit design unexpected error:",
      error
    );

    // =====================================================
    // Unexpected refund
    // =====================================================

    let refundResult = null;

    if (
      user?.id &&
      pointsTransactionId
    ) {
      try {
        const supabaseAuth =
          await getAuthenticatedClient();

        refundResult =
          await refundDesignPoints(
            supabaseAuth,
            pointsTransactionId,
            operation ===
              "edit_design"
              ? "استرجاع نقطة بسبب خطأ غير متوقع أثناء تعديل التصميم"
              : "استرجاع نقاط بسبب خطأ غير متوقع أثناء إنشاء التصميم",
            {
              design_id:
                design?.id ||
                null,
              product_id:
                product?.id ||
                null,
              stage:
                "unexpected_error",
              operation,
              error:
                error?.message ||
                "Unexpected design error",
            }
          );
      } catch (refundError) {
        console.error(
          "Unexpected refund error:",
          refundError
        );
      }
    }

    // =====================================================
    // Mark failed
    // =====================================================

    if (design?.id) {
      await markDesignFailed({
        designId:
          design.id,
        errorMessage:
          error?.message ||
          "حدث خطأ غير متوقع",
        errorCode:
          "UNEXPECTED_ERROR",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "حدث خطأ غير متوقع أثناء عملية التصميم",
        pointsRefunded:
          !!refundResult?.refunded,
        refundTransactionId:
          refundResult?.refund_transaction_id ||
          null,
      },
      { status: 500 }
    );
  }
}
