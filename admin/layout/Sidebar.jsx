import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  BadgePercent,
  BarChart3,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Webhook,
} from "lucide-react";
import { call } from "../lib/api";
import { useAdminHref } from "../context/BasePathContext";

const NAV = [
  { items: [{ label: "Dashboard", path: "", icon: LayoutDashboard, end: true }] },
  {
    items: [
      { label: "Orders", path: "orders", icon: ShoppingCart, badge: "processing" },
      { label: "Customers", path: "customers", icon: Users },
      { label: "Reports", path: "reports", icon: BarChart3 },
    ],
  },
  {
    title: "Products",
    icon: Package,
    items: [
      { label: "All Products", path: "products", end: true },
      { label: "Categories", path: "products/categories" },
      { label: "Tags", path: "products/tags" },
      { label: "Attributes", path: "products/attributes" },
      { label: "Reviews", path: "products/reviews" },
    ],
  },
  {
    title: "Marketing",
    icon: BadgePercent,
    items: [{ label: "Coupons", path: "coupons" }],
  },
  {
    items: [{ label: "Settings", path: "settings", icon: Settings }],
  },
  {
    title: "Status",
    icon: Webhook,
    items: [{ label: "Webhooks", path: "webhooks" }],
  },
];

/** Left navigation. `onNavigate` closes the mobile sheet. */
export default function Sidebar({ onNavigate }) {
  const href = useAdminHref();
  const location = useLocation();
  const [processingCount, setProcessingCount] = useState(null);
  const lastFetch = useRef(0);

  // Non-blocking processing-orders badge; refresh at most every 15s on navigation.
  useEffect(() => {
    const now = Date.now();
    if (now - lastFetch.current < 15000) return;
    lastFetch.current = now;
    call("admin-orders", "status-counts", {}, { silent: true })
      .then((counts) => setProcessingCount(counts?.processing ?? 0))
      .catch(() => {});
  }, [location.pathname]);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-primary/10 font-medium text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Package className="h-5 w-5 text-primary" />
        <span className="font-semibold">Store Admin</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={href(item.path)}
                    end={item.end}
                    className={linkClass}
                    onClick={onNavigate}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{item.label}</span>
                    {item.badge === "processing" && processingCount > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5">
                        {processingCount}
                      </Badge>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
