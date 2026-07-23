import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { base44 } from "../../../lib/api";
import SearchSelect from "../../../components/SearchSelect";
import { slugify } from "../../../lib/product-utils";

const NO_PARENT = "__none__";

/**
 * Product editor sidebar panel: categories (hierarchical checkboxes + quick-add)
 * and tags (multi-select + create-on-enter).
 *
 * Props: { product, up, refs } where refs = { categories, tags, refreshCategories, refreshTags }
 */
export default function TaxonomyPanel({ product, up, refs }) {
  const categories = refs?.categories || [];
  const tags = refs?.tags || [];

  return (
    <>
      <CategoriesCard
        categories={categories}
        selected={product.category_ids || []}
        onChange={(ids) => up({ category_ids: ids })}
        refresh={refs?.refreshCategories}
      />
      <TagsCard
        tags={tags}
        selected={product.tag_ids || []}
        onChange={(ids) => up({ tag_ids: ids })}
        refresh={refs?.refreshTags}
      />
    </>
  );
}

function CategoriesCard({ categories, selected, onChange, refresh }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [parent, setParent] = useState(NO_PARENT);
  const [saving, setSaving] = useState(false);

  // Build a parent → children tree for indented rendering.
  const tree = useMemo(() => {
    const byParent = new Map();
    for (const c of categories) {
      const key = c.parent_id || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    }
    for (const list of byParent.values()) list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const rows = [];
    const walk = (parentId, depth) => {
      for (const c of byParent.get(parentId) || []) {
        rows.push({ ...c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk("", 0);
    return rows;
  }, [categories]);

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await base44.entities["commerce.ProductCategory"].create({
        name: name.trim(),
        slug: slugify(name),
        parent_id: parent === NO_PARENT ? "" : parent,
      });
      toast.success("Category created");
      setName("");
      setParent(NO_PARENT);
      setAdding(false);
      await refresh?.();
      if (created?.id) onChange([...selected, created.id]);
    } catch (e) {
      toast.error(e.message || "Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tree.length > 0 ? (
          <ScrollArea className="h-48 rounded-md border p-2">
            <div className="space-y-1">
              {tree.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                  style={{ paddingLeft: `${c.depth * 16}px` }}
                >
                  <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        )}

        {adding ? (
          <div className="space-y-2 rounded-md border p-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parent</Label>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>— None —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={create} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add new category
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TagsCard({ tags, selected, onChange, refresh }) {
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const value = useMemo(
    () =>
      selected
        .map((id) => {
          const t = tags.find((x) => x.id === id);
          return t ? { value: t.id, label: t.name } : null;
        })
        .filter(Boolean),
    [selected, tags]
  );

  const search = async (q) =>
    tags
      .filter((t) => !q || (t.name || "").toLowerCase().includes(q.toLowerCase()))
      .slice(0, 30)
      .map((t) => ({ value: t.id, label: t.name }));

  const createTag = async () => {
    const label = newTag.trim();
    if (!label) return;
    // Reuse an existing tag with the same name if present.
    const existing = tags.find((t) => (t.name || "").toLowerCase() === label.toLowerCase());
    if (existing) {
      if (!selected.includes(existing.id)) onChange([...selected, existing.id]);
      setNewTag("");
      return;
    }
    setSaving(true);
    try {
      const created = await base44.entities["commerce.ProductTag"].create({ name: label, slug: slugify(label) });
      toast.success("Tag created");
      setNewTag("");
      await refresh?.();
      if (created?.id) onChange([...selected, created.id]);
    } catch (e) {
      toast.error(e.message || "Failed to create tag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <SearchSelect
          multiple
          placeholder="Select tags"
          value={value}
          onChange={(next) => onChange(next.map((o) => o.value))}
          search={search}
        />
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createTag();
              }
            }}
            placeholder="Add new tag"
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={createTag} disabled={saving || !newTag.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
