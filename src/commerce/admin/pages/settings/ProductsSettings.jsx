import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { WEIGHT_UNITS, DIMENSION_UNITS } from "../../lib/constants";
import useGroupForm from "./useGroupForm";

const DEFAULTS = {
  weight_unit: "kg",
  dimension_unit: "cm",
  enable_reviews: true,
  review_rating_required: true,
  only_verified_reviews: false,
  auto_approve_reviews: false,
};

function SwitchRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function ProductsSettings() {
  const { form, setField, dirty, saving, save } = useGroupForm("products", DEFAULTS);

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Measurements</CardTitle>
          <CardDescription>Units used for product weight and dimensions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Weight unit</Label>
            <Select value={form.weight_unit} onValueChange={(v) => setField("weight_unit", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEIGHT_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dimensions unit</Label>
            <Select value={form.dimension_unit} onValueChange={(v) => setField("dimension_unit", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSION_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            label="Enable product reviews"
            checked={form.enable_reviews}
            onChange={(v) => setField("enable_reviews", v)}
          />
          <SwitchRow
            label="Star rating required"
            hint="Reviews submitted without a rating are rejected."
            checked={form.review_rating_required}
            onChange={(v) => setField("review_rating_required", v)}
          />
          <SwitchRow
            label="Reviews can only be left by verified owners"
            hint="Requires a completed order containing the product for the reviewer's email."
            checked={form.only_verified_reviews}
            onChange={(v) => setField("only_verified_reviews", v)}
          />
          <SwitchRow
            label="Auto-approve reviews"
            hint="When off, new reviews are held for moderation."
            checked={form.auto_approve_reviews}
            onChange={(v) => setField("auto_approve_reviews", v)}
          />
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
