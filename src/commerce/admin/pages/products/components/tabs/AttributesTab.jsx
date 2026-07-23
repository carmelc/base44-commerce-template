import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Plus, Trash2 } from "lucide-react";

import { base44 } from "../../../../lib/api";
import SearchSelect from "../../../../components/SearchSelect";
import { isVariable } from "../../../../lib/product-utils";

const CUSTOM = "__custom__";

/**
 * Assign global attributes (with term multi-select) or ad-hoc custom
 * attributes ("Red | Blue | Green"). `variation: true` rows drive the
 * Variations tab for variable products.
 */
export default function AttributesTab({ product, up, refs }) {
  const globalAttributes = refs.attributes || [];
  const attributes = product.attributes || [];
  const [addValue, setAddValue] = useState("");
  const [termsCache, setTermsCache] = useState({}); // attribute_id -> [{id, name}]

  // Load terms for every global attribute in use.
  useEffect(() => {
    const wanted = attributes.map((a) => a.attribute_id).filter(Boolean);
    const missing = wanted.filter((id) => !termsCache[id]);
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        base44.entities["commerce.ProductAttributeTerm"].filter({ attribute_id: id }, "menu_order", 500)
          .then((terms) => [id, terms || []])
          .catch(() => [id, []])
      )
    ).then((entries) => {
      if (!cancelled) setTermsCache((c) => ({ ...c, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(attributes.map((a) => a.attribute_id))]);

  const setRow = (index, patch) => {
    const next = attributes.map((a, i) => (i === index ? { ...a, ...patch } : a));
    up({ attributes: next });
  };

  const removeRow = (index) => {
    up({ attributes: attributes.filter((_, i) => i !== index) });
  };

  const addAttribute = () => {
    if (!addValue) return;
    if (addValue === CUSTOM) {
      up({
        attributes: [
          ...attributes,
          { attribute_id: "", name: "", position: attributes.length, visible: true, variation: false, options: [] },
        ],
      });
    } else {
      const attr = globalAttributes.find((a) => a.id === addValue);
      if (!attr || attributes.some((a) => a.attribute_id === attr.id)) return;
      up({
        attributes: [
          ...attributes,
          {
            attribute_id: attr.id,
            name: attr.name,
            position: attributes.length,
            visible: true,
            variation: false,
            options: [],
          },
        ],
      });
    }
    setAddValue("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label>Add attribute</Label>
          <Select value={addValue} onValueChange={setAddValue}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select an attribute…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM}>Custom product attribute</SelectItem>
              {globalAttributes
                .filter((a) => !attributes.some((row) => row.attribute_id === a.id))
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={addAttribute} disabled={!addValue}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {attributes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No attributes yet. Attributes describe the product (e.g. Color, Size) and can power variations.
        </p>
      )}

      <div className="space-y-3">
        {attributes.map((row, i) => {
          const isGlobal = Boolean(row.attribute_id);
          const terms = termsCache[row.attribute_id] || [];
          return (
            <Card key={`${row.attribute_id || "custom"}-${i}`} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    {isGlobal ? (
                      <>
                        <span className="font-medium">{row.name}</span>
                        <Badge variant="secondary" className="gap-1">
                          <Globe className="h-3 w-3" /> Global
                        </Badge>
                      </>
                    ) : (
                      <Input
                        className="h-8 w-56"
                        placeholder="Attribute name (e.g. Material)"
                        value={row.name}
                        onChange={(e) => setRow(i, { name: e.target.value })}
                      />
                    )}
                  </div>

                  {isGlobal ? (
                    <SearchSelect
                      multiple
                      placeholder="Select terms…"
                      value={(row.options || []).map((o) => ({ value: o, label: o }))}
                      onChange={(next) => setRow(i, { options: next.map((o) => o.value) })}
                      search={async (q) =>
                        terms
                          .filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()))
                          .map((t) => ({ value: t.name, label: t.name }))
                      }
                    />
                  ) : (
                    <div className="space-y-1">
                      <Input
                        placeholder="Values separated by | (e.g. Cotton | Wool | Silk)"
                        value={(row.options || []).join(" | ")}
                        onChange={(e) =>
                          setRow(i, {
                            options: e.target.value
                              .split("|")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">Separate values with “|”.</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <Checkbox
                        checked={row.visible !== false}
                        onCheckedChange={(v) => setRow(i, { visible: Boolean(v) })}
                      />
                      Visible on the product page
                    </label>
                    {isVariable(product) && (
                      <label className="flex items-center gap-1.5">
                        <Checkbox
                          checked={Boolean(row.variation)}
                          onCheckedChange={(v) => setRow(i, { variation: Boolean(v) })}
                        />
                        Used for variations
                      </label>
                    )}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
