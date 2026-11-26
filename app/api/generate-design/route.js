import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDesignPrompt } from "../../../lib/design-generator";
import { generateDesignImage } from "../../../lib/image-generator";
import { logAIUsage } from "../../../lib/ai-usage";

export const runtime = "nodejs";

const supabase = createClient(
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
    await supabase
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
      "Failed to update design error:",
      error
    );
  }
}

export async function POST(request) {
  let designId = null;

  try {
    /*
     * 1. التحقق من الجلسة
     */

    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "غير مصرح.",
        },
        { status: 401 }
      );
    }

    const token = authHeader
      .replace("Bearer ", "")
      .trim();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "رمز الجلسة مفقود.",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error(
        "AUTH ERROR:",
        userError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "الجلسة غير صالحة. سجل الدخول مرة أخرى.",
        },
        { status: 401 }
      );
    }

    /*
     * 2. قراءة الطلب
     */

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "بيانات الطلب غير صحيحة.",
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

    /*
     * 3. التحقق من البيانات
     */

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "معرّف المنتج مطلوب.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_MODES.includes(mode)) {
      return NextResponse.json(
        {
          success: false,
          error: "نوع التصميم غير صحيح.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_FORMATS.includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: "مقاس التصميم غير صحيح.",
        },
        { status: 400 }
      );
    }

    /*
     * 4. جلب المنتج
     */

    const {
      data: product,
      error: productError,
    } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) {
      console.error(
        "PRODUCT FETCH ERROR:",
        productError
      );

      return NextResponse.json(
        {
          success: false,
          error: "المنتج غير موجود.",
          debug: {
            productId,
            error:
              productError?.message || null,
          },
        },
        { status: 404 }
      );
    }

    /*
     * 5. التأكد من وجود shop_id
     */

    if (!product.shop_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "هذا المنتج غير مرتبط بمحل.",
          debug: {
            productId: product.id,
            productName: product.name,
            shopId: null,
            currentUserId: user.id,
          },
        },
        { status: 400 }
      );
    }

    /*
     * 6. جلب المحل
     *
     * مهم:
     * نربط المحل بالمستخدم الحالي مباشرة.
     */

    const {
      data: shop,
      error: shopError,
    } = await supabase
      .from("shops")
      .select("*")
      .eq("id", product.shop_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (shopError) {
      console.error(
        "SHOP QUERY ERROR:",
        {
          message: shopError.message,
          details: shopError.details,
          hint: shopError.hint,
          code: shopError.code,
          productShopId: product.shop_id,
          currentUserId: user.id,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر الوصول إلى بيانات المحل.",
          debug: {
            productId: product.id,
            productShopId: product.shop_id,
            currentUserId: user.id,
            shopQueryError:
              shopError.message || null,
            shopQueryCode:
              shopError.code || null,
            shopQueryDetails:
              shopError.details || null,
            shopQueryHint:
              shopError.hint || null,
          },
        },
        { status: 500 }
      );
    }

    if (!shop) {
      console.error(
        "SHOP NOT FOUND FOR PRODUCT:",
        {
          productId: product.id,
          productName: product.name,
          productShopId: product.shop_id,
          currentUserId: user.id,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: "المحل غير موجود.",
          debug: {
            productId: product.id,
            productName: product.name,
            productShopId: product.shop_id,
            currentUserId: user.id,
            reason:
              "لم يتم العثور على محل يطابق shop_id و owner_id معاً.",
          },
        },
        { status: 404 }
      );
    }

    /*
     * 7. التحقق النهائي من ملكية المحل
     */

    if (shop.owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "غير مصرح لك باستخدام هذا المنتج.",
          debug: {
            shopId: shop.id,
            shopOwnerId: shop.owner_id,
            currentUserId: user.id,
          },
        },
        { status: 403 }
      );
    }

    /*
     * 8. فحص المنتج المقفل
     */

    const isLocked =
      product.verification_status === "locked" ||
      product.safety_status === "locked" ||
      product.safety_status === "violation" ||
      product.safety_level === "critical";

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

    /*
     * 9. فحص وضوح المنتج
     *
     * عدم وضوح المنتج ليس مخالفة.
     */

    const isUnclear =
      product.verification_status === "review" ||
      product.verification_status === "unverified" ||
      product.ai_status === "pending" ||
      product.confidence === "low" ||
      product.confidence === "medium" ||
      !product.brand ||
      !product.category ||
      !product.description;

    if (isUnclear) {
      const {
        data: acceptance,
        error: acceptanceError,
      } = await supabase
        .from(
          "product_responsibility_acceptances"
        )
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
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
            requiresResponsibility: true,
          },
          { status: 400 }
        );
      }
    }

    /*
     * 10. التحقق من الصورة
     */

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

    /*
     * 11. بناء Prompt التصميم
     */

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

    /*
     * 12. إنشاء سجل التصميم
     */

    const {
      data: design,
      error: insertError,
    } = await supabase
      .from("ad_images")
      .insert({
        product_id: product.id,
        shop_id: shop.id,
        image_url: null,
        format,
        prompt: designPrompt,
        status: "pending",
        generated_at: null,
        completed_at: null,
        error_message: null,
        error_code: null,
        generation_started_at: null,
      })
      .select(
        "id, status, created_at"
      )
      .single();

    if (insertError || !design) {
      console.error(
        "CREATE DESIGN ERROR:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "تعذر إنشاء طلب التصميم.",
          details:
            insertError?.message || null,
        },
        { status: 500 }
      );
    }

    designId = design.id;

    /*
     * 13. حالة التوليد
     */

    const {
      error: generatingError,
    } = await supabase
      .from("ad_images")
      .update({
        status: "generating",
        generation_started_at:
          new Date().toISOString(),
        error_message: null,
        error_code: null,
      })
      .eq("id", designId);

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
          details:
            generatingError.message,
        },
        { status: 500 }
      );
    }

    /*
     * 14. توليد الصورة
     *
     * هنا فقط يتم استدعاء OpenAI.
     */

    try {
      const generated =
        await generateDesignImage({
          productImageUrl:
            product.image_url,
          prompt: designPrompt,
          format,
        });

      if (!generated?.b64_json) {
        throw new Error(
          "لم يتم استلام الصورة الناتجة من محرك الصور."
        );
      }

      /*
       * 15. تحويل Base64
       */

      const imageBuffer = Buffer.from(
        generated.b64_json,
        "base64"
      );

      if (!imageBuffer.length) {
        throw new Error(
          "بيانات الصورة الناتجة فارغة."
        );
      }

      /*
       * 16. حفظ الصورة
       */

      const storagePath =
        `${shop.id}/${product.id}/${designId}.png`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("ad-images")
        .upload(
          storagePath,
          imageBuffer,
          {
            contentType: "image/png",
            upsert: false,
          }
        );

      if (uploadError) {
        throw new Error(
          `تعذر حفظ الصورة في التخزين: ${uploadError.message}`
        );
      }

      /*
       * 17. رابط الصورة
       */

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("ad-images")
        .getPublicUrl(storagePath);

      const imageUrl =
        publicUrlData?.publicUrl;

      if (!imageUrl) {
        throw new Error(
          "تعذر الحصول على رابط الصورة الناتجة."
        );
      }

      /*
       * 18. إكمال التصميم
       */

      const completedAt =
        new Date().toISOString();

      const {
        error: updateError,
      } = await supabase
        .from("ad_images")
        .update({
          image_url: imageUrl,
          status: "completed",
          generated_at: completedAt,
          completed_at: completedAt,
          error_message: null,
          error_code: null,
        })
        .eq("id", designId);

      if (updateError) {
        throw new Error(
          `تعذر تحديث سجل التصميم: ${updateError.message}`
        );
      }

      /*
       * 19. تسجيل استخدام AI
       */

      try {
        await logAIUsage({
          userId: user.id,
          shopId: shop.id,
          productId: product.id,
          operation:
            "design_generation",
          model:
            generated.model ||
            "gpt-image-2",
          status: "success",
          estimatedCost: 0,
          metadata: {
            design_id: designId,
            format,
            mode,
            template:
              template || null,
            style:
              style || null,
            background:
              background || null,
          },
        });
      } catch (usageError) {
        console.error(
          "AI USAGE LOGGING ERROR:",
          usageError
        );
      }

      /*
       * 20. النجاح
       */

      return NextResponse.json({
        success: true,
        designId,
        status: "completed",
        imageUrl,
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
          userId: user.id,
          shopId: shop.id,
          productId: product.id,
          operation:
            "design_generation",
          model: "gpt-image-2",
          status: "failed",
          estimatedCost: 0,
          metadata: {
            design_id: designId,
            error: errorMessage,
            format,
            mode,
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
          status: "failed",
          error: errorMessage,
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
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
