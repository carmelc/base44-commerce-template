/**
 * seed-store default data: settings groups, payment gateways, tax classes and
 * the fallback shipping zone. All idempotent — the seeder checks for existing
 * records (by group_id / slug / name) before creating.
 */

/** Per-type email config keys. reset_password/new_account are handled by Base44 auth. */
const EMAIL_TYPE_DEFAULTS: Record<string, any> = {
  new_order: { enabled: true, subject: "", heading: "", recipient: "" },
  cancelled_order: { enabled: true, subject: "", heading: "", recipient: "" },
  failed_order: { enabled: true, subject: "", heading: "", recipient: "" },
  on_hold_order: { enabled: true, subject: "", heading: "" },
  processing_order: { enabled: true, subject: "", heading: "" },
  completed_order: { enabled: true, subject: "", heading: "" },
  refunded_order: { enabled: true, subject: "", heading: "" },
  partial_refund: { enabled: true, subject: "", heading: "" },
  customer_invoice: { enabled: true, subject: "", heading: "" },
  customer_note: { enabled: true, subject: "", heading: "" },
  reset_password: { enabled: true, managed_by: "base44_auth" },
  new_account: { enabled: true, managed_by: "base44_auth" },
};

export const SETTINGS_DEFAULTS: Array<{ group_id: string; values: Record<string, any> }> = [
  {
    group_id: "general",
    values: {
      store_name: "My Store",
      address: { address_1: "", address_2: "", city: "", state: "", postcode: "", country: "US" },
      selling_locations: "all",          // all | specific
      selling_countries: [],
      shipping_locations: "all",         // all | specific | disabled
      shipping_countries: [],
      default_customer_location: "base", // base | geolocation | none
      enable_taxes: true,
      enable_coupons: true,
      calc_discounts_sequentially: false,
      currency: "USD",
      currency_position: "left",         // left | right | left_space | right_space
      thousand_sep: ",",
      decimal_sep: ".",
      num_decimals: 2,
    },
  },
  {
    group_id: "products",
    values: {
      weight_unit: "kg",                 // kg | g | lbs | oz
      dimension_unit: "cm",              // m | cm | mm | in | yd
      enable_reviews: true,
      review_verified_owner_label: true,
      only_verified_reviews: false,
      review_rating_required: true,
      auto_approve_reviews: false,
    },
  },
  {
    group_id: "inventory",
    values: {
      manage_stock: true,
      hold_stock_minutes: 60,
      notify_low_stock: true,
      notify_out_of_stock: true,
      notification_recipient: "",
      low_stock_threshold: 2,
      out_of_stock_threshold: 0,
      hide_out_of_stock: false,
      stock_display_format: "",          // "" (always) | low_amount | no_amount
    },
  },
  {
    group_id: "downloadable",
    values: {
      downloads_require_login: false,
      grant_access_after_payment: true,
    },
  },
  {
    group_id: "tax",
    values: {
      prices_include_tax: false,
      tax_based_on: "shipping",          // shipping | billing | base
      shipping_tax_class: "inherit",     // inherit | standard | <class slug>
      round_at_subtotal: false,
      display_prices_shop: "excl",       // incl | excl
      display_prices_cart: "excl",
      price_display_suffix: "",
      display_tax_totals: "itemized",    // itemized | single
    },
  },
  {
    group_id: "shipping",
    values: {
      enable_shipping: true,
      hide_shipping_until_address: false,
      ship_to_destination: "shipping",   // shipping | billing | billing_only
    },
  },
  {
    group_id: "accounts",
    values: {
      guest_checkout: true,
      login_at_checkout: true,
      account_creation_at_checkout: true,
      account_creation_my_account: true,
    },
  },
  {
    group_id: "emails",
    values: {
      from_name: "My Store",
      from_address: "",
      admin_recipients: [],
      ...EMAIL_TYPE_DEFAULTS,
    },
  },
];

export const GATEWAY_DEFAULTS = [
  {
    slug: "bacs",
    title: "Direct bank transfer",
    description: "Make your payment directly into our bank account. Please use your Order ID as the payment reference.",
    enabled: true,
    order: 0,
    method_title: "Direct bank transfer",
    method_description: "Take payments in person via BACS. Orders are set on-hold until payment clears.",
    settings: { account_details: [] as any[] },
  },
  {
    slug: "cheque",
    title: "Check payments",
    description: "Please send a check to our store address.",
    enabled: false,
    order: 1,
    method_title: "Check payments",
    method_description: "Take payments by check. Orders are set on-hold until payment clears.",
    settings: {},
  },
  {
    slug: "cod",
    title: "Cash on delivery",
    description: "Pay with cash upon delivery.",
    enabled: true,
    order: 2,
    method_title: "Cash on delivery",
    method_description: "Have your customers pay with cash (or by other means) upon delivery.",
    settings: { enable_for_methods: [] as string[], enable_for_virtual: false },
  },
  {
    slug: "stripe",
    title: "Credit card (Stripe)",
    description: "Pay securely by credit card.",
    enabled: false,
    order: 3,
    method_title: "Stripe",
    method_description:
      "Placeholder — payment processing is not wired in this template. Connect the Base44 Stripe connector and implement the checkout charge flow. See implementation-guidelines.md §Stripe wiring.",
    settings: { connector: "stripe" },
  },
];

export const TAX_CLASS_DEFAULTS = [
  { slug: "standard", name: "Standard" },
  { slug: "reduced-rate", name: "Reduced rate" },
  { slug: "zero-rate", name: "Zero rate" },
];

export const REST_OF_WORLD_ZONE = {
  name: "Rest of the world",
  order: 999,
  locations: [] as any[],
};

/** Example (disabled) method attached to the fallback zone so admins see the pattern. */
export const REST_OF_WORLD_EXAMPLE_METHOD = {
  method_id: "flat_rate",
  title: "Flat rate",
  enabled: false,
  order: 0,
  settings: { cost: 0, tax_status: "taxable", class_costs: [], no_class_cost: 0, calculation_type: "class" },
};
