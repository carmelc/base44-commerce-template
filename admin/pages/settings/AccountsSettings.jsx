import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import useGroupForm from "./useGroupForm";

const DEFAULTS = {
  guest_checkout: true,
  login_at_checkout: true,
  account_creation_at_checkout: true,
  account_creation_on_my_account: true,
  generate_username: true,
  generate_password: true,
  allow_erasure_requests: false,
};

const Toggle = ({ label, description, checked, onChange, disabled }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div className="space-y-0.5">
      <Label className="text-sm">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
    <Switch checked={!!checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
);

export default function AccountsSettings() {
  const { form, setField, dirty, saving, save } = useGroupForm("accounts", DEFAULTS);

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Guest &amp; account options</CardTitle>
          <CardDescription>Control how customers check out and create accounts.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Toggle
            label="Allow guest checkout"
            description="Let customers place orders without creating an account."
            checked={form.guest_checkout}
            onChange={(v) => setField("guest_checkout", !!v)}
          />
          <Toggle
            label="Allow login during checkout"
            checked={form.login_at_checkout}
            onChange={(v) => setField("login_at_checkout", !!v)}
          />
          <Toggle
            label="Allow account creation during checkout"
            checked={form.account_creation_at_checkout}
            onChange={(v) => setField("account_creation_at_checkout", !!v)}
          />
          <Toggle
            label="Allow account creation on the “My account” page"
            checked={form.account_creation_on_my_account}
            onChange={(v) => setField("account_creation_on_my_account", !!v)}
          />
          <Toggle
            label="Generate username from email"
            checked={form.generate_username}
            onChange={(v) => setField("generate_username", !!v)}
          />
          <Toggle
            label="Send set-password link for new accounts"
            description="Handled by Base44 auth when an account is created."
            checked={form.generate_password}
            onChange={(v) => setField("generate_password", !!v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>Data retention and erasure are enforced by your app; these flags are stored for your storefront to honor.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Toggle
            label="Allow customers to request erasure of personal data"
            checked={form.allow_erasure_requests}
            onChange={(v) => setField("allow_erasure_requests", !!v)}
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
