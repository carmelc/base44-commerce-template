/** Shared enums, labels and badge colors for the admin UI. */

export const ORDER_STATUSES = [
  { value: "pending", label: "Pending payment", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "processing", label: "Processing", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "on-hold", label: "On hold", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "completed", label: "Completed", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "refunded", label: "Refunded", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "failed", label: "Failed", color: "bg-red-100 text-red-800 border-red-200" },
];

export const PRODUCT_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "pending", label: "Pending review", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "private", label: "Private", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "publish", label: "Published", color: "bg-green-100 text-green-800 border-green-200" },
];

export const PRODUCT_TYPES = [
  { value: "simple", label: "Simple product" },
  { value: "grouped", label: "Grouped product" },
  { value: "external", label: "External/Affiliate product" },
  { value: "variable", label: "Variable product" },
];

export const CATALOG_VISIBILITIES = [
  { value: "visible", label: "Shop and search results" },
  { value: "catalog", label: "Shop only" },
  { value: "search", label: "Search results only" },
  { value: "hidden", label: "Hidden" },
];

export const STOCK_STATUSES = [
  { value: "instock", label: "In stock", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "outofstock", label: "Out of stock", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "onbackorder", label: "On backorder", color: "bg-amber-100 text-amber-800 border-amber-200" },
];

export const BACKORDER_OPTIONS = [
  { value: "no", label: "Do not allow" },
  { value: "notify", label: "Allow, but notify customer" },
  { value: "yes", label: "Allow" },
];

export const TAX_STATUSES = [
  { value: "taxable", label: "Taxable" },
  { value: "shipping", label: "Shipping only" },
  { value: "none", label: "None" },
];

export const COUPON_TYPES = [
  { value: "percent", label: "Percentage discount" },
  { value: "fixed_cart", label: "Fixed cart discount" },
  { value: "fixed_product", label: "Fixed product discount" },
];

export const REVIEW_STATUSES = [
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "hold", label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "spam", label: "Spam", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "trash", label: "Trash", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

export const WEBHOOK_STATUSES = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "paused", label: "Paused", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "disabled", label: "Disabled", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

export const WEBHOOK_TOPICS = [
  "order.created", "order.updated", "order.deleted", "order.restored",
  "product.created", "product.updated", "product.deleted", "product.restored",
  "customer.created", "customer.updated", "customer.deleted",
  "coupon.created", "coupon.updated", "coupon.deleted",
];

export const SHIPPING_METHOD_TYPES = [
  { value: "flat_rate", label: "Flat rate" },
  { value: "free_shipping", label: "Free shipping" },
  { value: "local_pickup", label: "Local pickup" },
];

export const FREE_SHIPPING_REQUIRES = [
  { value: "", label: "No requirement" },
  { value: "coupon", label: "A valid free shipping coupon" },
  { value: "min_amount", label: "A minimum order amount" },
  { value: "either", label: "A minimum order amount OR a coupon" },
  { value: "both", label: "A minimum order amount AND a coupon" },
];

/**
 * The 11 transactional emails.
 * `recipient: "admin"` emails expose a Recipient override in the Emails settings.
 * `managed_by_auth` emails are handled by Base44 auth, not this template.
 */
export const EMAIL_TYPES = [
  { id: "new_order", label: "New order", recipient: "admin" },
  { id: "cancelled_order", label: "Cancelled order", recipient: "admin" },
  { id: "failed_order", label: "Failed order", recipient: "admin" },
  { id: "on_hold_order", label: "Order on-hold", recipient: "customer" },
  { id: "processing_order", label: "Processing order", recipient: "customer" },
  { id: "completed_order", label: "Completed order", recipient: "customer" },
  { id: "refunded_order", label: "Refunded order", recipient: "customer" },
  { id: "customer_invoice", label: "Customer invoice / Order details", recipient: "customer", manual: true },
  { id: "customer_note", label: "Customer note", recipient: "customer" },
  { id: "reset_password", label: "Reset password", recipient: "customer", managed_by_auth: true },
  { id: "new_account", label: "New account", recipient: "customer", managed_by_auth: true },
];

export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "GBP", name: "Pound Sterling", symbol: "£", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimals: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", decimals: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "$", decimals: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2 },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", decimals: 2 },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimals: 2 },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimals: 0 },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimals: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", decimals: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0 },
];

export const CURRENCY_POSITIONS = [
  { value: "left", label: "Left ($99.99)" },
  { value: "right", label: "Right (99.99$)" },
  { value: "left_space", label: "Left with space ($ 99.99)" },
  { value: "right_space", label: "Right with space (99.99 $)" },
];

export const WEIGHT_UNITS = ["kg", "g", "lbs", "oz"];
export const DIMENSION_UNITS = ["cm", "m", "mm", "in", "yd"];

export function statusMeta(list, value) {
  return list.find((s) => s.value === value) || { value, label: value || "—", color: "bg-gray-100 text-gray-700 border-gray-200" };
}
