import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CountrySelect from "./CountrySelect";
import { statesFor } from "../lib/geo-data";

/**
 * Billing/shipping address editor (Order billing shape).
 * Props: { value, onChange, showEmail?, showPhone?, disabled? }
 */
export default function AddressForm({
  value = {},
  onChange,
  showEmail = false,
  showPhone = true,
  disabled = false,
}) {
  const set = (key) => (v) => onChange({ ...value, [key]: v });
  const setInput = (key) => (e) => set(key)(e.target.value);
  const states = statesFor(value.country);

  const field = (label, node) => (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {node}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {field("First name", <Input value={value.first_name || ""} onChange={setInput("first_name")} disabled={disabled} />)}
      {field("Last name", <Input value={value.last_name || ""} onChange={setInput("last_name")} disabled={disabled} />)}
      <div className="sm:col-span-2">
        {field("Company", <Input value={value.company || ""} onChange={setInput("company")} disabled={disabled} />)}
      </div>
      <div className="sm:col-span-2">
        {field("Address line 1", <Input value={value.address_1 || ""} onChange={setInput("address_1")} disabled={disabled} />)}
      </div>
      <div className="sm:col-span-2">
        {field("Address line 2", <Input value={value.address_2 || ""} onChange={setInput("address_2")} disabled={disabled} />)}
      </div>
      {field("City", <Input value={value.city || ""} onChange={setInput("city")} disabled={disabled} />)}
      {field("Postcode / ZIP", <Input value={value.postcode || ""} onChange={setInput("postcode")} disabled={disabled} />)}
      {field(
        "Country",
        <CountrySelect value={value.country || ""} onChange={(code) => onChange({ ...value, country: code, state: "" })} disabled={disabled} />
      )}
      {field(
        "State / Province",
        states ? (
          <Select value={value.state || ""} onValueChange={set("state")} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Select state…" />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input value={value.state || ""} onChange={setInput("state")} disabled={disabled} />
        )
      )}
      {showEmail && field("Email", <Input type="email" value={value.email || ""} onChange={setInput("email")} disabled={disabled} />)}
      {showPhone && field("Phone", <Input value={value.phone || ""} onChange={setInput("phone")} disabled={disabled} />)}
    </div>
  );
}
