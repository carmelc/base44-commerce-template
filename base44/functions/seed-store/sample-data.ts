/**
 * Optional demo catalog: 3 categories, 2 global attributes (+terms),
 * ~10 products covering every product type, 2 coupons, 2 tax rates.
 * Only installed when with_sample_data=true AND the store has no products.
 */

export const SAMPLE_CATEGORIES = [
  { name: "Clothing", slug: "clothing", description: "Apparel and wearables", display: "default", menu_order: 0, count: 0 },
  { name: "Accessories", slug: "accessories", description: "Small goods and extras", display: "default", menu_order: 1, count: 0 },
  { name: "Downloads", slug: "downloads", description: "Digital products", display: "default", menu_order: 2, count: 0 },
];

export const SAMPLE_ATTRIBUTES = [
  { name: "Color", slug: "color", type: "select", order_by: "menu_order", has_archives: false },
  { name: "Size", slug: "size", type: "select", order_by: "menu_order", has_archives: false },
];

export const SAMPLE_ATTRIBUTE_TERMS: Record<string, Array<{ name: string; slug: string; menu_order: number }>> = {
  color: [
    { name: "Red", slug: "red", menu_order: 0 },
    { name: "Blue", slug: "blue", menu_order: 1 },
  ],
  size: [
    { name: "S", slug: "s", menu_order: 0 },
    { name: "M", slug: "m", menu_order: 1 },
    { name: "L", slug: "l", menu_order: 2 },
  ],
};

/**
 * Product specs — category/attribute references are by slug and resolved to
 * ids at seed time. `variations` uses attribute slug→option pairs.
 */
export const SAMPLE_PRODUCTS: any[] = [
  {
    key: "tshirt",
    name: "Classic T-Shirt",
    type: "simple",
    status: "publish",
    categories: ["clothing"],
    regular_price: 19.99,
    sku: "DEMO-TSHIRT",
    manage_stock: true,
    stock_quantity: 50,
    weight: 0.2,
    dimensions: { length: 30, width: 25, height: 2 },
    short_description: "A soft, everyday classic tee.",
    description: "<p>A soft, everyday classic tee made from 100% cotton.</p>",
  },
  {
    key: "hoodie",
    name: "Zip Hoodie",
    type: "simple",
    status: "publish",
    categories: ["clothing"],
    regular_price: 44.99,
    sale_price: 34.99,
    sku: "DEMO-HOODIE",
    manage_stock: true,
    stock_quantity: 30,
    weight: 0.6,
    short_description: "Cozy zip-up hoodie, currently on sale.",
    description: "<p>Cozy fleece-lined zip hoodie with front pockets.</p>",
  },
  {
    key: "cap",
    name: "Logo Cap",
    type: "simple",
    status: "publish",
    categories: ["accessories"],
    regular_price: 14.99,
    sku: "DEMO-CAP",
    sold_individually: true,
    manage_stock: true,
    stock_quantity: 40,
    short_description: "One per customer — adjustable logo cap.",
    description: "<p>Adjustable cotton cap. Sold individually.</p>",
  },
  {
    key: "stickers",
    name: "Sticker Pack",
    type: "simple",
    status: "publish",
    categories: ["accessories"],
    regular_price: 4.99,
    sku: "DEMO-STICKERS",
    manage_stock: true,
    stock_quantity: 200,
    short_description: "10 assorted vinyl stickers.",
    description: "<p>Ten assorted die-cut vinyl stickers.</p>",
  },
  {
    key: "album",
    name: "Demo Album (Digital Download)",
    type: "simple",
    status: "publish",
    categories: ["downloads"],
    regular_price: 9.99,
    sku: "DEMO-ALBUM",
    virtual: true,
    downloadable: true,
    downloads: [{ name: "Album ZIP", file_url: "https://example.com/downloads/demo-album.zip" }],
    download_limit: 3,
    download_expiry: 30,
    short_description: "Instant digital download.",
    description: "<p>A demo digital product — download limit 3, expires after 30 days.</p>",
  },
  {
    key: "poster",
    name: "Art Print Poster",
    type: "simple",
    status: "publish",
    categories: ["accessories"],
    regular_price: 12.99,
    sku: "DEMO-POSTER",
    manage_stock: true,
    stock_quantity: 3, // demonstrates the low-stock dashboard list
    short_description: "A3 art print — nearly sold out!",
    description: "<p>A3 matte art print. Limited stock.</p>",
  },
  {
    key: "vneck",
    name: "V-Neck T-Shirt",
    type: "variable",
    status: "publish",
    categories: ["clothing"],
    sku: "DEMO-VNECK",
    short_description: "Available in two colors and three sizes.",
    description: "<p>Fitted v-neck tee available in multiple colors and sizes.</p>",
    attributes: [
      { slug: "color", visible: true, variation: true, options: ["Red", "Blue"] },
      { slug: "size", visible: true, variation: true, options: ["S", "M", "L"] },
    ],
    default_attributes: [{ slug: "color", option: "Red" }, { slug: "size", option: "M" }],
    variations: [
      { options: { color: "Red", size: "S" }, regular_price: 21.99, stock_quantity: 10 },
      { options: { color: "Red", size: "M" }, regular_price: 21.99, stock_quantity: 10 },
      { options: { color: "Red", size: "L" }, regular_price: 23.99, stock_quantity: 10 },
      { options: { color: "Blue", size: "S" }, regular_price: 21.99, stock_quantity: 10 },
      { options: { color: "Blue", size: "M" }, regular_price: 21.99, stock_quantity: 10 },
      { options: { color: "Blue", size: "L" }, regular_price: 23.99, stock_quantity: 10 },
    ],
  },
  {
    key: "mug",
    name: "Partner Mug (External)",
    type: "external",
    status: "publish",
    categories: ["accessories"],
    regular_price: 11.99,
    sku: "DEMO-MUG",
    external_url: "https://example.com/partner/mug",
    button_text: "Buy at partner store",
    short_description: "Sold on our partner's site.",
    description: "<p>An affiliate/external product example.</p>",
  },
  {
    key: "bundle",
    name: "Starter Bundle",
    type: "grouped",
    status: "publish",
    categories: ["clothing", "accessories"],
    grouped_keys: ["tshirt", "cap", "stickers"], // resolved to grouped_products ids at seed time
    short_description: "Tee, cap and stickers in one place.",
    description: "<p>A grouped product bundling the tee, cap and sticker pack.</p>",
  },
  {
    key: "beanie",
    name: "Wool Beanie",
    type: "simple",
    status: "publish",
    categories: ["accessories"],
    regular_price: 16.99,
    sku: "DEMO-BEANIE",
    manage_stock: true,
    stock_quantity: 0,
    backorders: "notify", // demonstrates onbackorder status
    short_description: "Out of stock — available on backorder.",
    description: "<p>Warm knit beanie. Currently on backorder.</p>",
  },
];

export const SAMPLE_COUPONS = [
  {
    code: "welcome10",
    discount_type: "percent",
    amount: 10,
    description: "10% off your first order (demo coupon)",
    free_shipping: false,
    individual_use: true,
    usage_limit_per_user: 1,
    usage_count: 0,
    used_by: [] as string[],
  },
  {
    code: "save5",
    discount_type: "fixed_cart",
    amount: 5,
    description: "$5 off orders over $25 (demo coupon)",
    minimum_amount: 25,
    usage_count: 0,
    used_by: [] as string[],
  },
];

export const SAMPLE_TAX_RATES = [
  {
    country: "US", state: "CA", postcodes: [] as string[], cities: [] as string[],
    rate: 7.25, name: "CA State Tax", priority: 1, compound: false, shipping: true,
    tax_class: "standard", menu_order: 0,
  },
  {
    country: "GB", state: "", postcodes: [] as string[], cities: [] as string[],
    rate: 20, name: "VAT", priority: 1, compound: false, shipping: true,
    tax_class: "standard", menu_order: 1,
  },
];
