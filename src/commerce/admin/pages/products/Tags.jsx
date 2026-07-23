import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Pencil, Tag as TagIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import { slugify } from "../../lib/product-utils";

const BLANK = { id: null, name: "", slug: "", description: "" };

export default function Tags() {
  const { data: tags, loading, refetch } = useAsync(
    () => base44.entities["commerce.ProductTag"].list("name", 1000),
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
  const edit = (t) => {
    setForm({ id: t.id, name: t.name || "", slug: t.slug || "", description: t.description || "" });
    setSlugTouched(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), slug: form.slug || slugify(form.name), description: form.description };
      if (form.id) await base44.entities["commerce.ProductTag"].update(form.id, payload);
      else await base44.entities["commerce.ProductTag"].create(payload);
      toast.success(form.id ? "Tag updated" : "Tag created");
      reset();
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to save tag");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities["commerce.ProductTag"].delete(confirmDelete.id);
      toast.success("Tag deleted");
      if (form.id === confirmDelete.id) reset();
      setConfirmDelete(null);
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to delete tag");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "name", label: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "slug", label: "Slug", className: "hidden md:table-cell text-muted-foreground" },
    {
      key: "description",
      label: "Description",
      className: "hidden lg:table-cell text-muted-foreground",
      render: (row) => row.description || "—",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Tags" description="Freeform labels for products" />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{form.id ? "Edit tag" : "Add new tag"}</CardTitle>
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
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.id ? "Update" : "Add tag"}
              </Button>
              {form.id && <Button variant="ghost" onClick={reset} disabled={saving}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          rows={tags || []}
          loading={loading}
          rowActions={(row) => [
            { label: "Edit", icon: Pencil, onClick: () => edit(row) },
            { label: "Delete", icon: Trash2, destructive: true, onClick: () => setConfirmDelete(row) },
          ]}
          empty={{ icon: TagIcon, title: "No tags yet", description: "Create your first tag." }}
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name}"?`}
        description="Products with this tag are not deleted; they simply lose the tag."
        confirmLabel="Delete"
        onConfirm={doDelete}
        loading={deleting}
      />
    </div>
  );
}
