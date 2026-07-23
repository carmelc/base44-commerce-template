import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

/**
 * Key/value editor for `meta_data` arrays.
 * Props: { value: [{key, value}], onChange }
 */
export default function MetaDataEditor({ value = [], onChange }) {
  const setRow = (i, field, v) => {
    const next = value.map((row, idx) => (idx === i ? { ...row, [field]: v } : row));
    onChange(next);
  };

  const removeRow = (i) => onChange(value.filter((_, idx) => idx !== i));
  const addRow = () => onChange([...(value || []), { key: "", value: "" }]);

  return (
    <div className="space-y-2">
      {(value || []).map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="Key"
            value={row.key || ""}
            onChange={(e) => setRow(i, "key", e.target.value)}
            className="w-1/3"
          />
          <Input
            placeholder="Value"
            value={row.value || ""}
            onChange={(e) => setRow(i, "value", e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRow(i)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1 h-4 w-4" /> Add field
      </Button>
    </div>
  );
}
