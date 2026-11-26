import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { logAIUsage } from "../../../lib/ai-usage";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function getAuthenticatedUser(request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return null;
  }

  const supabase = createServiceClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

function isLocked(product) {
  return (
    product?.verification_status === "locked" ||
    product?.safety_status === "locked" ||
    product?.safety_status === "violation" ||
    product?.safety_level === "critical"
  );
}

function isUnclear(product) {
  if (!product) return true;

  if (isLocked(product)) return false;

  return (
    product.verification_status === "review" ||
    product.verification_status === "unverified" ||
    product.ai_status === "pending" ||
    product.confidence === "low" ||
    product.confidence === "medium" ||
    !product.brand ||
    !product.category ||
    !product.description
  );
}

export async function POST(request) {
  let body = null;

  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        {
          error: "غير مصرح. يجب تسجيل الدخول أولاً.",
        },
        { status: 401 }
      );
    }

    body = await request.json();

    const {
      productId,
      mode = "simple",
      template = null,
      style = null,
      background = null,
      format = "1:1",
      description = "",
    } = body || {};

    if (!productId) {
      return NextResponse.json(
        {
          error: "معرّف المنتج مطلوب.",
        },
        { status: 400 }
      );
    }

    if (!["simple", "professional"].includes(mode)) {
      return NextResponse.json(
        {
          error: "نوع التصميم غير صحيح.",
        },
        { status: 400 }
      );
    }

    const allowedFormats = ["1:1", "4:5", "9:16", "16:9"];

    if (!allowedFormats.includes(format)) {
      return NextResponse.json(
        {
          error: "مقاس التصميم غير مدعوم.",
        },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    /*
     * 1. تحميل المنتج
     */
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      console.error("Product lookup error:", productError);

      return NextResponse.json(
        {
          error: "تعذر تحميل المنتج.",
        },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        {
          error: "المنتج غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * 2. تحميل المحل
     */
    if (!product.shop_id) {
      return NextResponse.json(
        {
          error: "المنتج غير مرتبط بمحل.",
        },
        { status: 400 }
      );
    }

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("*")
      .eq("id", product.shop_id)
      .maybeSingle();

    if (shopError) {
      console.error("Shop lookup error:", shopError);

      return NextResponse.json(
        {
          error: "تعذر تحميل بيانات المحل.",
        },
        { status: 500 }
      );
    }

    if (!shop) {
      return NextResponse.json(
        {
          error: "المحل غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * 3. التأكد أن المنتج تابع للمستخدم
     */
    if (shop.owner_id !== user.id) {
      return NextResponse.json(
        {
          error: "لا يمكنك إنشاء تصميم لمنتج لا يخص حسابك.",
        },
        { status: 403 }
      );
    }

    /*
     * 4. المنتجات المقفلة ممنوعة تماماً
     */
    if (isLocked(product)) {
      return NextResponse.json(
        {
          error:
            "هذا المنتج مقفل ولا يمكن استخدامه في التصميم حتى تتم مراجعته.",
        },
        { status: 403 }
      );
    }

    /*
     * 5. المنتج غير الواضح يحتاج تأكيد المسؤولية
     */
    if (isUnclear(product)) {
      const { data: acceptance, error: acceptanceError } =
        await supabase
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
            error: "تعذر التحقق من مسؤولية المنتج.",
          },
          { status: 500 }
        );
      }

      if (!acceptance) {
        return NextResponse.json(
          {
            error:
              "يجب تأكيد مسؤولية المنتج قبل إنشاء التصميم.",
            requiresResponsibility: true,
          },
          { status: 403 }
        );
      }
    }

    /*
     * 6. يجب وجود صورة أصلية
     */
    if (!product.image_url) {
      return NextResponse.json(
        {
          error:
            "لا يمكن إنشاء تصميم بدون صورة أصلية للمنتج.",
        },
        { status: 400 }
      );
    }

    /*
     * مهم:
     * هذه المرحلة تجهز الطلب فقط.
     *
     * لا يوجد استدعاء OpenAI هنا حالياً.
     * الهدف هو تثبيت التحقق والأمان قبل استهلاك الرصيد.
     */

    const designPrompt = {
      type: "product_ad_design",

      mode,

      template:
        mode === "simple"
          ? template
          : null,

      style:
        mode === "professional"
          ? style
          : null,

      background:
        mode === "professional"
          ? background
          : null,

      format,

      description:
        typeof description === "string"
          ? description.trim()
          : "",

      shop: {
        id: shop.id,
        name: shop.name || "",
        logo_url: shop.logo_url || "",
        phone: shop.phone || "",
        whatsapp: shop.whatsapp || "",
        instagram: shop.instagram || "",
        tiktok: shop.tiktok || "",
        snapchat: shop.snapchat || "",
        website: shop.website || "",
      },

      product: {
        id: product.id,
        name: product.name || "",
        brand: product.brand || "",
        category: product.category || "",
        price: product.price ?? null,
        currency: product.currency || "AED",
        image_url: product.image_url,
        description: product.description || "",
        features: product.features || "",
        specifications: product.specifications || "",
      },

      rules: {
        preserve_original_product_image: true,
        do_not_change_product_identity: true,
        do_not_invent_product_information: true,
        use_shop_identity: true,
        advertising_first: true,
      },
    };

    /*
     * 7. حفظ الطلب
     */
    const { data: design, error: designError } = await supabase
      .from("ad_images")
      .insert({
        product_id: product.id,
        shop_id: shop.id,
        image_url: null,
        format,
        prompt: JSON.stringify(designPrompt),
        status: "pending",
      })
      .select()
      .single();

    if (designError) {
      console.error("Design creation error:", designError);

      return NextResponse.json(
        {
          error: "تعذر حفظ طلب التصميم.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      designId: design.id,
      status: "pending",
      message:
        "تم تجهيز طلب التصميم بنجاح.",
    });
  } catch (error) {
    console.error("Generate design route error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "حدث خطأ غير متوقع أثناء تجهيز التصميم.",
      },
      { status: 500 }
    );
  }
}
