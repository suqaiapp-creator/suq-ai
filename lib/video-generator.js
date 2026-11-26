const VIDEO_ENGINE = "runway";

const ENGINE_ENABLED =
  process.env.VIDEO_GENERATION_ENABLED === "true";

const RUNWAY_API_URL =
  "https://api.dev.runwayml.com";

const RUNWAY_VERSION =
  "2024-11-06";

const DEFAULT_MODEL =
  "seedance2_5";

const FORMAT_MAP = {
  "9:16": "720:1280",
  "16:9": "1280:720",
  "1:1": "960:960",
};

const DURATION_MAP = {
  5: 5,
  8: 8,
  10: 10,
};

function getFormat(format) {
  return (
    FORMAT_MAP[format] ||
    FORMAT_MAP["9:16"]
  );
}

function getDuration(duration) {
  const value = Number(duration);

  return (
    DURATION_MAP[value] ||
    10
  );
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
Create a professional commercial advertising video for the following product.

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
- Preserve the exact product shape.
- Preserve the original product branding.
- Do not redesign the product.
- Do not change the product logo.
- Do not invent specifications.
- Do not invent prices.
- Do not invent discounts.
- Do not add unsupported claims.
- Do not create extra copies of the product.
- Do not distort the product.
- Keep the product clearly visible.
- Keep the product as the main subject.

VIDEO DIRECTION:
- Start with a strong product reveal.
- Use subtle professional camera movement.
- Use realistic lighting.
- Create natural product-focused motion.
- Highlight the product clearly.
- Keep the composition premium and clean.
- Avoid excessive motion.
- Avoid visual distortion.
- End with a strong advertising composition.
- Leave suitable visual space for branding and call-to-action.

SHOP BRANDING:
Use the shop identity only when appropriate.

CUSTOM USER INSTRUCTIONS:
${
  customPrompt ||
  "Create the best professional advertisement for this product."
}
`.trim();
}

export async function generateVideo({
  product,
  shop,
  video,
}) {
  /*
   * حماية مهمة:
   * المحرك لا يعمل إلا إذا تم تفعيل
   * VIDEO_GENERATION_ENABLED=true
   */
  if (!ENGINE_ENABLED) {
    return {
      success: false,
      enabled: false,
      status: "disabled",
      engine: VIDEO_ENGINE,
      message:
        "محرك الفيديو غير مفعّل حالياً.",
    };
  }

  if (
    !process.env.RUNWAYML_API_SECRET
  ) {
    throw new Error(
      "RUNWAYML_API_SECRET غير موجود في إعدادات الخادم."
    );
  }

  if (!product) {
    throw new Error(
      "بيانات المنتج مطلوبة."
    );
  }

  if (!shop) {
    throw new Error(
      "بيانات المحل مطلوبة."
    );
  }

  const productImage =
    product?.image_url;

  if (!productImage) {
    throw new Error(
      "صورة المنتج مطلوبة لإنشاء الفيديو."
    );
  }

  if (!product?.name) {
    throw new Error(
      "اسم المنتج مطلوب."
    );
  }

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

  const ratio =
    getFormat(video?.format);

  const duration =
    getDuration(
      video?.duration_seconds
    );

  const promptText =
    buildVideoPrompt({
      product,
      shop,
      video,
    });

  const model =
    process.env.RUNWAY_VIDEO_MODEL ||
    DEFAULT_MODEL;

  const requestBody = {
    model,

    promptImage:
      productImage,

    promptText,

    ratio,

    duration,
  };

  let response;

  try {
    response = await fetch(
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

        body: JSON.stringify(
          requestBody
        ),
      }
    );
  } catch (error) {
    console.error(
      "RUNWAY CONNECTION ERROR:",
      error
    );

    throw new Error(
      `تعذر الاتصال بمحرك الفيديو: ${
        error?.message ||
        "خطأ غير معروف"
      }`
    );
  }

  let result = null;

  try {
    result =
      await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    console.error(
      "RUNWAY VIDEO ERROR:",
      result
    );

    const providerMessage =
      result?.error ||
      result?.message ||
      result?.issues?.[0]?.message ||
      `HTTP ${response.status}`;

    throw new Error(
      `فشل إرسال طلب إنشاء الفيديو: ${providerMessage}`
    );
  }

  const taskId =
    result?.id ||
    result?.taskId ||
    null;

  if (!taskId) {
    console.error(
      "RUNWAY INVALID RESPONSE:",
      result
    );

    throw new Error(
      "تم إرسال طلب الفيديو ولكن لم يتم استلام رقم المهمة."
    );
  }

  return {
    success: true,

    enabled: true,

    status:
      result?.status ||
      "PENDING",

    taskId,

    engine:
      VIDEO_ENGINE,

    model,

    ratio,

    duration,

    promptText,
  };
}
