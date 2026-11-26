const VIDEO_ENGINE = "runway";

const ENGINE_ENABLED =
  process.env.VIDEO_GENERATION_ENABLED === "true";

const RUNWAY_API_URL =
  "https://api.dev.runwayml.com";

const RUNWAY_VERSION =
  "2024-11-06";

const FORMAT_MAP = {
  "9:16": "720:1280",
  "16:9": "1280:720",
  "1:1": "960:960",
};

const DURATION_MAP = {
  10: 10,
  15: 15,
  30: 30,
};

function getFormat(format) {
  return FORMAT_MAP[format] || FORMAT_MAP["9:16"];
}

function getDuration(duration) {
  const value = Number(duration);

  return DURATION_MAP[value] || 10;
}

function buildVideoPrompt({
  product,
  shop,
  video,
}) {
  const productName =
    product?.name || "المنتج";

  const shopName =
    shop?.name || "المحل";

  const customPrompt =
    typeof video?.prompt === "string"
      ? video.prompt
      : "";

  return `
Create a professional commercial advertising video.

PRODUCT:
${productName}

BRAND:
${product?.brand || "Not specified"}

CATEGORY:
${product?.category || "Not specified"}

PRICE:
${
  product?.price != null
    ? `${product.price} ${
        product.currency || "AED"
      }`
    : "Not specified"
}

SHOP:
${shopName}

VIDEO TYPE:
${video?.video_type || "product_ad"}

STYLE:
${video?.style || "modern"}

BACKGROUND:
${video?.background || "clean"}

IMPORTANT PRODUCT RULES:
- Preserve the exact identity of the product.
- Preserve the product shape.
- Do not redesign the product.
- Do not change the product logo.
- Do not invent specifications.
- Do not invent prices.
- Do not invent offers.
- Do not add unsupported claims.
- Keep the product clearly visible.
- Make the movement natural and premium.
- Do not distort the product.
- Do not create extra copies of the product.
- Keep the advertising composition clean.

VIDEO DIRECTION:
- Start with a strong product reveal.
- Add subtle professional camera movement.
- Use realistic lighting.
- Highlight the product naturally.
- Keep the product as the main subject.
- End with a clear advertising composition.
- Leave enough visual space for branding and call-to-action.

SHOP BRANDING:
Use the shop identity only where appropriate.

CUSTOM USER INSTRUCTIONS:
${customPrompt || "Create the best professional advertisement for this product."}
`.trim();
}

export async function generateVideo({
  product,
  shop,
  video,
}) {
  /*
   * لا نشغل المحرك إلا إذا تم تفعيله
   * من Environment Variables.
   */

  if (!ENGINE_ENABLED) {
    return {
      success: false,
      enabled: false,
      status: "disabled",
      message:
        "محرك الفيديو غير مفعّل حالياً.",
    };
  }

  /*
   * التحقق من Runway API Key
   */

  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error(
      "RUNWAYML_API_SECRET غير موجود في إعدادات الخادم."
    );
  }

  /*
   * التحقق من صورة المنتج
   */

  const productImage =
    product?.image_url;

  if (!productImage) {
    throw new Error(
      "صورة المنتج مطلوبة لإنشاء الفيديو."
    );
  }

  /*
   * التحقق من البيانات الأساسية
   */

  if (!product?.name) {
    throw new Error(
      "اسم المنتج مطلوب."
    );
  }

  /*
   * منع المنتجات الخطرة
   */

  if (
    product?.safety_status ===
      "locked" ||
    product?.safety_status ===
      "violation"
  ) {
    throw new Error(
      "هذا المنتج مقفل ولا يمكن إنشاء فيديو له."
    );
  }

  if (
    product?.safety_status ===
    "review"
  ) {
    throw new Error(
      "هذا المنتج يحتاج إلى مراجعة قبل إنشاء الفيديو."
    );
  }

  /*
   * إعدادات الفيديو
   */

  const ratio = getFormat(
    video?.format
  );

  const duration = getDuration(
    video?.duration_seconds
  );

  const promptText =
    buildVideoPrompt({
      product,
      shop,
      video,
    });

  /*
   * حالياً نستخدم Image-to-Video
   * مع صورة المنتج كأول إطار.
   *
   * لا يتم تنفيذ هذا الجزء إلا
   * عندما VIDEO_GENERATION_ENABLED=true
   */

  const response = await fetch(
    `${RUNWAY_API_URL}/v1/image_to_video`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${process.env.RUNWAYML_API_SECRET}`,

        "Content-Type":
          "application/json",

        "X-Runway-Version":
          RUNWAY_VERSION,
      },

      body: JSON.stringify({
        model:
          process.env.RUNWAY_VIDEO_MODEL ||
          "seedance2_5",

        promptImage:
          productImage,

        promptText,

        ratio,

        duration,
      }),
    }
  );

  const result =
    await response.json();

  if (!response.ok) {
    console.error(
      "RUNWAY VIDEO ERROR:",
      result
    );

    throw new Error(
      result?.error ||
        result?.message ||
        "فشل إرسال طلب إنشاء الفيديو."
    );
  }

  return {
    success: true,

    enabled: true,

    status:
      result?.status ||
      "processing",

    taskId:
      result?.id ||
      result?.taskId ||
      null,

    engine:
      VIDEO_ENGINE,

    model:
      process.env.RUNWAY_VIDEO_MODEL ||
      "seedance2_5",

    ratio,

    duration,

    promptText,
  };
}
