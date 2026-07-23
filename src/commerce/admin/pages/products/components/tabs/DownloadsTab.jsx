import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

import MediaUploader from "../../../../components/MediaUploader";

const num = (v, fallback) => (v === "" ? fallback : Number(v));

/** Downloadable files, download limit and expiry. */
export default function DownloadsTab({ product, up }) {
  const downloads = product.downloads || [];

  const setRow = (i, patch) =>
    up({ downloads: downloads.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-3">
        <Label>Downloadable files</Label>
        {downloads.map((d, i) => (
          <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. User manual"
                value={d.name || ""}
                onChange={(e) => setRow(i, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File</Label>
              {d.file_url ? (
                <div className="flex items-center gap-2">
                  <Input value={d.file_url} onChange={(e) => setRow(i, { file_url: e.target.value })} />
                </div>
              ) : (
                <MediaUploader
                  accept="*/*"
                  label="Upload file"
                  value={null}
                  onChange={(img) => img && setRow(i, { file_url: img.src, name: d.name || img.name })}
                />
              )}
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => up({ downloads: downloads.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => up({ downloads: [...downloads, { name: "", file_url: "" }] })}
        >
          <Plus className="mr-1 h-4 w-4" /> Add file
        </Button>
      </div>

      <div className="grid max-w-md grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Download limit</Label>
          <Input
            type="number"
            value={product.download_limit ?? -1}
            onChange={(e) => up({ download_limit: num(e.target.value, -1) })}
          />
          <p className="text-xs text-muted-foreground">-1 for unlimited downloads.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Download expiry (days)</Label>
          <Input
            type="number"
            value={product.download_expiry ?? -1}
            onChange={(e) => up({ download_expiry: num(e.target.value, -1) })}
          />
          <p className="text-xs text-muted-foreground">-1 for no expiry.</p>
        </div>
      </div>
    </div>
  );
}
