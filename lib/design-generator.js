export function buildDesignPrompt({
  product,
  shop,
  mode,
  template = null,
  style = null,
  background = null,
  format,
  description = "",
}) {
  const productName = product?.name || "المنتج";
  const shopName = shop?.name || "المحل";

  return {
    role: "professional advertising designer",

    objective:
      "Create a professional advertising creative for the provided product.",

    mode,

    format,

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

    customDescription:
      description?.trim() || null,

    product: {
      name: productName,
      brand: product?.brand || null,
      category: product?.category || null,
      price: product?.price || null,
      currency: product?.currency || "AED",
      description: product?.description || null,
      imageUrl: product?.image_url || null,
    },

    shop: {
      name: shopName,
      logoUrl: shop?.logo_url || null,
      phone: shop?.phone || null,
      whatsapp: shop?.whatsapp || null,
      email: shop?.email || null,
      instagram: shop?.instagram || null,
      tiktok: shop?.tiktok || null,
      snapchat: shop?.snapchat || null,
      website: shop?.website || null,
    },

    rules: [
      "Use the original product image as the primary product reference.",
      "Preserve the exact identity of the product.",
      "Do not change the product shape.",
      "Do not change the product logo or branding.",
      "Do not invent product specifications.",
      "Do not invent prices or offers.",
      "Do not add unsupported claims.",
      "Use the shop identity when appropriate.",
      "Make the design advertising-focused.",
      "Keep the product clearly visible.",
      "Use clean professional composition.",
      "Ensure text remains readable.",
    ],
  };
}
