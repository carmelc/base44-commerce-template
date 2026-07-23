import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { base44, call } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import { useAdminHref } from "../../context/BasePathContext";
import PageHeader from "../../components/PageHeader";
import MediaUploader from "../../components/MediaUploader";
import RichTextarea from "../../components/RichTextarea";
import { slugify, isVariable } from "../../lib/product-utils";
import ProductDataPanel from "./components/ProductDataPanel";
import TaxonomyPanel from "./components/TaxonomyPanel";
import PublishBox from "./components/PublishBox";

const NEW_PRODUCT = {
  name: "",
  slug: "",
  type: "simple",
  status: "draft",
  featured: false,
  catalog_visibility: "visible",
  description: "",
  short_description: "",
  sku: "",
  regular_price: null,
  sale_price: null,
  date_on_sale_from: null,
  date_on_sale_to: null,
  virtual: false,
  downloadable: false,
  downloads: [],
  download_limit: -1,
  download_expiry: -1,
  external_url: "",
  button_text: "",
  tax_status: "taxable",
  tax_class: "standard",
  manage_stock: false,
  stock_quantity: null,
  stock_status: "instock",
  backorders: "no",
  low_stock_amount: null,
  sold_individually: false,
  weight: null,
  dimensions: { length: null, width: null, height: null },
  shipping_class_id: "",
  reviews_allowed: true,
  upsell_ids: [],
  cross_sell_ids: [],
  grouped_products: [],
  purchase_note: "",
  category_ids: [],
  tag_ids: [],
  images: [],
  attributes: [],
  default_attributes: [],
  menu_order: 0,
  meta_data: [],
};

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const href = useAdminHref();

  const [product, setProduct] = useState(null);
  const [variations, setVariations] = useState([]);
  const [saving, setSaving] = useState(false);
  const initialRef = useRef("");
  const slugTouched = useRef(false);

  // Reference data, loaded once.
  const { data: categories, refetch: refreshCategories } = useAsync(
    () => base44.entities["commerce.ProductCategory"].list(undefined, 1000),
    []
  );
  const { data: tags, refetch: refreshTags } = useAsync(
    () => base44.entities["commerce.ProductTag"].list(undefined, 1000),
    []
  );
  const { data: attributes } = useAsync(() => base44.entities["commerce.ProductAttribute"].list(undefined, 500), []);
  const { data: shippingClasses } = useAsync(() => base44.entities["commerce.ShippingClass"].list(undefined, 500), []);
  const { data: taxClasses } = useAsync(() => base44.entities["commerce.TaxClass"].list(undefined, 100), []);

  const load = useCallback(async () => {
    if (isNew) {
      setProduct({ ...NEW_PRODUCT });
      setVariations([]);
      initialRef.current = JSON.stringify({ p: NEW_PRODUCT, v: [] });
      return;
    }
    const [p, vars] = await Promise.all([
      base44.entities["commerce.Product"].get(id),
      base44.entities["commerce.ProductVariation"].filter({ product_id: id }, "menu_order", 1000),
    ]);
    const merged = { ...NEW_PRODUCT, ...p };
    setProduct(merged);
    setVariations(vars || []);
    slugTouched.current = Boolean(p.slug);
    initialRef.current = JSON.stringify({ p: merged, v: vars || [] });
  }, [id, isNew]);

  useEffect(() => {
    load().catch((e) => toast.error(e.message || "Failed to load product"));
  }, [load]);

  /** Patch the product object. */
  const up = useCallback((patch) => setProduct((p) => ({ ...p, ...patch })), []);

  const setName = (name) => {
    const patch = { name };
    if (!slugTouched.current) patch.slug = slugify(name);
    up(patch);
  };

  const dirty = product && JSON.stringify({ p: product, v: variations }) !== initialRef.current;

  const save = async () => {
    if (!product.name?.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { product: { ...product, name: product.name.trim() } };
      if (isVariable(product)) payload.variations = variations;
      const data = await call("admin-products", "save", payload);
      const savedId = data?.product?.id || data?.id || id;
      toast.success(isNew ? "Product created" : "Product saved");
      if (isNew && savedId) navigate(href(`products/${savedId}`), { replace: true });
      else await load();
    } catch {
      /* toast handled by call() */
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    await call("admin-products", "delete", { id });
    toast.success("Product deleted");
    navigate(href("products"));
  };

  // Primary image / gallery are views over product.images (first = primary).
  const primaryImage = product?.images?.[0] || null;
  const gallery = useMemo(() => product?.images?.slice(1) || [], [product?.images]);
  const setPrimaryImage = (img) => up({ images: img ? [img, ...gallery] : [...gallery] });
  const setGallery = (list) => up({ images: primaryImage ? [primaryImage, ...list] : [...list] });

  if (!product) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const refs = { categories, tags, attributes, shippingClasses, taxClasses, refreshCategories, refreshTags };

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? "Add new product" : "Edit product"}
        backHref={href("products")}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="min-w-0 space-y-4">
          <Input
            className="h-11 text-lg font-medium"
            placeholder="Product name"
            value={product.name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Slug:</span>
            <Input
              className="h-7 w-72 text-xs"
              value={product.slug || ""}
              onChange={(e) => {
                slugTouched.current = true;
                up({ slug: e.target.value });
              }}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextarea
                rows={8}
                placeholder="Full product description (HTML allowed)"
                value={product.description || ""}
                onChange={(v) => up({ description: v })}
              />
            </CardContent>
          </Card>

          <ProductDataPanel
            product={product}
            up={up}
            refs={refs}
            variations={variations}
            setVariations={setVariations}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Short description</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextarea
                rows={4}
                placeholder="Short summary shown in listings"
                value={product.short_description || ""}
                onChange={(v) => up({ short_description: v })}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <PublishBox
            product={product}
            up={up}
            onSave={save}
            onDelete={isNew ? null : doDelete}
            saving={saving}
            dirty={dirty}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Product image</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaUploader value={primaryImage} onChange={setPrimaryImage} label="Set product image" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Product gallery</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaUploader multiple value={gallery} onChange={setGallery} label="Add gallery images" />
            </CardContent>
          </Card>

          <TaxonomyPanel product={product} up={up} refs={refs} />
        </div>
      </div>
    </div>
  );
}
