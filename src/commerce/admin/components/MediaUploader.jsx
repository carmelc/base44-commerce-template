import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "../lib/api";

/** Upload a file via the Core integration; returns the public URL. */
export async function uploadFile(file) {
  const res = await base44.integrations.Core.UploadFile({ file });
  return res?.file_url || res?.data?.file_url;
}

/**
 * Image uploader.
 *
 * Single mode (multiple=false): value = {src, name, alt} | null
 * Gallery mode (multiple=true): value = [{src, name, alt}], reorder via up/down
 *
 * Props: { value, onChange, multiple?, accept?, label? }
 */
export default function MediaUploader({
  value,
  onChange,
  multiple = false,
  accept = "image/*",
  label = multiple ? "Add images" : "Set image",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const items = multiple ? value || [] : value ? [value] : [];

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const src = await uploadFile(file);
        if (src) uploaded.push({ src, name: file.name, alt: "" });
      }
      if (multiple) onChange([...(value || []), ...uploaded]);
      else onChange(uploaded[0] || null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (i) => {
    if (multiple) onChange(items.filter((_, idx) => idx !== i));
    else onChange(null);
  };

  const move = (i, dir) => {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className={multiple ? "grid grid-cols-3 gap-2" : ""}>
          {items.map((img, i) => (
            <div key={`${img.src}-${i}`} className="group relative overflow-hidden rounded-md border">
              <img
                src={img.src}
                alt={img.alt || img.name || ""}
                className={`w-full object-cover ${multiple ? "aspect-square" : "max-h-56"}`}
              />
              <div className="absolute inset-x-0 top-0 flex justify-end gap-0.5 bg-gradient-to-b from-black/50 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {multiple && (
                  <>
                    <Button type="button" size="icon" variant="secondary" className="h-6 w-6" onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button type="button" size="icon" variant="secondary" className="h-6 w-6" onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button type="button" size="icon" variant="destructive" className="h-6 w-6" onClick={() => removeAt(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full"
      >
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}
