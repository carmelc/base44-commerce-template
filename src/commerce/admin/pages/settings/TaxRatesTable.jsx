import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";

let tmpSeq = 0;
const tmpId = () => `tmp_${++tmpSeq}`;

const joinList = (arr) => (arr || []).join(", ");
const splitList = (text) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const newRow = (taxClass, order) => ({
  _tmpId: tmpId(),
  _state: "new",
  country: "",
  state: "",
  postcodes: [],
  cities: [],
  rate: 0,
  name: "Tax",
  priority: 1,
  compound: false,
  shipping: true,
  tax_class: taxClass,
  menu_order: order,
});

/**
 * Editable tax-rate grid for one tax class (Woo-style "Standard rates" table).
 * Tracks new / modified / deleted rows locally; "Save changes" batches the
 * TaxRate create/update/delete calls.
 */
export default function TaxRatesTable({ taxClass }) {
  const { data, loading, refetch } = useAsync(
    () => base44.entities["commerce.TaxRate"].filter({ tax_class: taxClass }, "menu_order", 500),
    [taxClass]
  );

  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows((data || []).map((r) => ({ ...r, _tmpId: r.id, _state: "clean" })));
  }, [data]);

  const setCell = (id, key, value) =>
    setRows((rs) =>
      rs.map((r) =>
        r._tmpId === id
          ? { ...r, [key]: value, _state: r._state === "new" ? "new" : "modified" }
          : r
      )
    );

  const removeRow = (id) =>
    setRows((rs) =>
      rs
        .map((r) => {
          if (r._tmpId !== id) return r;
          if (r._state === "new") return null;
          return { ...r, _state: r._state === "deleted" ? "modified" : "deleted" };
        })
        .filter(Boolean)
    );

  const insertRow = () => setRows((rs) => [...rs, newRow(taxClass, rs.length)]);

  const dirty = rows.some((r) => r._state !== "clean");

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const r of rows) {
        const payload = {
          country: (r.country || "").toUpperCase(),
          state: (r.state || "").toUpperCase(),
          postcodes: r.postcodes || [],
          cities: r.cities || [],
          rate: Number(r.rate) || 0,
          name: r.name || "Tax",
          priority: Number(r.priority) || 1,
          compound: !!r.compound,
          shipping: !!r.shipping,
          tax_class: taxClass,
          menu_order: rows.indexOf(r),
        };
        if (r._state === "new") await base44.entities["commerce.TaxRate"].create(payload);
        else if (r._state === "modified") await base44.entities["commerce.TaxRate"].update(r.id, payload);
        else if (r._state === "deleted") await base44.entities["commerce.TaxRate"].delete(r.id);
      }
      toast.success("Tax rates saved");
      await refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save tax rates");
    } finally {
      setSaving(false);
    }
  };

  const cell = (r, key, props = {}) => (
    <Input
      className="h-8"
      disabled={r._state === "deleted"}
      value={r[key] ?? ""}
      onChange={(e) => setCell(r._tmpId, key, e.target.value)}
      {...props}
    />
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-20">Country&nbsp;code</TableHead>
              <TableHead className="min-w-20">State&nbsp;code</TableHead>
              <TableHead className="min-w-32">Postcode / ZIP</TableHead>
              <TableHead className="min-w-32">City</TableHead>
              <TableHead className="min-w-24">Rate&nbsp;%</TableHead>
              <TableHead className="min-w-28">Tax name</TableHead>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead className="w-20 text-center">Compound</TableHead>
              <TableHead className="w-20 text-center">Shipping</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  No rates for this class yet. Insert a row to get started. Empty country/state
                  matches everywhere; postcodes support wildcards (90*) and ranges (1000...2000).
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._tmpId} className={r._state === "deleted" ? "opacity-50 line-through" : ""}>
                  <TableCell>{cell(r, "country", { placeholder: "*", maxLength: 2 })}</TableCell>
                  <TableCell>{cell(r, "state", { placeholder: "*" })}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      placeholder="*"
                      disabled={r._state === "deleted"}
                      value={joinList(r.postcodes)}
                      onChange={(e) => setCell(r._tmpId, "postcodes", splitList(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      placeholder="*"
                      disabled={r._state === "deleted"}
                      value={joinList(r.cities)}
                      onChange={(e) => setCell(r._tmpId, "cities", splitList(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>{cell(r, "rate", { type: "number", step: "any" })}</TableCell>
                  <TableCell>{cell(r, "name")}</TableCell>
                  <TableCell>{cell(r, "priority", { type: "number", min: 1 })}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      disabled={r._state === "deleted"}
                      checked={!!r.compound}
                      onCheckedChange={(v) => setCell(r._tmpId, "compound", !!v)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      disabled={r._state === "deleted"}
                      checked={!!r.shipping}
                      onCheckedChange={(v) => setCell(r._tmpId, "shipping", !!v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={r._state === "deleted" ? "Undo delete" : "Delete row"}
                      onClick={() => removeRow(r._tmpId)}
                    >
                      {r._state === "deleted" ? (
                        <Undo2 className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={insertRow}>
          <Plus className="mr-1 h-4 w-4" />
          Insert row
        </Button>
        <Button size="sm" onClick={saveAll} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
