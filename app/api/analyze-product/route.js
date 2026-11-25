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
    if (!productName) {
      return Response.json(
        { error: "اسم المنتج مطلوب" },
        { status: 400 }
      );
    }
    const instructions = `
أنت "ذكاء المنتج" في منصة سوق AI.
مهمتك:
التعرف على المنتج الحقيقي، البحث عنه باستخدام الإنترنت، ثم جمع المعلومات الموثوقة عنه.
أنت لا تكتب إعلانًا.
أنت تبني بطاقة معلومات للمنتج حتى يراجعها صاحب المتجر.
يجب أن تعمل مع جميع أنواع المنتجات:
عطور، إلكترونيات، سماعات، هواتف، أجهزة كمبيوتر، ملابس، أحذية، مستحضرات تجميل، أغذية، أثاث، أدوات منزلية، منتجات سيارات، أدوات رياضية، منتجات أطفال، منتجات صحية، وغيرها.
قواعد البحث:
1. ابحث عن المنتج نفسه وليس عن منتج مشابه.
2. استخدم اسم المنتج والعلامة التجارية والتصنيف والباركود عند توفره.
3. إذا كان الاسم عامًا، لا تفترض منتجًا معينًا.
ابحث عن الاسم مع العلامة التجارية أو الباركود أو معلومات إضافية.
4. الأولوية للموقع الرسمي للشركة المصنعة أو العلامة التجارية.
5. بعد ذلك استخدم المتاجر الموثوقة والمصادر المتخصصة.
6. إذا وجدت أكثر من منتج بنفس الاسم، لا تختر واحدًا عشوائيًا.
اذكر أن المطابقة تحتاج تحققًا.
7. لا تخترع أي معلومة.
8. إذا لم تجد معلومة موثوقة اكتب "غير متوفر".
9. إذا وجدت المعلومة لكن المصادر تختلف عليها، اذكر الاختلاف في verification_notes.
10. لا تخترع المواصفات أو الأرقام أو المكونات أو بلد المنشأ أو الشركة المصنعة أو الضمان أو الأبعاد أو الوزن أو السعة أو التوافق.
11. للمنتجات الإلكترونية:
ابحث عن الموديل، النوع، المقاس، الاتصال، البطارية، الطاقة، التوافق، المنافذ، الوزن، الأبعاد وأي مواصفات رسمية متوفرة.
12. للسماعات:
ابحث تحديدًا عن نوع السماعة، الموديل، Bluetooth، إصدار Bluetooth، البطارية، مدة التشغيل، الميكروفون، ANC، مقاومة الماء، التوافق، الوزن، الأبعاد وأي مواصفات أخرى منشورة رسميًا.
لا تكتب هذه المواصفات إلا إذا وجدتها في مصدر موثوق.
13. للعطور:
ابحث عن التركيز والحجم والجنس والنوتات والمعلومات الرسمية المتوفرة.
14. للملابس:
ابحث عن النوع والخامة والمقاسات وتعليمات العناية عند توفرها.
15. للأغذية:
ابحث عن الحجم والمكونات والقيمة الغذائية والتحذيرات والتخزين عند توفرها.
16. لمستحضرات التجميل:
ابحث عن النوع والحجم والمكونات وطريقة الاستخدام والتحذيرات عند توفرها.
17. للمنتجات الصحية والطبية:
لا تقدم تشخيصًا أو علاجًا أو ادعاءات صحية غير مثبتة.
18. لا تغير سعر المتجر.
19. لا تستخدم معلومات عامة عن الفئة بدل معلومات المنتج الحقيقي.
20. يجب أن تكون النتيجة مفيدة لصاحب المتجر.
21. confidence يجب أن تكون واحدة من:
high
medium
low
22. sources يجب أن تحتوي على المصادر التي اعتمدت عليها.
`;
    const userQuery = `
حلل هذا المنتج وابحث عنه على الإنترنت:
اسم المنتج:
"${productName}"
العلامة التجارية:
"${brand || "غير محددة"}"
التصنيف:
"${category || "غير محدد"}"
الباركود:
"${barcode || "غير متوفر"}"
ابدأ بالتعرف على المنتج الحقيقي.
إذا كان المنتج معروفًا ومطابقته قوية، اجمع معلوماته من المصادر الموثوقة.
إذا كانت المطابقة غير مؤكدة، لا تخترع معلومات.
مهم جدًا:
لا تملأ الحقول بمعلومات عامة لمجرد أن المنتج من فئة معينة.
مثال:
إذا كان المنتج "سماعات"، لا تكتب مواصفات سماعات عامة.
يجب البحث عن السماعات المحددة نفسها.
إذا لم تجد معلومة محددة للمنتج، اكتب "غير متوفر".
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
      return Response.json(
        {
          error: "لم يتم الحصول على نتيجة من البحث.",
        },
        { status: 500 }
      );
    }
    let result;
    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error(
        "JSON PARSE ERROR:",
        error
      );
      console.error(
        "RAW AI RESULT:",
        text
      );
      return Response.json(
        {
          error:
            "تم البحث عن المنتج ولكن تعذر تنظيم النتيجة.",
        },
        { status: 500 }
      );
    }
    return Response.json({
      product_name:
        result.product_name || productName,
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
