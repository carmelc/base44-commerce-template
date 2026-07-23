import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Loader2, Pencil, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import { useAdminHref } from "../../context/BasePathContext";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import { slugify } from "../../lib/product-utils";

const ORDER_BY = [
  { value: "menu_order", label: "Custom ordering" },
  { value: "name", label: "Name" },
  { value: "name_num", label: "Name (numeric)" },
  { value: "id", label: "Term ID" },
];
const BLANK = { id: null, name: "", slug: "", order_by: "menu_order" };

export default function Attributes() {
  const navigate = useNavigate();
  const href = useAdminHref();
  const { data: attributes, loading, refetch } = useAsync(
    () => base44.entities["commerce.ProductAttribute"].list("name", 500),
    []
  );
  const [form, setForm] = useState({ ...BLANK });
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const setName = (name) => setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  const reset = () => {
    setForm({ ...BLANK });
    setSlugTouched(false);
  };
  const edit = (a) => {
    setForm({ id: a.id, name: a.name || "", slug: a.slug || "", order_by: a.order_by || "menu_order" });
    setSlugTouched(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug || slugify(form.name),
        order_by: form.order_by,
        type: "select",
      };
      if (form.id) await base44.entities["commerce.ProductAttribute"].update(form.id, payload);
      else await base44.entities["commerce.ProductAttribute"].create(payload);
      toast.success(form.id ? "Attribute updated" : "Attribute created");
      reset();
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to save attribute");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities["commerce.ProductAttribute"].delete(confirmDelete.id);
      toast.success("Attribute deleted");
      if (form.id === confirmDelete.id) reset();
      setConfirmDelete(null);
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to delete attribute");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "name", label: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "slug", label: "Slug", className: "hidden md:table-cell text-muted-foreground" },
    {
      key: "terms",
      label: "Terms",
      render: (row) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => navigate(href(`products/attributes/${row.id}/terms`))}
        >
          <Settings2 className="mr-1 h-3.5 w-3.5" /> Configure terms
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Attributes" description="Reusable options such as Color or Size" />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{form.id ? "Edit attribute" : "Add new attribute"}</CardTitle>
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
              <Label>Default sort order</Label>
              <Select value={form.order_by} onValueChange={(v) => setForm((f) => ({ ...f, order_by: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_BY.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.id ? "Update" : "Add attribute"}
              </Button>
              {form.id && <Button variant="ghost" onClick={reset} disabled={saving}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          rows={attributes || []}
          loading={loading}
          rowActions={(row) => [
            { label: "Edit", icon: Pencil, onClick: () => edit(row) },
            { label: "Configure terms", icon: Settings2, onClick: () => navigate(href(`products/attributes/${row.id}/terms`)) },
            { label: "Delete", icon: Trash2, destructive: true, onClick: () => setConfirmDelete(row) },
          ]}
          empty={{ icon: Layers, title: "No attributes yet", description: "Create an attribute like Color or Size." }}
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name}"?`}
        description="This deletes the attribute and its terms. Products keep any custom attribute values already saved."
        confirmLabel="Delete"
        onConfirm={doDelete}
        loading={deleting}
      />
    </div>
  );
}
