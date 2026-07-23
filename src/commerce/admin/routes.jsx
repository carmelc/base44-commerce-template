import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PackageX } from "lucide-react";

import Dashboard from "./pages/Dashboard";
import OrdersList from "./pages/orders/OrdersList";
import OrderEditor from "./pages/orders/OrderEditor";
import ProductsList from "./pages/products/ProductsList";
import ProductEditor from "./pages/products/ProductEditor";
import Categories from "./pages/products/Categories";
import Tags from "./pages/products/Tags";
import Attributes from "./pages/products/Attributes";
import AttributeTerms from "./pages/products/AttributeTerms";
import Reviews from "./pages/products/Reviews";
import CouponsList from "./pages/coupons/CouponsList";
import CouponEditor from "./pages/coupons/CouponEditor";
import CustomersList from "./pages/customers/CustomersList";
import CustomerEditor from "./pages/customers/CustomerEditor";
import Reports from "./pages/reports/Reports";
import SettingsLayout from "./pages/settings/SettingsLayout";
import GeneralSettings from "./pages/settings/GeneralSettings";
import ProductsSettings from "./pages/settings/ProductsSettings";
import InventorySettings from "./pages/settings/InventorySettings";
import TaxSettings from "./pages/settings/TaxSettings";
import ShippingSettings from "./pages/settings/ShippingSettings";
import ShippingZoneEditor from "./pages/settings/ShippingZoneEditor";
import PaymentsSettings from "./pages/settings/PaymentsSettings";
import AccountsSettings from "./pages/settings/AccountsSettings";
import EmailsSettings from "./pages/settings/EmailsSettings";
import Webhooks from "./pages/status/Webhooks";
import WebhookEditor from "./pages/status/WebhookEditor";

/**
 * Internal route table (paths relative to the mount point).
 * Used by the router below and by Topbar breadcrumbs.
 */
export const ADMIN_ROUTES = [
  { path: "", label: "Dashboard" },
  { path: "orders", label: "Orders" },
  { path: "orders/new", label: "Add order" },
  { path: "orders/:id", label: "Order" },
  { path: "products", label: "Products" },
  { path: "products/new", label: "Add product" },
  { path: "products/categories", label: "Categories" },
  { path: "products/tags", label: "Tags" },
  { path: "products/attributes", label: "Attributes" },
  { path: "products/attributes/:id/terms", label: "Terms" },
  { path: "products/reviews", label: "Reviews" },
  { path: "products/:id", label: "Edit product" },
  { path: "coupons", label: "Coupons" },
  { path: "coupons/new", label: "Add coupon" },
  { path: "coupons/:id", label: "Edit coupon" },
  { path: "customers", label: "Customers" },
  { path: "customers/new", label: "Add customer" },
  { path: "customers/:id", label: "Customer" },
  { path: "reports", label: "Reports" },
  { path: "settings", label: "Settings" },
  { path: "settings/general", label: "General" },
  { path: "settings/products", label: "Products" },
  { path: "settings/inventory", label: "Inventory" },
  { path: "settings/tax", label: "Tax" },
  { path: "settings/shipping", label: "Shipping" },
  { path: "settings/shipping/zones/:zoneId", label: "Shipping zone" },
  { path: "settings/payments", label: "Payments" },
  { path: "settings/accounts", label: "Accounts" },
  { path: "settings/emails", label: "Emails" },
  { path: "webhooks", label: "Webhooks" },
  { path: "webhooks/new", label: "Add webhook" },
  { path: "webhooks/:id", label: "Webhook" },
];

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <PackageX className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground">This admin page does not exist.</p>
    </div>
  );
}

/** All admin routes. Rendered inside AdminLayout; mount AdminApp at `/admin/*`. */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />

      <Route path="orders" element={<OrdersList />} />
      <Route path="orders/new" element={<OrderEditor />} />
      <Route path="orders/:id" element={<OrderEditor />} />

      <Route path="products" element={<ProductsList />} />
      <Route path="products/new" element={<ProductEditor />} />
      <Route path="products/categories" element={<Categories />} />
      <Route path="products/tags" element={<Tags />} />
      <Route path="products/attributes" element={<Attributes />} />
      <Route path="products/attributes/:id/terms" element={<AttributeTerms />} />
      <Route path="products/reviews" element={<Reviews />} />
      <Route path="products/:id" element={<ProductEditor />} />

      <Route path="coupons" element={<CouponsList />} />
      <Route path="coupons/new" element={<CouponEditor />} />
      <Route path="coupons/:id" element={<CouponEditor />} />

      <Route path="customers" element={<CustomersList />} />
      <Route path="customers/new" element={<CustomerEditor />} />
      <Route path="customers/:id" element={<CustomerEditor />} />

      <Route path="reports" element={<Reports />} />

      <Route path="settings" element={<SettingsLayout />}>
        <Route index element={<Navigate to="general" replace />} />
        <Route path="general" element={<GeneralSettings />} />
        <Route path="products" element={<ProductsSettings />} />
        <Route path="inventory" element={<InventorySettings />} />
        <Route path="tax" element={<TaxSettings />} />
        <Route path="shipping" element={<ShippingSettings />} />
        <Route path="shipping/zones/:zoneId" element={<ShippingZoneEditor />} />
        <Route path="payments" element={<PaymentsSettings />} />
        <Route path="accounts" element={<AccountsSettings />} />
        <Route path="emails" element={<EmailsSettings />} />
      </Route>

      <Route path="webhooks" element={<Webhooks />} />
      <Route path="webhooks/new" element={<WebhookEditor />} />
      <Route path="webhooks/:id" element={<WebhookEditor />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
