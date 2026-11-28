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
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// =========================================================
// Constants
// =========================================================

const EDIT_OPERATION_KEY = "edit_design";

// =========================================================
// Helpers
// =========================================================

function isProductUnclear(product) {
  if (!product) {
    return true;
  }

  if (
    product.verification_status === "review" ||
    product.verification_status === "unverified"
  ) {
    return true;
  }

  const confidence = String(
    product.confidence || ""
  ).toLowerCase();

  if (
    confidence === "low" ||
    confidence === "medium" ||
    confidence === "منخفض" ||
    confidence === "متوسط"
  ) {
    return true;
  }

  if (
    product.name &&
    (
      !product.brand ||
      !product.category ||
      !product.description
    )
  ) {
    return true;
  }

  return false;
}

// =========================================================
// Refund
// =========================================================

async function refundPoints({
  supabaseAuth,
  transactionId,
  userId,
  shopId,
  productId,
  designId,
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
      data,
      error,
    } = await supabaseAuth.rpc(
      "refund_operation_points",
      {
        p_transaction_id:
          transactionId,

        p_reason:
          reason ||
          "استرجاع نقطة بسبب فشل تعديل التصميم.",

        p_metadata: {
          source:
            "edit-design",

          stage:
            stage || "unknown",

          user_id:
            userId,

          shop_id:
            shopId,

          product_id:
            productId,

          design_id:
            designId,

          error:
            errorMessage || null,
        },
      }
    );

    if (error) {
      console.error(
        "EDIT DESIGN REFUND ERROR:",
        error
      );

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
  } catch (error) {
    console.error(
      "EDIT DESIGN REFUND UNEXPECTED ERROR:",
      error
    );

    return {
      success: false,
      refunded: false,
      error:
        error?.message ||
        "تعذر استرجاع النقطة.",
    };
  }
}

// =========================================================
// Resolve transaction
// =========================================================

async function resolvePointsTransaction({
  userId,
  referenceType,
  referenceId,
}) {
  if (
    !userId ||
    !referenceType ||
    !referenceId
  ) {
    return null;
  }

  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("point_transactions")
      .select(
        `
        id,
        user_id,
        amount,
        type,
        reference_type,
        reference_id,
        provider
        `
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "reference_type",
        referenceType
      )
      .eq(
        "reference_id",
        referenceId
      )
      .eq(
        "type",
        "debit"
      )
      .eq(
        "provider",
        "suq_ai_points"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "RESOLVE EDIT DESIGN TRANSACTION ERROR:",
        error
      );

      return null;
    }

    return data || null;
  } catch (error) {
    console.error(
      "RESOLVE EDIT DESIGN TRANSACTION UNEXPECTED ERROR:",
      error
    );

    return null;
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(request) {
  let userId = null;
  let shopId = null;
  let productId = null;
  let designId = null;

  let supabaseAuth = null;

  let pointsTransactionId = null;
  let pointsCharged = 0;
  let balanceAfter = null;

  let operationReferenceId = null;

  try {
    // =====================================================
    // 1. Authentication
    // =====================================================

    const cookieStore =
      await cookies();

    supabaseAuth =
      createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
    // 2. Request
    // =====================================================

    const body =
      await request.json();

    designId =
      body?.designId ||
      body?.id ||
      null;

    if (!designId) {
      return NextResponse.json(
        {
          error:
            "معرف التصميم غير موجود.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // 3. Load design
    // =====================================================

    const {
      data: design,
      error: designError,
    } =
      await supabaseAdmin
        .from("ad_images")
        .select("*")
        .eq(
          "id",
          designId
        )
        .maybeSingle();

    if (designError) {
      console.error(
        "DESIGN LOAD ERROR:",
        designError
      );

      return NextResponse.json(
        {
          error:
            "تعذر قراءة التصميم.",
        },
        {
          status: 500,
        }
      );
    }

    if (!design) {
      return NextResponse.json(
        {
          error:
            "التصميم غير موجود.",
        },
        {
          status: 404,
        }
      );
    }

    shopId =
      design.shop_id ||
      null;

    productId =
      design.product_id ||
      null;

    // =====================================================
    // 4. Validate shop
    // =====================================================

    if (!shopId) {
      return NextResponse.json(
        {
          error:
            "التصميم غير مرتبط بمحل.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: shop,
      error: shopError,
    } =
      await supabaseAdmin
        .from("shops")
        .select(
          `
          id,
          owner_id
          `
        )
        .eq(
          "id",
          shopId
        )
        .maybeSingle();

    if (shopError) {
      console.error(
        "SHOP LOAD ERROR:",
        shopError
      );

      return NextResponse.json(
        {
          error:
            "تعذر التحقق من المحل.",
        },
        {
          status: 500,
        }
      );
    }

    if (!shop) {
      return NextResponse.json(
        {
          error:
            "المحل غير موجود.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // 5. Ownership
    // =====================================================

    if (
      shop.owner_id !==
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "ليس لديك صلاحية تعديل هذا التصميم.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 6. Product
    // =====================================================

    if (!productId) {
      return NextResponse.json(
        {
          error:
            "التصميم غير مرتبط بمنتج.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: product,
      error: productError,
    } =
      await supabaseAdmin
        .from("products")
        .select("*")
        .eq(
          "id",
          productId
        )
        .eq(
          "shop_id",
          shopId
        )
        .maybeSingle();

    if (productError) {
      console.error(
        "PRODUCT LOAD ERROR:",
        productError
      );

      return NextResponse.json(
        {
          error:
            "تعذر قراءة بيانات المنتج.",
        },
        {
          status: 500,
        }
      );
    }

    if (!product) {
      return NextResponse.json(
        {
          error:
            "المنتج غير موجود أو غير تابع لمحل المستخدم.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // 7. Product safety
    // =====================================================

    if (
      product.safety_status ===
        "locked" ||
      product.safety_status ===
        "violation" ||
      product.verification_status ===
        "locked"
    ) {
      return NextResponse.json(
        {
          error:
            "لا يمكن تعديل تصميم هذا المنتج لأنه مقفل للمراجعة.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 8. Responsibility
    // =====================================================

    const unclear =
      isProductUnclear(
        product
      );

    if (unclear) {
      const {
        data: acceptance,
        error: acceptanceError,
      } =
        await supabaseAdmin
          .from(
            "product_responsibility_acceptances"
          )
          .select(
            `
            id,
            user_id,
            shop_id,
            product_id,
            policy_version,
            accepted_at
            `
          )
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "shop_id",
            shopId
          )
          .eq(
            "product_id",
            product.id
          )
          .maybeSingle();

      if (acceptanceError) {
        console.error(
          "RESPONSIBILITY CHECK ERROR:",
          acceptanceError
        );

        return NextResponse.json(
          {
            error:
              "تعذر التحقق من موافقة مسؤولية المنتج.",
          },
          {
            status: 500,
          }
        );
      }

      if (!acceptance) {
        return NextResponse.json(
          {
            error:
              "هذا المنتج يحتاج إلى تأكيد مسؤولية التاجر قبل تعديل التصميم.",

            code:
              "RESPONSIBILITY_REQUIRED",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // 9. Image
    // =====================================================

    if (
      !product.image_url
    ) {
      return NextResponse.json(
        {
          error:
            "المنتج لا يحتوي على صورة يمكن استخدامها في التصميم.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // 10. Settings
    // =====================================================

    const incomingSettings =
      body?.settings ||
      body?.designSettings ||
      {};

    const existingSettings =
      design.design_settings ||
      {};

    const designSettings = {
      ...existingSettings,
      ...incomingSettings,
    };

    // =====================================================
    // 11. Build prompt
    // =====================================================

    const prompt =
      buildDesignPrompt({
        product,
        settings:
          designSettings,
        mode:
          body?.mode ||
          design.mode ||
          "simple",
        template:
          body?.template ||
          design.template ||
          null,
        style:
          body?.style ||
          design.style ||
          null,
        background:
          body?.background ||
          design.background ||
          null,
        format:
          body?.format ||
          design.format ||
          "1:1",
        title:
          body?.title ??
          design.title ??
          null,
        price:
          body?.price ??
          design.price ??
          null,
        discount:
          body?.discount ??
          design.discount ??
          null,
        callToAction:
          body?.callToAction ??
          design.call_to_action ??
          null,
        customText:
          body?.customText ??
          null,
      });

    // =====================================================
    // 12. New operation reference
    // =====================================================

    operationReferenceId =
      crypto.randomUUID();

    // =====================================================
    // 13. Charge 1 point
    // =====================================================

    const {
      data: pointsResult,
      error: pointsError,
    } =
      await supabaseAuth.rpc(
        "charge_operation_points",
        {
          p_operation_key:
            EDIT_OPERATION_KEY,

          p_user_id:
            user.id,

          p_shop_id:
            shopId,

          p_reference_type:
            "design_edit",

          p_reference_id:
            operationReferenceId,

          p_description:
            `تعديل التصميم: ${
              product.name ||
              "منتج"
            }`,

          p_metadata: {
            source:
              "edit-design",

            design_id:
              designId,

            product_id:
              productId,

            product_name:
              product.name ||
              null,
          },
        }
      );

    if (pointsError) {
      console.error(
        "EDIT DESIGN POINTS CHARGE ERROR:",
        pointsError
      );

      const message =
        pointsError?.message ||
        "تعذر خصم نقطة تعديل التصميم.";

      const insufficient =
        message.includes(
          "غير كاف"
        ) ||
        message.includes(
          "رصيد"
        ) ||
        message.includes(
          "تحتاج"
        );

      return NextResponse.json(
        {
          error:
            insufficient
              ? message
              : "تعذر تجهيز رصيد النقاط لتعديل التصميم.",

          code:
            insufficient
              ? "INSUFFICIENT_POINTS"
              : "POINTS_CHARGE_FAILED",
        },
        {
          status:
            insufficient
              ? 402
              : 500,
        }
      );
    }

    // =====================================================
    // 14. Validate points response
    // =====================================================

    if (
      !pointsResult ||
      pointsResult.success !== true
    ) {
      console.error(
        "EDIT DESIGN INVALID POINTS RESULT:",
        pointsResult
      );

      const recovered =
        await resolvePointsTransaction({
          userId:
            user.id,

          referenceType:
            "design_edit",

          referenceId:
            operationReferenceId,
        });

      if (recovered?.id) {
        pointsTransactionId =
          recovered.id;

        pointsCharged =
          Number(
            recovered.amount ||
              0
          );

        const refundResult =
          await refundPoints({
            supabaseAuth,
            transactionId:
              pointsTransactionId,
            userId,
            shopId,
            productId,
            designId,
            reason:
              "استرجاع نقطة بسبب نتيجة غير صالحة من عملية خصم تعديل التصميم.",
            stage:
              "invalid_charge_result",
            errorMessage:
              "Invalid charge result after debit was detected.",
          });

        return NextResponse.json(
          {
            error:
              "تعذر تأكيد عملية النقاط وتمت محاولة استرجاع النقطة.",

            code:
              "POINTS_CHARGE_INVALID_RESULT",

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

      return NextResponse.json(
        {
          error:
            "تعذر تأكيد خصم نقطة تعديل التصميم.",

          code:
            "POINTS_CHARGE_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // 15. Resolve transaction ID
    // =====================================================

    pointsTransactionId =
      pointsResult.transaction_id ||
      null;

    if (
      !pointsTransactionId
    ) {
      const recovered =
        await resolvePointsTransaction({
          userId:
            user.id,

          referenceType:
            "design_edit",

          referenceId:
            operationReferenceId,
        });

      if (recovered?.id) {
        pointsTransactionId =
          recovered.id;

        pointsCharged =
          Number(
            recovered.amount ||
              0
          );
      }
    }

    if (
      !pointsTransactionId
    ) {
      console.error(
        "EDIT DESIGN TRANSACTION ID MISSING:",
        {
          pointsResult,
          operationReferenceId,
          userId,
          shopId,
          productId,
          designId,
        }
      );

      return NextResponse.json(
        {
          error:
            "تعذر تأكيد مرجع النقاط، لذلك لم يتم تشغيل تعديل التصميم.",

          code:
            "POINTS_TRANSACTION_REFERENCE_MISSING",
        },
        {
          status: 500,
        }
      );
    }

    pointsCharged =
      Number(
        pointsResult.points_charged ??
          pointsCharged ??
          0
      );

    balanceAfter =
      Number(
        pointsResult.balance_after ??
          0
      );

    // =====================================================
    // 16. Set generating
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

          design_settings:
            designSettings,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

    if (generatingError) {
      console.error(
        "SET GENERATING ERROR:",
        generatingError
      );

      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب تعذر تجهيز التصميم للتعديل.",
          stage:
            "set_generating",
          errorMessage:
            generatingError.message,
        });

      return NextResponse.json(
        {
          error:
            "تعذر تجهيز التصميم للتعديل.",

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
    // 17. Generate
    // =====================================================

    let generated;

    try {
      generated =
        await generateDesignImage({
          prompt,

          productImageUrl:
            product.image_url,

          product,

          settings:
            designSettings,

          mode:
            body?.mode ||
            design.mode ||
            "simple",

          template:
            body?.template ||
            design.template ||
            null,

          style:
            body?.style ||
            design.style ||
            null,

          background:
            body?.background ||
            design.background ||
            null,

          format:
            body?.format ||
            design.format ||
            "1:1",
        });
    } catch (generationError) {
      console.error(
        "EDIT DESIGN GENERATION ERROR:",
        generationError
      );

      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب فشل إنشاء التصميم.",
          stage:
            "generation",
          errorMessage:
            generationError?.message ||
            "Design generation failed",
        });

      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "failed",

          error_message:
            generationError?.message ||
            "فشل إنشاء التصميم.",

          error_code:
            "GENERATION_FAILED",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

      try {
        await logAIUsage({
          userId,
          shopId,
          productId,

          operation:
            "design_edit",

          status:
            "failed",

          metadata: {
            source:
              "edit-design",

            design_id:
              designId,

            stage:
              "generation",

            points_transaction_id:
              pointsTransactionId,

            points_charged:
              pointsCharged,

            points_refunded:
              !!refundResult?.refunded,

            refund_transaction_id:
              refundResult?.refund_transaction_id ||
              null,

            operation_reference_id:
              operationReferenceId,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOG ERROR:",
          usageError
        );
      }

      return NextResponse.json(
        {
          error:
            "فشل إنشاء التصميم.",

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
    // 18. Resolve generated image
    // =====================================================

    const generatedImageUrl =
      generated?.image_url ||
      generated?.url ||
      generated?.imageUrl ||
      null;

    if (!generatedImageUrl) {
      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب عدم الحصول على صورة التصميم.",
          stage:
            "missing_generated_url",
          errorMessage:
            "Generated image URL is missing",
        });

      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "failed",

          error_message:
            "لم يتم الحصول على رابط صورة التصميم.",

          error_code:
            "MISSING_IMAGE_URL",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

      return NextResponse.json(
        {
          error:
            "لم يتم الحصول على صورة التصميم.",

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
    // 19. Download generated image
    // =====================================================

    let imageResponse;

    try {
      imageResponse =
        await fetch(
          generatedImageUrl
        );
    } catch (downloadError) {
      console.error(
        "IMAGE DOWNLOAD ERROR:",
        downloadError
      );

      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب تعذر تحميل صورة التصميم.",
          stage:
            "image_download",
          errorMessage:
            downloadError?.message ||
            "Image download failed",
        });

      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "failed",

          error_message:
            downloadError?.message ||
            "تعذر تحميل صورة التصميم.",

          error_code:
            "IMAGE_DOWNLOAD_FAILED",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

      return NextResponse.json(
        {
          error:
            "تعذر تحميل صورة التصميم.",

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

    if (
      !imageResponse.ok
    ) {
      const errorMessage =
        `Image download failed with status ${imageResponse.status}`;

      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب فشل تحميل صورة التصميم.",
          stage:
            "image_download_http",
          errorMessage,
        });

      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "failed",

          error_message:
            errorMessage,

          error_code:
            "IMAGE_DOWNLOAD_HTTP_FAILED",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

      return NextResponse.json(
        {
          error:
            "فشل تحميل صورة التصميم.",

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

    const imageBuffer =
      Buffer.from(
        await imageResponse.arrayBuffer()
      );

    // =====================================================
    // 20. Upload
    // =====================================================

    const storagePath =
      `${shopId}/${productId}/${designId}-${Date.now()}.png`;

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
              true,
          }
        );

    if (uploadError) {
      console.error(
        "IMAGE STORAGE UPLOAD ERROR:",
        uploadError
      );

      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب فشل حفظ التصميم.",
          stage:
            "storage_upload",
          errorMessage:
            uploadError.message,
        });

      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "failed",

          error_message:
            uploadError.message,

          error_code:
            "STORAGE_UPLOAD_FAILED",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

      return NextResponse.json(
        {
          error:
            "تعذر حفظ التصميم.",

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
    // 21. Public URL
    // =====================================================

    const {
      data: publicUrlData,
    } =
      supabaseAdmin.storage
        .from("ad-images")
        .getPublicUrl(
          storagePath
        );

    const publicUrl =
      publicUrlData?.publicUrl ||
      null;

    if (!publicUrl) {
      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب تعذر إنشاء رابط التصميم.",
          stage:
            "public_url",
          errorMessage:
            "Public image URL missing",
        });

      await supabaseAdmin
        .from("ad_images")
        .update({
          status:
            "failed",

          error_message:
            "تعذر إنشاء رابط صورة التصميم.",

          error_code:
            "PUBLIC_URL_FAILED",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          designId
        );

      return NextResponse.json(
        {
          error:
            "تعذر إنشاء رابط التصميم.",

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
    // 22. Complete design
    // =====================================================

    const {
      error: completeError,
    } =
      await supabaseAdmin
        .from("ad_images")
        .update({
          image_url:
            publicUrl,

          status:
            "completed",

          generated_at:
            new Date().toISOString(),

          completed_at:
            new Date().toISOString(),

          generation_started_at:
            design.generation_started_at ||
            new Date().toISOString(),

          design_settings:
            designSettings,

          updated_at:
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

    if (completeError) {
      console.error(
        "COMPLETE DESIGN ERROR:",
        completeError
      );

      const refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب فشل حفظ نتيجة تعديل التصميم.",
          stage:
            "complete_design",
          errorMessage:
            completeError.message,
        });

      return NextResponse.json(
        {
          error:
            "تم إنشاء التصميم لكن تعذر حفظ النتيجة.",

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
    // 23. Usage log
    // =====================================================

    try {
      await logAIUsage({
        userId,
        shopId,
        productId,

        operation:
          "design_edit",

        status:
          "success",

        metadata: {
          source:
            "edit-design",

          design_id:
            designId,

          points_operation:
            EDIT_OPERATION_KEY,

          points_charged:
            pointsCharged,

          points_balance_after:
            balanceAfter,

          points_transaction_id:
            pointsTransactionId,

          operation_reference_id:
            operationReferenceId,
        },
      });
    } catch (usageError) {
      console.error(
        "AI USAGE LOG ERROR:",
        usageError
      );
    }

    // =====================================================
    // 24. Activity log
    // =====================================================

    try {
      await supabaseAdmin
        .from("activity_logs")
        .insert({
          user_id:
            user.id,

          shop_id:
            shopId,

          action:
            "edit_design",

          entity_type:
            "ad_image",

          entity_id:
            designId,

          description:
            `تم تعديل تصميم المنتج: ${
              product.name ||
              "منتج"
            }`,

          metadata: {
            product_id:
              productId,

            points_charged:
              pointsCharged,

            points_transaction_id:
              pointsTransactionId,

            operation_reference_id:
              operationReferenceId,
          },
        });
    } catch (activityError) {
      console.error(
        "ACTIVITY LOG ERROR:",
        activityError
      );
    }

    // =====================================================
    // 25. Success
    // =====================================================

    return NextResponse.json({
      success:
        true,

      image_url:
        publicUrl,

      design_id:
        designId,

      points: {
        charged:
          pointsCharged,

        balance_after:
          balanceAfter,

        operation:
          EDIT_OPERATION_KEY,

        transaction_id:
          pointsTransactionId,
      },
    });

  } catch (error) {
    console.error(
      "EDIT DESIGN UNEXPECTED ERROR:",
      error
    );

    let refundResult =
      null;

    if (
      supabaseAuth &&
      pointsTransactionId
    ) {
      refundResult =
        await refundPoints({
          supabaseAuth,
          transactionId:
            pointsTransactionId,
          userId,
          shopId,
          productId,
          designId,
          reason:
            "استرجاع نقطة بسبب خطأ غير متوقع أثناء تعديل التصميم.",
          stage:
            "unexpected_error",
          errorMessage:
            error?.message ||
            "Unexpected edit design error",
        });
    }

    try {
      await logAIUsage({
        userId,
        shopId,
        productId,

        operation:
          "design_edit",

        status:
          "failed",

        metadata: {
          source:
            "edit-design",

          design_id:
            designId,

          stage:
            "unexpected_error",

          error:
            error?.message ||
            "unknown_error",

          points_transaction_id:
            pointsTransactionId,

          points_charged:
            pointsCharged,

          points_refunded:
            !!refundResult?.refunded,

          refund_transaction_id:
            refundResult?.refund_transaction_id ||
            null,

          operation_reference_id:
            operationReferenceId,
        },
      });
    } catch (usageError) {
      console.error(
        "AI USAGE LOG ERROR:",
        usageError
      );
    }

    return NextResponse.json(
      {
        error:
          "حدث خطأ أثناء تعديل التصميم.",

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
