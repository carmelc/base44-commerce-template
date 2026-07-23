import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";

import { base44, call } from "../../../../lib/api";
import SearchSelect from "../../../../components/SearchSelect";
import { isGrouped } from "../../../../lib/product-utils";

/** Search products server-side for the pickers. */
const searchProducts = async (q) => {
  const data = await call("admin-products", "search", { q: q || undefined, limit: 10 }, { silent: true });
  const rows = data?.rows || data || [];
  return rows.map((p) => ({ value: p.id, label: p.name, meta: p.sku || undefined }));
};

/**
 * Multi product picker bound to an array of product ids.
 * Resolves labels for pre-existing ids on mount.
 */
function ProductIdsPicker({ ids, onChange, placeholder }) {
  const [options, setOptions] = useState(null); // [{value,label}]

  useEffect(() => {
    let cancelled = false;
    const known = new Map((options || []).map((o) => [o.value, o]));
    const missing = (ids || []).filter((id) => !known.has(id));
    if (!missing.length) {
      if (options === null) setOptions([]);
      return;
    }
    Promise.all(
      missing.map((id) =>
        base44.entities["commerce.Product"].get(id)
          .then((p) => ({ value: id, label: p?.name || "(deleted product)" }))
          .catch(() => ({ value: id, label: "(deleted product)" }))
      )
    ).then((resolved) => {
      if (!cancelled) setOptions([...(options || []), ...resolved]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ids)]);

  const value = (ids || []).map(
    (id) => (options || []).find((o) => o.value === id) || { value: id, label: "…" }
  );

  return (
    <SearchSelect
      multiple
      placeholder={placeholder}
      search={searchProducts}
      value={value}
      onChange={(next) => {
        setOptions(next);
        onChange(next.map((o) => o.value));
      }}
    />
  );
}

/** Upsells, cross-sells and (for grouped products) child products. */
export default function LinkedTab({ product, up }) {
  return (
    <div className="max-w-md space-y-4">
      {isGrouped(product) && (
        <div className="space-y-1.5">
          <Label>Grouped products</Label>
          <ProductIdsPicker
            ids={product.grouped_products}
            onChange={(grouped_products) => up({ grouped_products })}
            placeholder="Search for products to group…"
          />
          <p className="text-xs text-muted-foreground">Products shown as part of this grouped product.</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Upsells</Label>
        <ProductIdsPicker
          ids={product.upsell_ids}
          onChange={(upsell_ids) => up({ upsell_ids })}
          placeholder="Search for products to upsell…"
        />
        <p className="text-xs text-muted-foreground">
          Recommended instead of this product, e.g. premium alternatives.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Cross-sells</Label>
        <ProductIdsPicker
          ids={product.cross_sell_ids}
          onChange={(cross_sell_ids) => up({ cross_sell_ids })}
          placeholder="Search for products to cross-sell…"
        />
        <p className="text-xs text-muted-foreground">Promoted in the cart alongside this product.</p>
      </div>
    </div>
  );
}
