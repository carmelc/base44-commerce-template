import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import MoneyInput from "../../components/MoneyInput";
import ConfirmDialog from "../../components/ConfirmDialog";
import SearchSelect from "../../components/SearchSelect";
import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import { useAdminHref } from "../../context/BasePathContext";
import { CONTINENTS, COUNTRIES } from "../../lib/geo-data";
import { SHIPPING_METHOD_TYPES, FREE_SHIPPING_REQUIRES, TAX_STATUSES } from "../../lib/constants";

// Combined region options: continents, countries, states (code style "US:CA").
const GEO_OPTIONS = [
  ...CONTINENTS.map((ct) => ({ value: `continent:${ct.code}`, label: `${ct.name} — continent` })),
  ...COUNTRIES.map((c) => ({ value: `country:${c.code}`, label: c.name })),
  ...COUNTRIES.filter((c) => c.states).flatMap((c) =>
    c.states.map((st) => ({ value: `state:${c.code}:${st.code}`, label: `${st.name}, ${c.name}` }))
  ),
];
const GEO_LABEL = Object.fromEntries(GEO_OPTIONS.map((o) => [o.value, o.label]));

const valueToLocation = (v) => {
  const i = v.indexOf(":");
  return { type: v.slice(0, i), code: v.slice(i + 1) };
};
const locationToValue = (l) => `${l.type}:${l.code}`;

const METHOD_DEFAULTS = {
  flat_rate: { cost: 0, tax_status: "taxable", class_costs: [], no_class_cost: 0, calculation_type: "order" },
  free_shipping: { requires: "", min_amount: 0, ignore_discounts: false },
  local_pickup: { cost: 0, tax_status: "taxable" },
};

export default function ShippingZoneEditor() {
  const { zoneId } = useParams();
  const href = useAdminHref();

  const [name, setName] = useState("");
  const [regions, setRegions] = useState([]); // [{value,label}]
  const [postcodesText, setPostcodesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingZone, setSavingZone] = useState(false);
  const [dirty, setDirty] = useState(false);

  const methods = useAsync(() => base44.entities["commerce.ShippingZoneMethod"].filter({ zone_id: zoneId }, "order", 100), [zoneId]);
  const classes = useAsync(() => base44.entities["commerce.ShippingClass"].list("name", 200), []);

  const [dialog, setDialog] = useState(null); // { method, isNew }
  const [savingMethod, setSavingMethod] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    base44.entities["commerce.ShippingZone"].get(zoneId)
      .then((z) => {
        if (cancelled || !z) return;
        setName(z.name || "");
        const locs = z.locations || [];
        setRegions(
          locs
            .filter((l) => l.type !== "postcode")
            .map((l) => ({ value: locationToValue(l), label: GEO_LABEL[locationToValue(l)] || l.code }))
        );
        setPostcodesText(locs.filter((l) => l.type === "postcode").map((l) => l.code).join("\n"));
        setDirty(false);
      })
      .catch((err) => toast.error(err.message || "Failed to load zone"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const searchRegions = async (q) => {
    const needle = (q || "").toLowerCase();
    return GEO_OPTIONS.filter((o) => !needle || o.label.toLowerCase().includes(needle)).slice(0, 60);
  };

  const saveZone = async () => {
    setSavingZone(true);
    try {
      const locations = [
        ...regions.map((r) => valueToLocation(r.value)),
        ...postcodesText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((code) => ({ type: "postcode", code })),
      ];
      await base44.entities["commerce.ShippingZone"].update(zoneId, { name, locations });
      toast.success("Zone saved");
      setDirty(false);
    } catch (err) {
      toast.error(err.message || "Failed to save zone");
    } finally {
      setSavingZone(false);
    }
  };

  const addMethod = async (methodId) => {
    setAdding(true);
    try {
      const type = SHIPPING_METHOD_TYPES.find((t) => t.value === methodId);
      const order = (methods.data || []).reduce((m, x) => Math.max(m, x.order ?? 0), 0) + 1;
      const created = await base44.entities["commerce.ShippingZoneMethod"].create({
        zone_id: zoneId,
        method_id: methodId,
        title: type?.label || methodId,
        enabled: true,
        order,
        settings: { ...METHOD_DEFAULTS[methodId] },
      });
      await methods.refetch();
      setDialog({ method: created, isNew: true });
    } catch (err) {
      toast.error(err.message || "Failed to add method");
    } finally {
      setAdding(false);
    }
  };

  const toggleMethod = async (m, enabled) => {
    try {
      await base44.entities["commerce.ShippingZoneMethod"].update(m.id, { enabled });
      methods.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update method");
    }
  };

  const saveMethod = async () => {
    setSavingMethod(true);
    try {
      const { method } = dialog;
      await base44.entities["commerce.ShippingZoneMethod"].update(method.id, {
        title: method.title,
        settings: method.settings,
      });
      toast.success("Method saved");
      setDialog(null);
      methods.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save method");
    } finally {
      setSavingMethod(false);
    }
  };

  const removeMethod = async () => {
    setDeleting(true);
    try {
      await base44.entities["commerce.ShippingZoneMethod"].delete(toDelete.id);
      toast.success("Method removed");
      setToDelete(null);
      methods.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to remove method");
    } finally {
      setDeleting(false);
    }
  };

  const methodColumns = [
    { key: "title", label: "Title", render: (m) => <span className="font-medium">{m.title || m.method_id}</span> },
    {
      key: "method_id",
      label: "Type",
      render: (m) => SHIPPING_METHOD_TYPES.find((t) => t.value === m.method_id)?.label || m.method_id,
    },
    {
      key: "enabled",
      label: "Enabled",
      render: (m) => <Switch checked={!!m.enabled} onCheckedChange={(v) => toggleMethod(m, v)} />,
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Edit shipping zone" backHref={href("settings/shipping")} />

      <Card>
        <CardHeader>
          <CardTitle>Zone details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Zone name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Zone regions</Label>
            <SearchSelect
              multiple
              placeholder="Add regions…"
              value={regions}
              onChange={(v) => {
                setRegions(v);
                setDirty(true);
              }}
              search={searchRegions}
            />
            <p className="text-xs text-muted-foreground">
              Continents, countries and states this zone applies to. Leave empty for a
              "rest of the world" catch-all zone.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Limit to specific postcodes (optional)</Label>
            <Textarea
              rows={3}
              placeholder={"One per line. Wildcards (90*) and ranges (1000...2000) supported."}
              value={postcodesText}
              onChange={(e) => {
                setPostcodesText(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <Button onClick={saveZone} disabled={!dirty || savingZone}>
            {savingZone && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save zone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Shipping methods</CardTitle>
          <AddMethodSelect onAdd={addMethod} disabled={adding} />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={methodColumns}
            rows={methods.data || []}
            loading={methods.loading}
            rowActions={(m) => [
              { label: "Edit settings", onClick: () => setDialog({ method: { ...m, settings: { ...METHOD_DEFAULTS[m.method_id], ...(m.settings || {}) } }, isNew: false }) },
              { label: "Delete", destructive: true, onClick: () => setToDelete(m) },
            ]}
            empty={{ title: "No shipping methods", description: "Add a method so customers in this zone can check out." }}
          />
        </CardContent>
      </Card>

      {dialog && (
        <MethodSettingsDialog
          dialog={dialog}
          setDialog={setDialog}
          classes={classes.data || []}
          saving={savingMethod}
          onSave={saveMethod}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remove shipping method?"
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={removeMethod}
      />
    </div>
  );
}

function AddMethodSelect({ onAdd, disabled }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onValueChange={(v) => {
          setValue("");
          onAdd(v);
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Add shipping method" />
        </SelectTrigger>
        <SelectContent>
          {SHIPPING_METHOD_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {!disabled && <Plus className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

function MethodSettingsDialog({ dialog, setDialog, classes, saving, onSave }) {
  const { method } = dialog;
  const s = method.settings || {};
  const setTitle = (title) => setDialog({ ...dialog, method: { ...method, title } });
  const setSetting = (key, val) => setDialog({ ...dialog, method: { ...method, settings: { ...s, [key]: val } } });

  const setClassCost = (classId, cost) => {
    const existing = (s.class_costs || []).filter((c) => c.shipping_class_id !== classId);
    setSetting("class_costs", [...existing, { shipping_class_id: classId, cost: cost ?? 0 }]);
  };
  const classCost = (classId) => (s.class_costs || []).find((c) => c.shipping_class_id === classId)?.cost ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{SHIPPING_METHOD_TYPES.find((t) => t.value === method.method_id)?.label || method.method_id} settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Method title</Label>
            <Input value={method.title || ""} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {method.method_id === "flat_rate" && (
            <>
              <div className="space-y-1.5">
                <Label>Tax status</Label>
                <Select value={s.tax_status || "taxable"} onValueChange={(v) => setSetting("tax_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_STATUSES.filter((t) => t.value !== "shipping").map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Base cost</Label>
                <MoneyInput value={s.cost ?? 0} onChange={(v) => setSetting("cost", v ?? 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Calculation type</Label>
                <RadioGroup value={s.calculation_type || "order"} onValueChange={(v) => setSetting("calculation_type", v)}>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="order" /> Per order — charge the most expensive shipping class
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="class" /> Per class — charge each shipping class in the cart
                  </label>
                </RadioGroup>
              </div>
              {classes.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Per shipping-class costs</p>
                  {classes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm">{c.name}</span>
                      <div className="w-40">
                        <MoneyInput value={classCost(c.id)} onChange={(v) => setClassCost(c.id, v)} />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 border-t pt-2">
                    <span className="text-sm">No shipping class</span>
                    <div className="w-40">
                      <MoneyInput value={s.no_class_cost ?? 0} onChange={(v) => setSetting("no_class_cost", v ?? 0)} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {method.method_id === "free_shipping" && (
            <>
              <div className="space-y-1.5">
                <Label>Free shipping requires</Label>
                <Select value={s.requires || ""} onValueChange={(v) => setSetting("requires", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREE_SHIPPING_REQUIRES.map((r) => (
                      <SelectItem key={r.value || "none"} value={r.value || "none"}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {["min_amount", "either", "both"].includes(s.requires) && (
                <>
                  <div className="space-y-1.5">
                    <Label>Minimum order amount</Label>
                    <MoneyInput value={s.min_amount ?? 0} onChange={(v) => setSetting("min_amount", v ?? 0)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!s.ignore_discounts} onCheckedChange={(v) => setSetting("ignore_discounts", !!v)} />
                    Apply minimum order rule before coupon discounts
                  </label>
                </>
              )}
            </>
          )}

          {method.method_id === "local_pickup" && (
            <>
              <div className="space-y-1.5">
                <Label>Tax status</Label>
                <Select value={s.tax_status || "taxable"} onValueChange={(v) => setSetting("tax_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_STATUSES.filter((t) => t.value !== "shipping").map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cost</Label>
                <MoneyInput value={s.cost ?? 0} onChange={(v) => setSetting("cost", v ?? 0)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
