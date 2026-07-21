import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import DataTable from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import { useAdminHref } from "../../context/BasePathContext";
import { slugify } from "../../lib/product-utils";
import { countryName } from "../../lib/geo-data";
import { CONTINENTS } from "../../lib/geo-data";

/** Human summary of a zone's embedded locations array. */
function regionsSummary(locations) {
  const locs = locations || [];
  if (locs.length === 0) return "Everywhere not covered by other zones";
  const names = [];
  let postcodes = 0;
  for (const l of locs) {
    if (l.type === "postcode") postcodes += 1;
    else if (l.type === "continent")
      names.push(CONTINENTS.find((c) => c.code === l.code)?.name || l.code);
    else if (l.type === "country") names.push(countryName(l.code));
    else if (l.type === "state") names.push(l.code);
  }
  const parts = [];
  if (names.length) parts.push(names.slice(0, 4).join(", ") + (names.length > 4 ? `, +${names.length - 4}` : ""));
  if (postcodes) parts.push(`${postcodes} postcode${postcodes > 1 ? "s" : ""}`);
  return parts.join(" · ") || "—";
}

function ZonesTab() {
  const navigate = useNavigate();
  const href = useAdminHref();
  const zones = useAsync(() => base44.entities.ShippingZone.list("order", 200), []);
  const methods = useAsync(() => base44.entities.ShippingZoneMethod.list(undefined, 500), []);
  const [creating, setCreating] = useState(false);

  const methodsByZone = useMemo(() => {
    const map = {};
    (methods.data || []).forEach((m) => {
      (map[m.zone_id] = map[m.zone_id] || []).push(m);
    });
    return map;
  }, [methods.data]);

  // Sort by order, but push empty-location (rest-of-world) zones to the end.
  const rows = useMemo(() => {
    return [...(zones.data || [])].sort((a, b) => {
      const ae = (a.locations || []).length === 0;
      const be = (b.locations || []).length === 0;
      if (ae !== be) return ae ? 1 : -1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [zones.data]);

  const addZone = async () => {
    setCreating(true);
    try {
      const maxOrder = (zones.data || [])
        .filter((z) => (z.locations || []).length > 0)
        .reduce((m, z) => Math.max(m, z.order ?? 0), 0);
      const zone = await base44.entities.ShippingZone.create({
        name: "New zone",
        order: maxOrder + 1,
        locations: [],
      });
      navigate(href(`settings/shipping/zones/${zone.id}`));
    } catch (err) {
      toast.error(err.message || "Failed to create zone");
      setCreating(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Zone name",
      render: (z) => <span className="font-medium">{z.name}</span>,
    },
    { key: "regions", label: "Region(s)", render: (z) => regionsSummary(z.locations) },
    {
      key: "methods",
      label: "Shipping method(s)",
      render: (z) => {
        const ms = methodsByZone[z.id] || [];
        if (!ms.length) return <span className="text-muted-foreground">No methods</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {ms.map((m) => (
              <Badge key={m.id} variant={m.enabled ? "secondary" : "outline"} className="font-normal">
                {m.title || m.method_id}
              </Badge>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={addZone} disabled={creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add shipping zone
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={zones.loading || methods.loading}
        onRowClick={(z) => navigate(href(`settings/shipping/zones/${z.id}`))}
        empty={{ icon: Truck, title: "No shipping zones", description: "Create a zone to offer shipping methods to your customers." }}
      />
    </div>
  );
}

function ClassesTab() {
  const classes = useAsync(() => base44.entities.ShippingClass.list("name", 200), []);
  const blank = { id: null, name: "", slug: "", description: "" };
  const [form, setForm] = useState(blank);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const setName = (name) =>
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));

  const reset = () => {
    setForm(blank);
    setSlugTouched(false);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name, slug: form.slug || slugify(form.name), description: form.description };
      if (form.id) await base44.entities.ShippingClass.update(form.id, payload);
      else await base44.entities.ShippingClass.create(payload);
      toast.success("Shipping class saved");
      reset();
      classes.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await base44.entities.ShippingClass.delete(toDelete.id);
      toast.success("Shipping class deleted");
      if (form.id === toDelete.id) reset();
      setToDelete(null);
      classes.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "name", label: "Name", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "slug", label: "Slug", render: (c) => <code className="text-xs">{c.slug}</code> },
    { key: "description", label: "Description", render: (c) => c.description || "—" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{form.id ? "Edit shipping class" : "Add shipping class"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: e.target.value }));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? "Update" : "Add"}
            </Button>
            {form.id && (
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={classes.data || []}
        loading={classes.loading}
        rowActions={(c) => [
          { label: "Edit", onClick: () => setForm({ id: c.id, name: c.name, slug: c.slug || "", description: c.description || "" }) },
          { label: "Delete", destructive: true, onClick: () => setToDelete(c) },
        ]}
        empty={{ title: "No shipping classes", description: "Shipping classes group products with similar shipping costs." }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete shipping class?"
        description="Products in this class will not be deleted, but will lose their class assignment."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

export default function ShippingSettings() {
  return (
    <Tabs defaultValue="zones" className="space-y-4">
      <TabsList>
        <TabsTrigger value="zones">Shipping zones</TabsTrigger>
        <TabsTrigger value="classes">Shipping classes</TabsTrigger>
      </TabsList>
      <TabsContent value="zones">
        <ZonesTab />
      </TabsContent>
      <TabsContent value="classes">
        <ClassesTab />
      </TabsContent>
    </Tabs>
  );
}
