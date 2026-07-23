import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../../components/PageHeader";
import ConfirmDialog from "../../components/ConfirmDialog";
import { base44, call } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import { useAdminHref } from "../../context/BasePathContext";
import { WEBHOOK_STATUSES, WEBHOOK_TOPICS } from "../../lib/constants";
import { formatDateTime } from "../../lib/format";

const blank = {
  name: "",
  status: "active",
  topic: "order.created",
  delivery_url: "",
  secret: "",
  api_version: "v3",
};

const genSecret = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export default function WebhookEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const href = useAdminHref();

  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    base44.entities.Webhook.get(id)
      .then((w) => !cancelled && w && setForm({ ...blank, ...w }))
      .catch((err) => toast.error(err.message || "Failed to load webhook"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.delivery_url.trim()) {
      toast.error("Name and delivery URL are required");
      return;
    }
    setSaving(true);
    try {
      const [resource, event] = form.topic.split(".");
      const payload = {
        name: form.name,
        status: form.status,
        topic: form.topic,
        resource,
        event,
        delivery_url: form.delivery_url,
        secret: form.secret,
        api_version: form.api_version || "v3",
      };
      if (isNew) {
        const created = await base44.entities.Webhook.create(payload);
        toast.success("Webhook created");
        navigate(href(`webhooks/${created.id}`));
      } else {
        await base44.entities.Webhook.update(id, payload);
        toast.success("Webhook saved");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save webhook");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await base44.entities.Webhook.delete(id);
      toast.success("Webhook deleted");
      navigate(href("webhooks"));
    } catch (err) {
      toast.error(err.message || "Failed to delete");
      setDeleting(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await call("admin-webhooks", "test", { webhook_id: id });
      const code = res?.response_code ?? res?.delivery?.response_code;
      toast.success(code ? `Test delivered — HTTP ${code}` : "Test delivered");
    } catch {
      /* call() already toasts */
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={isNew ? "Add webhook" : "Edit webhook"}
        backHref={href("webhooks")}
        actions={
          !isNew && (
            <>
              <Button variant="outline" onClick={sendTest} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send test
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Webhook details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEBHOOK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Topic</Label>
            <Select value={form.topic} onValueChange={(v) => set("topic", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEBHOOK_TOPICS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Delivery URL</Label>
            <Input placeholder="https://example.com/webhooks/incoming" value={form.delivery_url} onChange={(e) => set("delivery_url", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Secret</Label>
            <div className="flex gap-2">
              <Input value={form.secret} onChange={(e) => set("secret", e.target.value)} placeholder="Used to sign the payload (HMAC-SHA256)" />
              <Button variant="outline" type="button" onClick={() => set("secret", genSecret())}>Generate</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>API version</Label>
            <Input value={form.api_version} disabled />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isNew ? "Create webhook" : "Save changes"}
        </Button>
      </div>

      {!isNew && <DeliveriesCard webhookId={id} />}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete webhook?"
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

function DeliveriesCard({ webhookId }) {
  const deliveries = useAsync(
    () => base44.entities.WebhookDelivery.filter({ webhook_id: webhookId }, "-created_date", 20),
    [webhookId]
  );
  const [expanded, setExpanded] = useState(null);
  const [redelivering, setRedelivering] = useState(null);

  const redeliver = async (deliveryId) => {
    setRedelivering(deliveryId);
    try {
      await call("admin-webhooks", "redeliver", { delivery_id: deliveryId });
      toast.success("Redelivered");
      deliveries.refetch();
    } catch {
      /* toasted */
    } finally {
      setRedelivering(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent deliveries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {deliveries.loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {!deliveries.loading && (deliveries.data || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        )}
        {(deliveries.data || []).map((d) => {
          const open = expanded === d.id;
          return (
            <div key={d.id} className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                onClick={() => setExpanded(open ? null : d.id)}
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Badge
                  variant="outline"
                  className={d.success ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}
                >
                  {d.response_code || (d.success ? "OK" : "ERR")}
                </Badge>
                <span className="text-muted-foreground">{formatDateTime(d.created_date)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{d.duration_ms != null ? `${d.duration_ms} ms` : ""}</span>
              </button>
              {open && (
                <div className="space-y-2 border-t px-3 py-2 text-xs">
                  <div>
                    <div className="mb-1 font-medium">Request</div>
                    <pre className="max-h-48 overflow-auto rounded bg-muted p-2">{d.request_body || "—"}</pre>
                  </div>
                  <div>
                    <div className="mb-1 font-medium">Response</div>
                    <pre className="max-h-48 overflow-auto rounded bg-muted p-2">{d.response_body || "—"}</pre>
                  </div>
                  <Button size="sm" variant="outline" disabled={redelivering === d.id} onClick={() => redeliver(d.id)}>
                    {redelivering === d.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Redeliver
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
