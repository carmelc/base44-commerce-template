import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import useGroupForm from "./useGroupForm";

const DEFAULTS = {
  manage_stock: true,
  hold_stock_minutes: 60,
  low_stock_threshold: 2,
  out_of_stock_threshold: 0,
  notify_low_stock: true,
  notify_out_of_stock: true,
  notification_recipient: "",
  hide_out_of_stock: false,
};

export default function InventorySettings() {
  const { form, setField, dirty, saving, save } = useGroupForm("inventory", DEFAULTS);
  const off = !form.manage_stock;

  const num = (key, fallback = 0) => (e) =>
    setField(key, e.target.value === "" ? fallback : Number(e.target.value));

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Stock management defaults for products that track inventory.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Manage stock</Label>
              <p className="text-xs text-muted-foreground">Enable stock management store-wide.</p>
            </div>
            <Switch checked={!!form.manage_stock} onCheckedChange={(v) => setField("manage_stock", v)} />
          </div>

          <div className="space-y-1.5">
            <Label className={off ? "opacity-50" : ""}>Hold stock (minutes)</Label>
            <Input
              type="number"
              min={0}
              disabled={off}
              value={form.hold_stock_minutes ?? 60}
              onChange={num("hold_stock_minutes", 60)}
            />
            <p className="text-xs text-muted-foreground">
              Hold stock for unpaid orders for this many minutes. When the limit is reached, the
              pending order is cancelled and its stock released. Release runs opportunistically —
              see implementation-guidelines.md §Scheduled tasks.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={off ? "opacity-50" : ""}>Low stock threshold</Label>
              <Input
                type="number"
                min={0}
                disabled={off}
                value={form.low_stock_threshold ?? 2}
                onChange={num("low_stock_threshold", 2)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={off ? "opacity-50" : ""}>Out of stock threshold</Label>
              <Input
                type="number"
                disabled={off}
                value={form.out_of_stock_threshold ?? 0}
                onChange={num("out_of_stock_threshold", 0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <Label className={off ? "opacity-50" : ""}>Enable low stock notifications</Label>
            <Switch
              disabled={off}
              checked={!!form.notify_low_stock}
              onCheckedChange={(v) => setField("notify_low_stock", v)}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <Label className={off ? "opacity-50" : ""}>Enable out of stock notifications</Label>
            <Switch
              disabled={off}
              checked={!!form.notify_out_of_stock}
              onCheckedChange={(v) => setField("notify_out_of_stock", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={off ? "opacity-50" : ""}>Notification recipient</Label>
            <Input
              type="email"
              placeholder="Defaults to the admin recipients in Emails settings"
              disabled={off}
              value={form.notification_recipient || ""}
              onChange={(e) => setField("notification_recipient", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Hide out of stock items from the catalog</Label>
              <p className="text-xs text-muted-foreground">
                Storefront APIs will exclude out-of-stock products from listings.
              </p>
            </div>
            <Switch
              checked={!!form.hide_out_of_stock}
              onCheckedChange={(v) => setField("hide_out_of_stock", v)}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => save()} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
