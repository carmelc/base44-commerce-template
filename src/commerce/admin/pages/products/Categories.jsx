import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderTree, ImageIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import MediaUploader from "../../components/MediaUploader";
import { slugify } from "../../lib/product-utils";

const NO_PARENT = "__none__";
const BLANK = { id: null, name: "", slug: "", parent_id: "", description: "", image: null };

export default function Categories() {
  const { data: categories, loading, refetch } = useAsync(
    () => base44.entities["commerce.ProductCategory"].list("menu_order", 1000),
    []
  );
  const [form, setForm] = useState({ ...BLANK });
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const list = categories || [];

  // Depth map for indented display.
  const rows = useMemo(() => {
    const byParent = new Map();
    for (const c of list) {
      const key = c.parent_id || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    }
    const out = [];
    const walk = (parentId, depth) => {
      for (const c of byParent.get(parentId) || []) {
        out.push({ ...c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk("", 0);
    return out;
  }, [list]);

  const edit = (c) => {
    setForm({
      id: c.id,
      name: c.name || "",
      slug: c.slug || "",
      parent_id: c.parent_id || "",
      description: c.description || "",
      image: c.image || null,
    });
    setSlugTouched(true);
  };

  const reset = () => {
    setForm({ ...BLANK });
    setSlugTouched(false);
  };

  const setName = (name) => {
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
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
        parent_id: form.parent_id === NO_PARENT ? "" : form.parent_id,
        description: form.description,
        image: form.image,
      };
      if (form.id) await base44.entities["commerce.ProductCategory"].update(form.id, payload);
      else await base44.entities["commerce.ProductCategory"].create(payload);
      toast.success(form.id ? "Category updated" : "Category created");
      reset();
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities["commerce.ProductCategory"].delete(confirmDelete.id);
      toast.success("Category deleted");
      if (form.id === confirmDelete.id) reset();
      setConfirmDelete(null);
      refetch();
    } catch (e) {
      toast.error(e.message || "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "image",
      label: "",
      className: "w-12",
      render: (row) =>
        row.image?.src ? (
          <img src={row.image.src} alt="" className="h-9 w-9 rounded object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <span style={{ paddingLeft: `${row.depth * 16}px` }} className="font-medium">
          {row.depth > 0 && <span className="text-muted-foreground">— </span>}
          {row.name}
        </span>
      ),
    },
    { key: "slug", label: "Slug", className: "hidden md:table-cell text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Categories" description="Organize products into a hierarchy" />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{form.id ? "Edit category" : "Add new category"}</CardTitle>
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
              <Label>Parent</Label>
              <Select
                value={form.parent_id || NO_PARENT}
                onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v === NO_PARENT ? "" : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>— None —</SelectItem>
                  {list
                    .filter((c) => c.id !== form.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Image</Label>
              <MediaUploader value={form.image} onChange={(img) => setForm((f) => ({ ...f, image: img }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.id ? "Update" : "Add category"}
              </Button>
              {form.id && (
                <Button variant="ghost" onClick={reset} disabled={saving}>Cancel</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          rowActions={(row) => [
            { label: "Edit", icon: Pencil, onClick: () => edit(row) },
            { label: "Delete", icon: Trash2, destructive: true, onClick: () => setConfirmDelete(row) },
          ]}
          empty={{ icon: FolderTree, title: "No categories yet", description: "Create your first category." }}
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name}"?`}
        description="Products in this category are not deleted; they simply lose the category."
        confirmLabel="Delete"
        onConfirm={doDelete}
        loading={deleting}
      />
    </div>
  );
}
