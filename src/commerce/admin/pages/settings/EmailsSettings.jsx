import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Settings2 } from "lucide-react";
import { EMAIL_TYPES } from "../../lib/constants";
import useGroupForm from "./useGroupForm";

const DEFAULTS = {
  from_name: "My Store",
  from_address: "",
  admin_recipients: [],
  types: {},
};

export default function EmailsSettings() {
  const { form, setField, dirty, saving, save } = useGroupForm("emails", DEFAULTS);
  const [activeId, setActiveId] = useState(null);

  const types = form.types || {};
  const typeCfg = (id) => types[id] || {};
  const isEnabled = (id) => typeCfg(id).enabled !== false;

  const setTypeField = (id, key, value) =>
    setField("types", { ...types, [id]: { ...typeCfg(id), [key]: value } });

  const recipientsText = (form.admin_recipients || []).join(", ");
  const setRecipients = (text) =>
    setField(
      "admin_recipients",
      text.split(",").map((s) => s.trim()).filter(Boolean)
    );

  const active = activeId ? EMAIL_TYPES.find((e) => e.id === activeId) : null;

  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sender options</CardTitle>
          <CardDescription>The name and address transactional emails are sent from.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>“From” name</Label>
            <Input value={form.from_name || ""} onChange={(e) => setField("from_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>“From” address</Label>
            <Input type="email" value={form.from_address || ""} onChange={(e) => setField("from_address", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Admin notification recipients</Label>
            <Input
              value={recipientsText}
              placeholder="admin@example.com, ops@example.com"
              onChange={(e) => setRecipients(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated. Receives new/cancelled/failed order emails.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
          <CardDescription>Enable, disable and customize each transactional email.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="w-24">Enabled</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {EMAIL_TYPES.map((e) => {
                const managed = !!e.managed_by_auth;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.label}</span>
                        {e.manual && <Badge variant="outline" className="font-normal">Manual</Badge>}
                        {managed && (
                          <Badge variant="secondary" className="font-normal text-muted-foreground">
                            Handled by Base44 auth
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {managed
                        ? "—"
                        : e.recipient === "admin"
                        ? typeCfg(e.id).recipient || recipientsText || "Admin"
                        : "Customer"}
                    </TableCell>
                    <TableCell>
                      {managed ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Switch checked={isEnabled(e.id)} onCheckedChange={(v) => setTypeField(e.id, "enabled", !!v)} />
                      )}
                    </TableCell>
                    <TableCell>
                      {!managed && (
                        <Button variant="ghost" size="sm" onClick={() => setActiveId(e.id)}>
                          <Settings2 className="mr-2 h-4 w-4" />
                          Manage
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => save()} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>

      {active && (
        <Dialog open onOpenChange={(o) => !o && setActiveId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{active.label} email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {active.recipient === "admin" && (
                <div className="space-y-1.5">
                  <Label>Recipient(s)</Label>
                  <Input
                    placeholder="Leave blank to use the default admin recipients"
                    value={typeCfg(active.id).recipient || ""}
                    onChange={(e) => setTypeField(active.id, "recipient", e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  placeholder="Leave blank for the default"
                  value={typeCfg(active.id).subject || ""}
                  onChange={(e) => setTypeField(active.id, "subject", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email heading</Label>
                <Input
                  placeholder="Leave blank for the default"
                  value={typeCfg(active.id).heading || ""}
                  onChange={(e) => setTypeField(active.id, "heading", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Additional content</Label>
                <Textarea
                  rows={3}
                  placeholder="Text appended below the email body."
                  value={typeCfg(active.id).additional_content || ""}
                  onChange={(e) => setTypeField(active.id, "additional_content", e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Placeholders: {"{order_number}"}, {"{customer_name}"}, {"{store_name}"}, {"{order_total}"}.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setActiveId(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
