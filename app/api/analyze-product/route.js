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

    // مهم: رقم الموديل كان مفقودًا من البحث السابق
    const model =
      String(
        product.model_number ||
          product.model ||
          product.modelNumber ||
          ""
      ).trim();

    if (!productName) {
      return Response.json(
        { error: "اسم المنتج مطلوب" },
        { status: 400 }
      );
    }

    const instructions = `
أنت "ذكاء المنتج" في منصة سوق AI.

مهمتك هي التعرف على المنتج الحقيقي ثم جمع معلومات موثوقة عنه من الإنترنت.

أنت لا تكتب إعلانًا.
أنت تبني بطاقة معلومات دقيقة لصاحب المتجر.

قواعد مهمة جدًا:

1. يجب تحديد المنتج الحقيقي قبل كتابة المواصفات.

2. استخدم جميع معلومات التعريف المتوفرة:
- اسم المنتج
- العلامة التجارية
- رقم الموديل
- الباركود
- التصنيف

3. إذا توفر رقم موديل أو باركود:
يجب استخدامه كمعرف أساسي للبحث.

4. ابحث عن الباركود حرفيًا.

5. ابحث عن رقم الموديل حرفيًا مع اسم العلامة التجارية.

6. لا تستخدم معلومات منتج مشابه لمجرد أن الاسم متشابه.

7. الأولوية للمصادر الرسمية للشركة المصنعة.

8. بعد ذلك استخدم المتاجر الموثوقة والمصادر المتخصصة.

9. إذا تطابقت عدة مصادر على نفس المنتج، استخدم المعلومات المشتركة بينها.

10. إذا اختلفت المصادر، اذكر الاختلاف في verification_notes.

11. لا تخترع أي معلومة.

12. إذا لم تجد معلومة موثوقة، اكتب:
"غير متوفر"

13. لا تضع مواصفات عامة للفئة.

مثال:
إذا كان المنتج "سماعات"، لا تكتب مواصفات سماعات عامة.
يجب أن تكون المواصفات خاصة بالمنتج المحدد.

14. إذا كان المنتج إلكترونيًا، ابحث عن:
- الموديل
- النوع
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
- المنافذ
- وأي مواصفات رسمية أخرى.

15. إذا كان المنتج سماعات، ابحث تحديدًا عن:
- نوع السماعة
- الموديل
- Bluetooth
- البطارية
- مدة التشغيل
- الميكروفون
- ANC
- مقاومة الماء
- التوافق
- الوزن
- الأبعاد.

16. للعطور:
ابحث عن التركيز والحجم والجنس والنوتات والمعلومات الرسمية.

17. للأغذية:
ابحث عن الحجم والمكونات والقيمة الغذائية والتحذيرات والتخزين.

18. لمستحضرات التجميل:
ابحث عن النوع والحجم والمكونات وطريقة الاستخدام والتحذيرات.

19. للمنتجات الصحية والطبية:
لا تقدم تشخيصًا أو علاجًا أو ادعاءات صحية غير مثبتة.

20. لا تغير سعر المتجر.

21. لا تخترع بلد المنشأ أو الشركة المصنعة أو الضمان.

22. confidence يجب أن تكون:
high
medium
low

23. sources يجب أن تحتوي على المصادر التي اعتمدت عليها.

24. إذا كان هناك تطابق قوي بين العلامة التجارية + رقم الموديل + الباركود:
اعتبر ذلك دليلًا قويًا على هوية المنتج.

25. في verification_notes اذكر كيف تم التعرف على المنتج، مثل:
"تمت مطابقة رقم الموديل والباركود مع مصادر المنتج."

`;

    const userQuery = `
تعرف على هذا المنتج الحقيقي وابحث عنه على الإنترنت.

اسم المنتج:
"${productName}"

العلامة التجارية:
"${brand || "غير محددة"}"

رقم الموديل:
"${model || "غير متوفر"}"

التصنيف:
"${category || "غير محدد"}"

الباركود:
"${barcode || "غير متوفر"}"

مهم جدًا:

ابحث أولًا بهذه الطريقة:

1. العلامة التجارية + رقم الموديل
"${brand} ${model}"

2. العلامة التجارية + الباركود
"${brand} ${barcode}"

3. رقم الموديل وحده
"${model}"

4. الباركود وحده
"${barcode}"

ثم قارن النتائج.

إذا تطابقت النتائج، حدد المنتج الحقيقي.

إذا وجدت المنتج، اجمع مواصفاته الحقيقية فقط.

لا تستخدم مواصفات عامة.

لا تخمن.

إذا لم تجد معلومة محددة، اكتب "غير متوفر".

الهدف:
إنتاج بطاقة معلومات دقيقة يمكن لصاحب المتجر مراجعتها قبل استخدامها في التسويق.
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",

      tools: [
        {
          type: "web_search",
        },
      ],

      instructions,
      input: userQuery,

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

    const text = response.output_text;

    if (!text) {
      console.error("OPENAI EMPTY RESPONSE");

      return Response.json(
        {
          error: "لم يتم الحصول على نتيجة من الذكاء الاصطناعي.",
        },
        { status: 500 }
      );
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error("JSON PARSE ERROR:", error);
      console.error("RAW AI RESULT:", text);

      return Response.json(
        {
          error:
            "تم البحث عن المنتج ولكن تعذر تنظيم النتيجة.",
        },
        { status: 500 }
      );
    }

    console.log("PRODUCT ANALYSIS RESULT:", result);

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
          "حدث خطأ أثناء البحث وتحليل المنتج.",
      },
      { status: 500 }
    );
  }
}
