import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { logAIUsage } from "../../../lib/ai-usage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      productId = null,
      name = "",
      brand = "",
      category = "",
      barcode = "",
      image_url = null,
      imageUrl = null,
    } = body;

    const finalImageUrl = image_url || imageUrl || null;

    if (!name && !brand && !barcode && !finalImageUrl) {
      return NextResponse.json(
        {
          error: "لا توجد معلومات كافية لتحليل المنتج",
        },
        { status: 400 }
      );
    }

    /*
     * -----------------------------------------
     * 1. الحصول على بيانات المنتج والمحل
     * -----------------------------------------
     */

    let shopId = null;
    let userId = null;

    if (productId) {
      const { data: product, error: productError } =
        await supabaseAdmin
          .from("products")
          .select(
            `
              id,
              shop_id,
              shops (
                id,
                owner_id
              )
            `
          )
          .eq("id", productId)
          .maybeSingle();

      if (!productError && product) {
        shopId = product.shop_id || null;
        userId = product.shops?.owner_id || null;
      }
    }

    /*
     * -----------------------------------------
     * 2. تجهيز معلومات المنتج للذكاء الاصطناعي
     * -----------------------------------------
     */

    const productInformation = `
اسم المنتج الذي أدخله المستخدم:
${name || "غير محدد"}

العلامة التجارية:
${brand || "غير محددة"}

الفئة:
${category || "غير محددة"}

الباركود:
${barcode || "غير موجود"}

يجب التعرف على المنتج الحقيقي من المعلومات والصورة والبحث في المصادر الموثوقة.
لا تخترع أي معلومة غير مؤكدة.
`;

    /*
     * -----------------------------------------
     * 3. تجهيز محتوى الطلب
     * -----------------------------------------
     */

    const content = [
      {
        type: "input_text",
        text: productInformation,
      },
    ];

    if (finalImageUrl) {
      content.push({
        type: "input_image",
        image_url: finalImageUrl,
        detail: "high",
      });
    }

    /*
     * -----------------------------------------
     * 4. تحليل المنتج بواسطة OpenAI
     * -----------------------------------------
     */

    const response = await openai.responses.create({
      model: "gpt-5-mini",

      tools: [
        {
          type: "web_search_preview",
        },
      ],

      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `
أنت نظام Product Intelligence لمنصة سوق AI.

مهمتك التعرف على المنتج الحقيقي والتحقق من معلوماته قبل استخدامه في التسويق.

القواعد:

1. لا تخترع أي معلومة.
2. إذا كانت المعلومة غير مؤكدة اذكر أنها غير مؤكدة.
3. استخدم الصورة والاسم والبراند والباركود معًا.
4. ابحث في المصادر الموثوقة.
5. أعط الأولوية للمصدر الرسمي للشركة المصنعة.
6. إذا وجد رقم موديل، استخدمه للتحقق من المنتج.
7. لا تعتبر مجرد تشابه الصورة دليلاً كافيًا.
8. لا تضف مواصفات لم تجد لها مصدرًا موثوقًا.
9. إذا اختلفت المصادر، اذكر الاختلاف في verification_notes.
10. معلومات الضمان تختلف حسب الدولة، فلا تفترض ضمانًا محددًا.
11. بلد المنشأ لا يُذكر إلا إذا كان موثوقًا.
12. لا تكتب معلومات تسويقية مبالغًا فيها.
13. جميع النتائج يجب أن تكون باللغة العربية.
14. احتفظ بأسماء المنتجات والعلامات التجارية الرسمية كما هي عند الحاجة.
15. confidence يجب أن يكون:
   - high
   - medium
   - low

أنت لا تكتب إعلانًا.
أنت تبني ملفًا موثوقًا للمنتج لاستخدامه لاحقًا في التسويق.
`,
            },
          ],
        },
        {
          role: "user",
          content,
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name: "product_intelligence",
          strict: true,

          schema: {
            type: "object",

            properties: {
              product_name: {
                type: "string",
              },

              brand: {
                type: "string",
              },

              product_type: {
                type: "string",
              },

              category: {
                type: "string",
              },

              short_description: {
                type: "string",
              },

              full_description: {
                type: "string",
              },

              specifications: {
                type: "string",
              },

              features: {
                type: "string",
              },

              uses: {
                type: "string",
              },

              target_audience: {
                type: "string",
              },

              manufacturer: {
                type: "string",
              },

              country_of_origin: {
                type: "string",
              },

              size_or_volume: {
                type: "string",
              },

              ingredients: {
                type: "string",
              },

              warnings: {
                type: "string",
              },

              storage: {
                type: "string",
              },

              warranty: {
                type: "string",
              },

              verification_notes: {
                type: "string",
              },

              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },

              sources: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },

            required: [
              "product_name",
              "brand",
              "product_type",
              "category",
              "short_description",
              "full_description",
              "specifications",
              "features",
              "uses",
              "target_audience",
              "manufacturer",
              "country_of_origin",
              "size_or_volume",
              "ingredients",
              "warnings",
              "storage",
              "warranty",
              "verification_notes",
              "confidence",
              "sources",
            ],

            additionalProperties: false,
          },
        },
      },
    });

    /*
     * -----------------------------------------
     * 5. استخراج نتيجة التحليل
     * -----------------------------------------
     */

    const resultText = response.output_text;

    if (!resultText) {
      await logAIUsage({
        userId,
        shopId,
        productId,
        operation: "product_analysis",
        model: "gpt-5-mini",
        status: "failed",
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        metadata: {
          source: "analyze-product",
          reason: "empty_output",
        },
      });

      return NextResponse.json(
        {
          error: "لم يتم الحصول على نتيجة من الذكاء الاصطناعي",
        },
        { status: 500 }
      );
    }

    let result;

    try {
      result = JSON.parse(resultText);
    } catch (parseError) {
      await logAIUsage({
        userId,
        shopId,
        productId,
        operation: "product_analysis",
        model: "gpt-5-mini",
        status: "failed",
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        metadata: {
          source: "analyze-product",
          reason: "invalid_json",
        },
      });

      return NextResponse.json(
        {
          error: "تعذر قراءة نتيجة تحليل المنتج",
        },
        { status: 500 }
      );
    }

    /*
     * -----------------------------------------
     * 6. تسجيل استخدام الذكاء الاصطناعي
     * -----------------------------------------
     */

    await logAIUsage({
      userId,
      shopId,
      productId,
      operation: "product_analysis",
      model: "gpt-5-mini",
      status: "success",
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      estimatedCost: 0,
      metadata: {
        source: "analyze-product",
        barcode: barcode || null,
        image_used: Boolean(finalImageUrl),
        confidence: result.confidence || null,
      },
    });

    /*
     * -----------------------------------------
     * 7. إرجاع النتيجة للتطبيق
     * -----------------------------------------
     */

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze product error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "حدث خطأ أثناء تحليل المنتج",
      },
      { status: 500 }
    );
  }
}
