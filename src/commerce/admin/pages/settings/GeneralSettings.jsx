import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import CountrySelect from "../../components/CountrySelect";
import SearchSelect from "../../components/SearchSelect";
import { COUNTRIES, countryName, statesFor } from "../../lib/geo-data";
import { CURRENCIES, CURRENCY_POSITIONS } from "../../lib/constants";
import useGroupForm from "./useGroupForm";

const DEFAULTS = {
  store_name: "My Store",
  address: { address_1: "", address_2: "", city: "", state: "", postcode: "", country: "US" },
  selling_locations: "all",
  selling_countries: [],
  shipping_locations: "all",
  shipping_countries: [],
  default_customer_location: "base",
  enable_taxes: true,
  enable_coupons: true,
  calc_discounts_sequentially: false,
  currency: "USD",
  currency_position: "left",
  thousand_sep: ",",
  decimal_sep: ".",
  num_decimals: 2,
};

const searchCountries = async (q) =>
  COUNTRIES.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.code.toLowerCase() === q.toLowerCase()
  )
    .slice(0, 50)
    .map((c) => ({ value: c.code, label: c.name }));

const toOptions = (codes) => (codes || []).map((code) => ({ value: code, label: countryName(code) }));

export default function GeneralSettings() {
  const { form, setField, dirty, saving, save } = useGroupForm("general", DEFAULTS);
  const address = form.address || DEFAULTS.address;
  const states = statesFor(address.country);

  const setAddress = (key, value) => setField("address", { ...address, [key]: value });

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Store details</CardTitle>
          <CardDescription>This is where your business is located. Tax rates and shipping rates use this address.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Store name</Label>
            <Input value={form.store_name || ""} onChange={(e) => setField("store_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Address line 1</Label>
            <Input value={address.address_1 || ""} onChange={(e) => setAddress("address_1", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Address line 2</Label>
            <Input value={address.address_2 || ""} onChange={(e) => setAddress("address_2", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={address.city || ""} onChange={(e) => setAddress("city", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Postcode / ZIP</Label>
            <Input value={address.postcode || ""} onChange={(e) => setAddress("postcode", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <CountrySelect
              value={address.country}
              onChange={(code) => setField("address", { ...address, country: code, state: "" })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>State / Province</Label>
            {states ? (
              <Select value={address.state || ""} onValueChange={(v) => setAddress("state", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state…" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((st) => (
                    <SelectItem key={st.code} value={st.code}>
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={address.state || ""} onChange={(e) => setAddress("state", e.target.value)} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selling &amp; shipping locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Selling location(s)</Label>
            <Select value={form.selling_locations} onValueChange={(v) => setField("selling_locations", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sell to all countries</SelectItem>
                <SelectItem value="specific">Sell to specific countries</SelectItem>
              </SelectContent>
            </Select>
            {form.selling_locations === "specific" && (
              <SearchSelect
                multiple
                placeholder="Choose countries…"
                search={searchCountries}
                value={toOptions(form.selling_countries)}
                onChange={(opts) => setField("selling_countries", (opts || []).map((o) => o.value))}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Shipping location(s)</Label>
            <Select value={form.shipping_locations} onValueChange={(v) => setField("shipping_locations", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ship to all countries you sell to</SelectItem>
                <SelectItem value="specific">Ship to specific countries only</SelectItem>
                <SelectItem value="disabled">Disable shipping &amp; shipping calculations</SelectItem>
              </SelectContent>
            </Select>
            {form.shipping_locations === "specific" && (
              <SearchSelect
                multiple
                placeholder="Choose countries…"
                search={searchCountries}
                value={toOptions(form.shipping_countries)}
                onChange={(opts) => setField("shipping_countries", (opts || []).map((o) => o.value))}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Default customer location</Label>
            <Select
              value={form.default_customer_location}
              onValueChange={(v) => setField("default_customer_location", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location by default</SelectItem>
                <SelectItem value="base">Shop base address</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!form.enable_taxes}
                onCheckedChange={(v) => setField("enable_taxes", !!v)}
              />
              Enable tax rates and calculations
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!form.enable_coupons}
                onCheckedChange={(v) => setField("enable_coupons", !!v)}
              />
              Enable the use of coupon codes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!form.calc_discounts_sequentially}
                onCheckedChange={(v) => setField("calc_discounts_sequentially", !!v)}
              />
              Calculate coupon discounts sequentially
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency options</CardTitle>
          <CardDescription>Affects how prices are displayed in the admin and by storefront APIs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Currency position</Label>
            <Select value={form.currency_position} onValueChange={(v) => setField("currency_position", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Thousand separator</Label>
            <Input
              value={form.thousand_sep ?? ","}
              maxLength={1}
              onChange={(e) => setField("thousand_sep", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Decimal separator</Label>
            <Input
              value={form.decimal_sep ?? "."}
              maxLength={1}
              onChange={(e) => setField("decimal_sep", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Number of decimals</Label>
            <Input
              type="number"
              min={0}
              max={4}
              value={form.num_decimals ?? 2}
              onChange={(e) => setField("num_decimals", e.target.value === "" ? 2 : Number(e.target.value))}
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
