import React from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * Description editor. Persists plain text / HTML as-is.
 * Deliberately a plain textarea to avoid a WYSIWYG dependency — swap in your
 * editor of choice (e.g. TipTap) here if you need rich editing.
 *
 * Props: { value, onChange(string), rows?, placeholder? }
 */
export default function RichTextarea({ value, onChange, rows = 6, placeholder }) {
  return (
    <Textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="font-mono text-sm"
    />
  );
}
