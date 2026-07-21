import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { call } from "../../../lib/api";
import SearchSelect from "../../../components/SearchSelect";
import { formatDate } from "../../../lib/format";

/**
 * Downloadable product access for an order: grant / revoke rows.
 * Props: { orderId, permissions, loading, onChanged() }
 */
export default function DownloadPermissionsPanel({ orderId, permissions, loading, onChanged }) {
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  const searchDownloadable = async (q) => {
    const data = await call("admin-products", "search", { q, limit: 20 }, { silent: true });
    const rows = data?.rows || data || [];
    return rows
      .filter((p) => p.downloadable)
      .map((p) => ({ value: p.id, label: p.name, meta: p.sku ? `SKU: ${p.sku}` : undefined }));
  };

  const grant = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await call("admin-orders", "grant-download", { order_id: orderId, product_id: picked.value });
      toast.success("Download access granted");
      setPicked(null);
      onChanged();
    } catch {
      /* toast handled by call() */
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (permissionId) => {
    try {
      await call("admin-orders", "revoke-download", { order_id: orderId, permission_id: permissionId });
      toast.success("Download access revoked");
      onChanged();
    } catch {
      /* toast handled by call() */
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Downloadable product permissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (permissions || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No download permissions on this order.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="w-32 text-right">Remaining</TableHead>
                <TableHead className="w-32">Expires</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.download_name || p.file_url || p.product_id}</TableCell>
                  <TableCell className="text-right text-sm">
                    {p.downloads_remaining === -1 ? "∞" : p.downloads_remaining}
                    <span className="text-xs text-muted-foreground"> (used {p.download_count || 0})</span>
                  </TableCell>
                  <TableCell className="text-sm">{p.access_expires ? formatDate(p.access_expires) : "Never"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => revoke(p.id)} title="Revoke">
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-end gap-2 border-t pt-3">
          <div className="flex-1">
            <SearchSelect
              search={searchDownloadable}
              value={picked}
              onChange={setPicked}
              placeholder="Search downloadable products…"
            />
          </div>
          <Button size="sm" onClick={grant} disabled={!picked || busy}>
            {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Grant access
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
