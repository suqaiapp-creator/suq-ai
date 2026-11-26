import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDesignPrompt } from "../../../lib/design-generator";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "غير مصرح" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "الجلسة غير صالحة" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      productId,
      mode,
      template,
      style,
      background,
      format,
      description,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "معرّف المنتج مطلوب" },
        { status: 400 }
      );
    }

    if (!["simple", "professional"].includes(mode)) {
      return NextResponse.json(
        { error: "نوع التصميم غير صحيح" },
        { status: 400 }
      );
    }

    const allowedFormats = [
      "1:1",
      "4:5",
      "9:16",
      "16:9",
    ];

    if (!allowedFormats.includes(format)) {
      return NextResponse.json(
        { error: "مقاس التصميم غير صحيح" },
        { status: 400 }
      );
    }

    const { data: product, error: productError } =
      await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const { data: shop, error: shopError } =
      await supabase
        .from("shops")
        .select("*")
        .eq("id", product.shop_id)
        .single();

    if (shopError || !shop) {
      return NextResponse.json(
        { error: "المحل غير موجود" },
        { status: 404 }
      );
    }

    if (shop.owner_id !== user.id) {
      return NextResponse.json(
        { error: "غير مصرح لك باستخدام هذا المنتج" },
        { status: 403 }
      );
    }

    const isLocked =
      product.verification_status === "locked" ||
      product.safety_status === "locked" ||
      product.safety_status === "violation" ||
      product.safety_level === "critical";

    if (isLocked) {
      return NextResponse.json(
        {
          error:
            "هذا المنتج مقفل ولا يمكن استخدامه في التصميم.",
        },
        { status: 403 }
      );
    }

    const isUnclear =
      product.verification_status === "review" ||
      product.verification_status === "unverified" ||
      product.confidence === "low" ||
      product.confidence === "medium" ||
      !product.brand ||
      !product.category ||
      !product.description;

    if (isUnclear) {
      const { data: acceptance } =
        await supabase
          .from("product_responsibility_acceptances")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();

      if (!acceptance) {
        return NextResponse.json(
          {
            error:
              "يجب تأكيد مسؤولية المنتج قبل إنشاء التصميم.",
            requiresResponsibility: true,
          },
          { status: 400 }
        );
      }
    }

    if (!product.image_url) {
      return NextResponse.json(
        {
          error:
            "المنتج لا يحتوي على صورة.",
        },
        { status: 400 }
      );
    }

    const designPrompt = buildDesignPrompt({
      product,
      shop,
      mode,
      template,
      style,
      background,
      format,
      description,
    });

    const { data: design, error: insertError } =
      await supabase
        .from("ad_images")
        .insert({
          product_id: product.id,
          shop_id: shop.id,
          image_url: null,
          format,
          prompt: designPrompt,
          status: "pending",
          generated_at: null,
          error_message: null,
        })
        .select("id, status, created_at")
        .single();

    if (insertError) {
      console.error(
        "Create design error:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "تعذر حفظ طلب التصميم.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      designId: design.id,
      status: design.status,
      createdAt: design.created_at,
    });
  } catch (error) {
    console.error(
      "Generate design API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "حدث خطأ غير متوقع أثناء تجهيز التصميم.",
      },
      { status: 500 }
    );
  }
}
