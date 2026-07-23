import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSettings } from "../../context/SettingsContext";
import { useAdminHref } from "../../context/BasePathContext";
import PageHeader from "../../components/PageHeader";

const TABS = [
  { seg: "general", label: "General" },
  { seg: "products", label: "Products" },
  { seg: "inventory", label: "Inventory" },
  { seg: "tax", label: "Tax" },
  { seg: "shipping", label: "Shipping" },
  { seg: "payments", label: "Payments" },
  { seg: "accounts", label: "Accounts" },
  { seg: "emails", label: "Emails" },
];

/** Layout route for /settings/*: horizontal group tabs + nested page via <Outlet/>. */
export default function SettingsLayout() {
  const { get } = useSettings();
  const href = useAdminHref();
  const navigate = useNavigate();
  const location = useLocation();

  // Current group segment: ".../settings/<seg>[/...]" (zone editor keeps "shipping" active).
  const afterSettings = location.pathname.split("/settings/")[1] || "general";
  const current = afterSettings.split("/")[0] || "general";

  const enableTaxes = get("general", "enable_taxes", true);
  const tabs = TABS.filter((t) => t.seg !== "tax" || enableTaxes);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Configure how your store works." />
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.seg}
            type="button"
            onClick={() => navigate(href(`settings/${t.seg}`))}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              current === t.seg
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
