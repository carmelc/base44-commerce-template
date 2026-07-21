import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { PRODUCT_TYPES } from "../../../lib/constants";
import { isSimple, isGrouped, isExternal, isVariable } from "../../../lib/product-utils";
import GeneralTab from "./tabs/GeneralTab";
import ExternalTab from "./tabs/ExternalTab";
import InventoryTab from "./tabs/InventoryTab";
import ShippingTab from "./tabs/ShippingTab";
import LinkedTab from "./tabs/LinkedTab";
import AttributesTab from "./tabs/AttributesTab";
import VariationsTab from "./tabs/VariationsTab";
import DownloadsTab from "./tabs/DownloadsTab";
import AdvancedTab from "./tabs/AdvancedTab";

/**
 * The WooCommerce-style "Product data" panel: type selector + vertical tabs.
 * Tab visibility follows the product type / virtual / downloadable flags.
 */
export default function ProductDataPanel({ product, up, refs, variations, setVariations }) {
  const tabs = useMemo(() => {
    const list = [];
    if (!isGrouped(product)) list.push({ id: "general", label: "General" });
    list.push({ id: "inventory", label: "Inventory" });
    if (!product.virtual && !isExternal(product)) list.push({ id: "shipping", label: "Shipping" });
    list.push({ id: "linked", label: "Linked products" });
    list.push({ id: "attributes", label: "Attributes" });
    if (isVariable(product)) list.push({ id: "variations", label: "Variations" });
    if (product.downloadable && !isGrouped(product) && !isExternal(product))
      list.push({ id: "downloads", label: "Downloads" });
    list.push({ id: "advanced", label: "Advanced" });
    return list;
  }, [product]);

  const [active, setActive] = useState("general");
  const activeTab = tabs.some((t) => t.id === active) ? active : tabs[0].id;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4 space-y-0 border-b py-3">
        <span className="text-base font-semibold">Product data</span>
        <Select value={product.type} onValueChange={(type) => up({ type })}>
          <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSimple(product) && (
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={product.virtual}
                onCheckedChange={(v) => up({ virtual: Boolean(v) })}
              />
              Virtual
            </label>
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={product.downloadable}
                onCheckedChange={(v) => up({ downloadable: Boolean(v) })}
              />
              Downloadable
            </label>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex min-h-72 flex-col sm:flex-row">
          {/* Vertical tab nav */}
          <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b bg-muted/40 p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  activeTab === t.id
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-background/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 p-4">
            {activeTab === "general" &&
              (isExternal(product) ? (
                <ExternalTab product={product} up={up} refs={refs} />
              ) : (
                <GeneralTab product={product} up={up} refs={refs} />
              ))}
            {activeTab === "inventory" && <InventoryTab product={product} up={up} />}
            {activeTab === "shipping" && <ShippingTab product={product} up={up} refs={refs} />}
            {activeTab === "linked" && <LinkedTab product={product} up={up} />}
            {activeTab === "attributes" && <AttributesTab product={product} up={up} refs={refs} />}
            {activeTab === "variations" && (
              <VariationsTab
                product={product}
                up={up}
                refs={refs}
                variations={variations}
                setVariations={setVariations}
              />
            )}
            {activeTab === "downloads" && <DownloadsTab product={product} up={up} />}
            {activeTab === "advanced" && <AdvancedTab product={product} up={up} />}
          </div>
        </div>
        <Separator />
        <div className="px-4 py-2 text-xs text-muted-foreground">
          Type: {PRODUCT_TYPES.find((t) => t.value === product.type)?.label}
          {product.virtual ? " · Virtual" : ""}
          {product.downloadable ? " · Downloadable" : ""}
        </div>
      </CardContent>
    </Card>
  );
}
