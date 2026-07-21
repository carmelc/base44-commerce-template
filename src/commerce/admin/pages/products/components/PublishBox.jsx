import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Trash2 } from "lucide-react";

import ConfirmDialog from "../../../components/ConfirmDialog";
import { PRODUCT_STATUSES, CATALOG_VISIBILITIES } from "../../../lib/constants";

/**
 * Product editor "Publish" sidebar box.
 * Props: { product, up, onSave, onDelete (null hides delete), saving, dirty }
 */
export default function PublishBox({ product, up, onSave, onDelete, saving, dirty }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Publish</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={product.status || "draft"} onValueChange={(v) => up({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUCT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Catalog visibility</Label>
          <Select
            value={product.catalog_visibility || "visible"}
            onValueChange={(v) => up({ catalog_visibility: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATALOG_VISIBILITIES.map((v) => (
                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(product.featured)}
            onCheckedChange={(c) => up({ featured: Boolean(c) })}
          />
          Featured product
        </label>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={onSave} disabled={saving || !dirty} className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          {onDelete && (
            <Button variant="outline" size="icon" onClick={() => setConfirm(true)} title="Delete product">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirm}
        onOpenChange={(o) => !o && setConfirm(false)}
        title="Delete this product?"
        description="This permanently deletes the product and its variations."
        confirmLabel="Delete"
        onConfirm={doDelete}
        loading={deleting}
      />
    </Card>
  );
}
