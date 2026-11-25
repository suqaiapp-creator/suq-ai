import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { product } = await request.json();

    if (!product) {
      return Response.json(
        { error: "بيانات المنتج غير موجودة" },
        { status: 400 }
      );
    }

    const productName = String(product.name || "").trim();
    const brand = String(product.brand || "").trim();
    const category = String(product.category || "").trim();
    const barcode = String(product.barcode || "").trim();
    const imageUrl = String(product.image_url || "").trim();

    if (!productName) {
      return Response.json(
        { error: "اسم المنتج مطلوب" },
        { status: 400 }
      );
    }

    if (!imageUrl && !barcode && !brand) {
      return Response.json(
        {
          error:
            "يحتاج المنتج إلى صورة أو باركود أو علامة تجارية للتعرف عليه بدقة.",
        },
        { status: 400 }
      );
    }

    const instructions = `
أنت "ذكاء المنتج" في منصة سوق AI.

مهمتك هي التعرف على المنتج الحقيقي من:
1. صورة المنتج.
2. اسم المنتج.
3. العلامة التجارية.
4. الباركود.
5. التصنيف.

ثم البحث على الإنترنت عن المنتج نفسه وجمع معلومات موثوقة عنه.

مهم جدًا:

- لا تخمن هوية المنتج.
- لا تستخدم مواصفات عامة للفئة.
- لا تخلط بين منتجات متشابهة.
- لا تخترع أي معلومة.
- إذا لم تجد معلومة موثوقة اكتب "غير متوفر".
- إذا اختلفت المصادر اذكر ذلك في verification_notes.
- الأولوية للموقع الرسمي للشركة المصنعة.
- بعده استخدم المتاجر والمصادر المتخصصة الموثوقة.

طريقة التعرف:

أولًا افحص الصورة وابحث عن:
- اسم العلامة التجارية.
- اسم المنتج.
- رقم الموديل.
- أي رقم أو كود ظاهر.
- شكل المنتج.
- الكتابة الموجودة على العبوة.

ثم استخدم هذه المعلومات في البحث.

إذا توفر باركود:
ابحث عن الباركود حرفيًا.

إذا توفر اسم علامة تجارية:
ابحث عن العلامة التجارية مع اسم المنتج والباركود.

إذا كان المنتج إلكترونيًا:
ابحث عن المواصفات الرسمية الخاصة بالموديل.

إذا كان المنتج سماعات:
ابحث عن:
- النوع
- الموديل
- Bluetooth
- إصدار Bluetooth
- البطارية
- مدة التشغيل
- الشحن
- الميكروفون
- ANC
- مقاومة الماء
- التوافق
- الوزن
- الأبعاد

لا تضع أي مواصفة إلا إذا كانت تخص المنتج الذي تم التعرف عليه.

إذا كانت المطابقة قوية بين:
الصورة + العلامة التجارية + الباركود + معلومات المصادر
فاجعل confidence = high.

إذا كانت المطابقة جيدة لكن ليست مؤكدة تمامًا:
confidence = medium.

إذا لم نستطع تحديد المنتج:
confidence = low
واشرح السبب في verification_notes.

لا تغير سعر المتجر.

أنت تبني بطاقة معلومات للمنتج، وليس إعلانًا تسويقيًا.
`;

    const textPrompt = `
حلل هذا المنتج الحقيقي:

اسم المنتج:
"${productName}"

العلامة التجارية:
"${brand || "غير محددة"}"

التصنيف:
"${category || "غير محدد"}"

الباركود:
"${barcode || "غير متوفر"}"

ابدأ بالتعرف على المنتج من الصورة إذا كانت متوفرة.

بعد ذلك:

1. اقرأ أي اسم أو شعار أو رقم موديل ظاهر في الصورة.
2. استخدم الباركود في البحث.
3. استخدم العلامة التجارية في البحث.
4. قارن المعلومات الموجودة في الصورة مع نتائج البحث.
5. ابحث عن الموقع الرسمي للشركة.
6. تحقق من المنتج قبل كتابة المواصفات.

لا تستخدم مواصفات عامة.

إذا لم تتأكد من المنتج، لا تخترع.
اكتب "غير متوفر" للمعلومات التي لم يتم التحقق منها.
`;

    /*
     * نبني محتوى الطلب.
     *
     * الصورة تدخل إلى الذكاء إذا كانت موجودة.
     * النص يدخل معه في نفس الطلب.
     */
    const inputContent = [
      {
        type: "input_text",
        text: textPrompt,
      },
    ];

    if (imageUrl) {
      inputContent.push({
        type: "input_image",
        image_url: imageUrl,
        detail: "high",
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",

      tools: [
        {
          type: "web_search",
        },
      ],

      instructions,

      input: [
        {
          role: "user",
          content: inputContent,
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name: "product_intelligence",
          strict: true,

          schema: {
            type: "object",
            additionalProperties: false,

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
                enum: [
                  "high",
                  "medium",
                  "low",
                ],
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
          },
        },
      },
    });

    const outputText = response.output_text;

    if (!outputText) {
      console.error("OPENAI EMPTY RESPONSE");

      return Response.json(
        {
          error:
            "الذكاء الاصطناعي لم يرجع نتيجة.",
        },
        { status: 500 }
      );
    }

    let result;

    try {
      result = JSON.parse(outputText);
    } catch (error) {
      console.error(
        "JSON PARSE ERROR:",
        error
      );

      console.error(
        "RAW OPENAI RESULT:",
        outputText
      );

      return Response.json(
        {
          error:
            "تم التعرف على المنتج ولكن تعذر تنظيم النتيجة.",
        },
        { status: 500 }
      );
    }

    console.log(
      "PRODUCT INTELLIGENCE RESULT:",
      JSON.stringify(result)
    );

    return Response.json({
      product_name:
        result.product_name ||
        productName,

      brand:
        result.brand ||
        brand ||
        "غير متوفر",

      product_type:
        result.product_type ||
        "غير متوفر",

      category:
        result.category ||
        category ||
        "غير متوفر",

      short_description:
        result.short_description ||
        "غير متوفر",

      full_description:
        result.full_description ||
        "غير متوفر",

      specifications:
        result.specifications ||
        "غير متوفر",

      features:
        result.features ||
        "غير متوفر",

      uses:
        result.uses ||
        "غير متوفر",

      target_audience:
        result.target_audience ||
        "غير متوفر",

      manufacturer:
        result.manufacturer ||
        "غير متوفر",

      country_of_origin:
        result.country_of_origin ||
        "غير متوفر",

      size_or_volume:
        result.size_or_volume ||
        "غير متوفر",

      ingredients:
        result.ingredients ||
        "غير متوفر",

      warnings:
        result.warnings ||
        "غير متوفر",

      storage:
        result.storage ||
        "غير متوفر",

      warranty:
        result.warranty ||
        "غير متوفر",

      verification_notes:
        result.verification_notes ||
        "غير متوفر",

      confidence:
        result.confidence ||
        "low",

      sources:
        Array.isArray(result.sources)
          ? result.sources
          : [],
    });
  } catch (error) {
    console.error(
      "ANALYZE PRODUCT ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "حدث خطأ أثناء تحليل المنتج.",
      },
      { status: 500 }
    );
  }
}
