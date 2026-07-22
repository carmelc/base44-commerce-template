/**
 * Optional demo catalog: 3 categories, 2 global attributes (+terms),
 * ~12 products covering every product type (including 3 variable products
 * with variants), 2 coupons, 2 tax rates. Every product ships with a
 * description, short description and a small image gallery so the storefront
 * and admin look populated out of the box.
 * Only installed when with_sample_data=true AND the store has no products.
 */

/**
 * Placeholder images are served by picsum.photos using deterministic seeds, so
 * every seed run produces the same stable, publicly reachable image URLs
 * without needing an upload step. Swap these for Core.UploadFile URLs in a real
 * store.
 */
const IMG = (seed: string, w = 800, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const gallery = (name: string, seeds: string[]) =>
  seeds.map((seed, position) => ({
    src: IMG(seed),
    name,
    alt: position === 0 ? name : `${name} — view ${position + 1}`,
    position,
  }));

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
    { name: "Black", slug: "black", menu_order: 2 },
    { name: "Green", slug: "green", menu_order: 3 },
  ],
  size: [
    { name: "S", slug: "s", menu_order: 0 },
    { name: "M", slug: "m", menu_order: 1 },
    { name: "L", slug: "l", menu_order: 2 },
    { name: "XL", slug: "xl", menu_order: 3 },
  ],
};

/** Per-color variation image seeds, reused across the variable products. */
const COLOR_IMAGE_SEED: Record<string, string> = {
  Red: "demo-swatch-red",
  Blue: "demo-swatch-blue",
  Black: "demo-swatch-black",
  Green: "demo-swatch-green",
};

const colorImage = (name: string, color: string) => ({
  src: IMG(COLOR_IMAGE_SEED[color] ?? "demo-swatch"),
  name: `${name} — ${color}`,
  alt: `${name} in ${color}`,
});

/**
 * Product specs — category/attribute references are by slug and resolved to
 * ids at seed time. `variations` uses attribute slug→option pairs and may carry
 * a per-variation `image`.
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
    images: gallery("Classic T-Shirt", ["demo-tshirt-1", "demo-tshirt-2"]),
    short_description: "A soft, breathable everyday classic tee.",
    description:
      "<p>Our best-selling everyday tee, cut from 100% combed cotton for a soft hand-feel that only gets better with every wash.</p>" +
      "<ul><li>100% combed ring-spun cotton</li><li>Pre-shrunk, tagless collar</li><li>Reinforced double-stitched hems</li></ul>",
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
    images: gallery("Zip Hoodie", ["demo-hoodie-1", "demo-hoodie-2"]),
    short_description: "Cozy fleece-lined zip-up hoodie, currently on sale.",
    description:
      "<p>Stay warm without the bulk. This fleece-lined zip hoodie pairs a brushed-soft interior with a durable outer shell.</p>" +
      "<ul><li>Brushed fleece interior</li><li>Full-length YKK zipper</li><li>Split kangaroo front pockets</li></ul>",
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
    images: gallery("Logo Cap", ["demo-cap-1", "demo-cap-2"]),
    short_description: "One per customer — adjustable embroidered logo cap.",
    description:
      "<p>A six-panel cotton cap with a low-profile fit and an embroidered front logo. Sold individually.</p>" +
      "<ul><li>100% cotton twill</li><li>Adjustable metal buckle strap</li><li>Curved, pre-shaped brim</li></ul>",
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
    images: gallery("Sticker Pack", ["demo-stickers-1", "demo-stickers-2"]),
    short_description: "10 assorted weatherproof vinyl stickers.",
    description:
      "<p>Ten assorted die-cut vinyl stickers — perfect for laptops, water bottles and notebooks.</p>" +
      "<ul><li>Weatherproof, UV-resistant vinyl</li><li>Dishwasher-safe adhesive</li><li>Residue-free removal</li></ul>",
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
    images: gallery("Demo Album", ["demo-album-1"]),
    short_description: "Instant digital download — ten tracks in high quality.",
    description:
      "<p>A demo digital product delivered as an instant download. Ten tracks in lossless quality, DRM-free.</p>" +
      "<ul><li>Download limit: 3 times per purchase</li><li>Access expires 30 days after purchase</li><li>DRM-free FLAC + MP3</li></ul>",
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
    images: gallery("Art Print Poster", ["demo-poster-1", "demo-poster-2"]),
    short_description: "A3 gallery-grade art print — nearly sold out!",
    description:
      "<p>An A3 matte art print on heavyweight archival stock. A limited run, so grab one while stock lasts.</p>" +
      "<ul><li>200 gsm acid-free matte paper</li><li>Fade-resistant giclée inks</li><li>Ships flat in a rigid mailer</li></ul>",
  },
  {
    key: "vneck",
    name: "V-Neck T-Shirt",
    type: "variable",
    status: "publish",
    categories: ["clothing"],
    sku: "DEMO-VNECK",
    images: gallery("V-Neck T-Shirt", ["demo-vneck-1", "demo-vneck-2"]),
    short_description: "Fitted v-neck tee available in two colors and three sizes.",
    description:
      "<p>A fitted v-neck tee in a lightweight jersey knit, available across multiple colors and sizes.</p>" +
      "<ul><li>Slim, tailored fit</li><li>Lightweight 150 gsm jersey</li><li>Six color/size combinations</li></ul>",
    attributes: [
      { slug: "color", visible: true, variation: true, options: ["Red", "Blue"] },
      { slug: "size", visible: true, variation: true, options: ["S", "M", "L"] },
    ],
    default_attributes: [{ slug: "color", option: "Red" }, { slug: "size", option: "M" }],
    variations: [
      { options: { color: "Red", size: "S" }, regular_price: 21.99, stock_quantity: 10, image: colorImage("V-Neck T-Shirt", "Red") },
      { options: { color: "Red", size: "M" }, regular_price: 21.99, stock_quantity: 10, image: colorImage("V-Neck T-Shirt", "Red") },
      { options: { color: "Red", size: "L" }, regular_price: 23.99, stock_quantity: 10, image: colorImage("V-Neck T-Shirt", "Red") },
      { options: { color: "Blue", size: "S" }, regular_price: 21.99, stock_quantity: 10, image: colorImage("V-Neck T-Shirt", "Blue") },
      { options: { color: "Blue", size: "M" }, regular_price: 21.99, stock_quantity: 10, image: colorImage("V-Neck T-Shirt", "Blue") },
      { options: { color: "Blue", size: "L" }, regular_price: 23.99, stock_quantity: 10, image: colorImage("V-Neck T-Shirt", "Blue") },
    ],
  },
  {
    key: "pullover",
    name: "Colorblock Pullover Hoodie",
    type: "variable",
    status: "publish",
    categories: ["clothing"],
    sku: "DEMO-PULLOVER",
    images: gallery("Colorblock Pullover Hoodie", ["demo-pullover-1", "demo-pullover-2"]),
    short_description: "Heavyweight pullover hoodie in three colors and three sizes.",
    description:
      "<p>A heavyweight brushed-back pullover hoodie with a double-layer hood and ribbed cuffs. Some combinations are on sale.</p>" +
      "<ul><li>380 gsm brushed-back fleece</li><li>Double-layer drawcord hood</li><li>Nine color/size combinations</li></ul>",
    attributes: [
      { slug: "color", visible: true, variation: true, options: ["Black", "Blue", "Green"] },
      { slug: "size", visible: true, variation: true, options: ["M", "L", "XL"] },
    ],
    default_attributes: [{ slug: "color", option: "Black" }, { slug: "size", option: "L" }],
    variations: [
      { options: { color: "Black", size: "M" }, regular_price: 49.99, stock_quantity: 12, image: colorImage("Colorblock Pullover Hoodie", "Black") },
      { options: { color: "Black", size: "L" }, regular_price: 49.99, stock_quantity: 12, image: colorImage("Colorblock Pullover Hoodie", "Black") },
      { options: { color: "Black", size: "XL" }, regular_price: 52.99, stock_quantity: 8, image: colorImage("Colorblock Pullover Hoodie", "Black") },
      { options: { color: "Blue", size: "M" }, regular_price: 49.99, sale_price: 42.99, stock_quantity: 10, image: colorImage("Colorblock Pullover Hoodie", "Blue") },
      { options: { color: "Blue", size: "L" }, regular_price: 49.99, sale_price: 42.99, stock_quantity: 10, image: colorImage("Colorblock Pullover Hoodie", "Blue") },
      { options: { color: "Blue", size: "XL" }, regular_price: 52.99, sale_price: 45.99, stock_quantity: 6, image: colorImage("Colorblock Pullover Hoodie", "Blue") },
      { options: { color: "Green", size: "M" }, regular_price: 49.99, stock_quantity: 9, image: colorImage("Colorblock Pullover Hoodie", "Green") },
      { options: { color: "Green", size: "L" }, regular_price: 49.99, stock_quantity: 9, image: colorImage("Colorblock Pullover Hoodie", "Green") },
      { options: { color: "Green", size: "XL" }, regular_price: 52.99, stock_quantity: 4, image: colorImage("Colorblock Pullover Hoodie", "Green") },
    ],
  },
  {
    key: "tote",
    name: "Canvas Tote Bag",
    type: "variable",
    status: "publish",
    categories: ["accessories"],
    sku: "DEMO-TOTE",
    images: gallery("Canvas Tote Bag", ["demo-tote-1", "demo-tote-2"]),
    short_description: "Sturdy canvas tote — a single-attribute variable product in three colors.",
    description:
      "<p>A roomy, sturdy cotton-canvas tote with reinforced handles. Demonstrates a variable product driven by a single attribute (color).</p>" +
      "<ul><li>12 oz heavyweight cotton canvas</li><li>Reinforced 28 cm handles</li><li>Interior slip pocket</li></ul>",
    attributes: [
      { slug: "color", visible: true, variation: true, options: ["Black", "Blue", "Green"] },
    ],
    default_attributes: [{ slug: "color", option: "Black" }],
    variations: [
      { options: { color: "Black" }, regular_price: 18.99, stock_quantity: 25, image: colorImage("Canvas Tote Bag", "Black") },
      { options: { color: "Blue" }, regular_price: 18.99, stock_quantity: 20, image: colorImage("Canvas Tote Bag", "Blue") },
      { options: { color: "Green" }, regular_price: 18.99, stock_quantity: 0, backorders: "notify", image: colorImage("Canvas Tote Bag", "Green") },
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
    images: gallery("Partner Mug", ["demo-mug-1", "demo-mug-2"]),
    short_description: "Sold on our partner's site — an external/affiliate product.",
    description:
      "<p>A 350 ml ceramic mug sold through our partner store. An example of an external/affiliate product whose buy button links off-site.</p>" +
      "<ul><li>350 ml ceramic body</li><li>Dishwasher &amp; microwave safe</li><li>Fulfilled by our partner</li></ul>",
  },
  {
    key: "bundle",
    name: "Starter Bundle",
    type: "grouped",
    status: "publish",
    categories: ["clothing", "accessories"],
    grouped_keys: ["tshirt", "cap", "stickers"], // resolved to grouped_products ids at seed time
    images: gallery("Starter Bundle", ["demo-bundle-1"]),
    short_description: "Tee, cap and sticker pack together in one grouped listing.",
    description:
      "<p>A grouped product that bundles the Classic T-Shirt, Logo Cap and Sticker Pack into a single listing. Customers pick quantities for each item.</p>",
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
    images: gallery("Wool Beanie", ["demo-beanie-1", "demo-beanie-2"]),
    short_description: "Out of stock — available on backorder.",
    description:
      "<p>A warm, double-layer knit beanie in a soft merino-blend yarn. Currently out of stock but available to order on backorder.</p>" +
      "<ul><li>Merino wool blend</li><li>Double-layer ribbed knit</li><li>One size, stretch fit</li></ul>",
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
