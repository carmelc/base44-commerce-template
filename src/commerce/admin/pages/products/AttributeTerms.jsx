import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import { useAdminHref } from "../../context/BasePathContext";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import { slugify } from "../../lib/product-utils";

const blank = () => ({ id: null, name: "", slug: "", description: "", menu_order: 0 });

export default function AttributeTerms() {
  const { id } = useParams();
  const href = useAdminHref();

  const { data: attribute } = useAsync(() => base44.entities.ProductAttribute.get(id), [id]);
  const { data: terms, loading, refetch } = useAsync(
    () => base44.entities.ProductAttributeTerm.filter({ attribute_id: id }, "menu_order", 1000),
    [id]
  );

  const [form, setForm] = useState(blank());
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm(blank());
    setSlugTouched(false);
  }, [id]);

  const setName = (name) => setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  const reset = () => {
    setForm(blank());
    setSlugTouched(false);
  };
  const edit = (t) => {
    setForm({
      id: t.id,
      name: t.name || "",
      slug: t.slug || "",
      description: t.description || "",
      menu_order: t.menu_order || 0,
    });
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
        attribute_id: id,
        name: form.name.trim(),
        slug: form.slug || slugify(form.name),
        description: form.description,
        menu_order: Number(form.menu_order) || 0,
      };
      if (form.id) await base44.entities.ProductAttributeTerm.update(form.id, payload);
      else await base44.entities.ProductAttributeTerm.create(payload);
      toast.success(form.id ? "Term updated" : "Term created");
      reset();
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to save term");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.ProductAttributeTerm.delete(confirmDelete.id);
      toast.success("Term deleted");
      if (form.id === confirmDelete.id) reset();
      setConfirmDelete(null);
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to delete term");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "name", label: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "slug", label: "Slug", className: "hidden md:table-cell text-muted-foreground" },
    { key: "menu_order", label: "Order", className: "hidden md:table-cell w-20" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={attribute ? `${attribute.name} — terms` : "Terms"}
        description="Values for this attribute (e.g. Red, Blue, Green)"
        backHref={href("products/attributes")}
      />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{form.id ? "Edit term" : "Add new term"}</CardTitle>
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
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Menu order</Label>
              <Input
                type="number"
                value={form.menu_order}
                onChange={(e) => setForm((f) => ({ ...f, menu_order: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.id ? "Update" : "Add term"}
              </Button>
              {form.id && <Button variant="ghost" onClick={reset} disabled={saving}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          rows={terms || []}
          loading={loading}
          rowActions={(row) => [
            { label: "Edit", icon: Pencil, onClick: () => edit(row) },
            { label: "Delete", icon: Trash2, destructive: true, onClick: () => setConfirmDelete(row) },
          ]}
          empty={{ icon: List, title: "No terms yet", description: "Add the first value for this attribute." }}
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name}"?`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        loading={deleting}
      />
    </div>
  );
}
