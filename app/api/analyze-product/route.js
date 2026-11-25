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

مهمتك ليست كتابة إعلان.

مهمتك هي التعرف على المنتج الحقيقي، البحث عنه، جمع المعلومات الموثوقة عنه، وتنظيمها في بطاقة منتج يمكن لصاحب المتجر مراجعتها واعتمادها.

هذا النظام يجب أن يعمل مع جميع أنواع المنتجات، وليس العطور فقط.

يمكن أن يكون المنتج:
- عطر
- مستحضرات تجميل
- ملابس
- إلكترونيات
- هاتف
- كمبيوتر
- أدوات منزلية
- أثاث
- أغذية ومشروبات
- إكسسوارات سيارات
- أدوات رياضية
- منتجات أطفال
- منتجات صحية
- أو أي منتج آخر.

الخطوة الأولى:
حدد نوع المنتج الحقيقي.

بعد تحديد النوع:
ابحث عن المعلومات المناسبة لهذا النوع من المنتجات.

لا تستخدم قالبًا ثابتًا للعطور أو أي فئة واحدة.

قواعد مهمة جدًا:

1. ابحث عن المنتج الحقيقي نفسه، وليس عن منتجات مشابهة.

2. استخدم الاسم والعلامة التجارية والباركود والتصنيف للمطابقة.

3. إذا كان الباركود موجودًا، استخدمه كعامل مهم جدًا في تحديد المنتج.

4. الأولوية للموقع الرسمي للعلامة التجارية والشركة المصنعة.

5. بعد المصادر الرسمية استخدم المتاجر الموثوقة والمصادر المتخصصة.

6. إذا وجدت اختلافًا بين مصدرين، لا تخترع إجابة.
اذكر الاختلاف في verification_notes.

7. لا تحول المعلومات غير المؤكدة إلى حقائق.

8. إذا لم تجد معلومة موثوقة، اكتب:
"غير متوفر"

9. إذا وجدت المعلومة ولكن تحتاج تحققًا إضافيًا، اكتب:
"يحتاج تحقق"

10. لا تخترع:
- المواصفات
- الأرقام
- المكونات
- بلد المنشأ
- الشركة المصنعة
- الضمان
- الأبعاد
- الوزن
- السعة
- الفوائد الصحية
- الشهادات
- التوافق
- الأداء

11. للمنتجات الصحية والطبية:
لا تقدم تشخيصًا أو علاجًا أو ادعاءات صحية غير مثبتة.

12. لا تغير السعر الذي أدخله صاحب المتجر.

13. لا تكتب محتوى تسويقيًا مبالغًا فيه.

14. افصل بين المعلومات المؤكدة والمعلومات التي تحتاج تحققًا.

15. حدد درجة الثقة العامة:
high
medium
low

16. أضف المصادر التي اعتمدت عليها.

17. إذا لم تجد المنتج بشكل مؤكد، لا تخترع منتجًا بديلًا.
وضح أن المطابقة غير مؤكدة.

مهم:
المعلومات يجب أن تكون مفيدة لصاحب المتجر، وليس مجرد نص عام عن فئة المنتج.
`;

    const userQuery = `
حلل وابحث عن المنتج التالي:

اسم المنتج:
"${productName}"

العلامة التجارية:
"${brand || "غير محددة"}"

التصنيف الذي أدخله المستخدم:
"${category || "غير محدد"}"

الباركود:
"${barcode || "غير متوفر"}"

ابدأ بتحديد المنتج الحقيقي.

ثم حدد نوع المنتج.

ثم اجمع المعلومات المناسبة لهذا النوع.

إذا كان المنتج إلكترونيًا، ركز على المواصفات التقنية والتوافق والأبعاد والطاقة وغيرها من المعلومات المناسبة.

إذا كان المنتج غذائيًا، ركز على الحجم والمكونات والقيمة الغذائية والتحذيرات والتخزين وغيرها عند توفرها.

إذا كان المنتج تجميليًا، ركز على النوع والحجم والمكونات والاستخدام والتحذيرات وغيرها عند توفرها.

إذا كان المنتج ملابس، ركز على النوع والخامة والمقاسات والعناية وغيرها عند توفرها.

إذا كان المنتج أثاثًا أو أدوات منزلية، ركز على الخامة والأبعاد والاستخدام والوزن وغيرها عند توفرها.

إذا كان المنتج سيارة أو إكسسوار سيارة، ركز على التوافق والموديلات والمواصفات وغيرها عند توفرها.

إذا كان المنتج من نوع آخر، اختر المعلومات المهمة لهذا النوع بدل استخدام قالب غير مناسب.

أعد النتيجة بصيغة JSON فقط بهذا الشكل:

{
  "product_name": "",
  "brand": "",
  "product_type": "",
  "category": "",
  "short_description": "",
  "full_description": "",
  "specifications": "",
  "features": "",
  "uses": "",
  "target_audience": "",
  "manufacturer": "",
  "country_of_origin": "",
  "size_or_volume": "",
  "ingredients": "",
  "warnings": "",
  "storage": "",
  "warranty": "",
  "verification_notes": "",
  "confidence": "",
  "sources": []
}
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
    } catch {
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        result = JSON.parse(cleaned);
      } catch (parseError) {
        console.error("JSON PARSE ERROR:", parseError);
        console.error("RAW AI RESULT:", text);

        return Response.json(
          {
            error: "تم البحث عن المنتج ولكن تعذر تنظيم النتيجة.",
            raw: text,
          },
          { status: 500 }
        );
      }
    }

    return Response.json({
      product_name:
        result.product_name || productName,

      brand:
        result.brand || brand || "غير متوفر",

      product_type:
        result.product_type || "غير متوفر",

      category:
        result.category || category || "غير متوفر",

      short_description:
        result.short_description || "غير متوفر",

      full_description:
        result.full_description || "غير متوفر",

      specifications:
        result.specifications || "غير متوفر",

      features:
        result.features || "غير متوفر",

      uses:
        result.uses || "غير متوفر",

      target_audience:
        result.target_audience || "غير متوفر",

      manufacturer:
        result.manufacturer || "غير متوفر",

      country_of_origin:
        result.country_of_origin || "غير متوفر",

      size_or_volume:
        result.size_or_volume || "غير متوفر",

      ingredients:
        result.ingredients || "غير متوفر",

      warnings:
        result.warnings || "غير متوفر",

      storage:
        result.storage || "غير متوفر",

      warranty:
        result.warranty || "غير متوفر",

      verification_notes:
        result.verification_notes || "غير متوفر",

      confidence:
        result.confidence || "medium",

      sources:
        Array.isArray(result.sources)
          ? result.sources
          : [],
    });
  } catch (error) {
    console.error("ANALYZE PRODUCT ERROR:", error);

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
