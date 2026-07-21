/** Client-side helpers for products and variations. */

export function slugify(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const isSimple = (p) => p?.type === "simple";
export const isGrouped = (p) => p?.type === "grouped";
export const isExternal = (p) => p?.type === "external";
export const isVariable = (p) => p?.type === "variable";

/**
 * Cartesian product of all attributes flagged `variation: true`.
 * Returns [{attributes: [{attribute_id, name, option}]}] — one entry per combo.
 * Returns [] when no variation attributes with options exist.
 */
export function generateVariationCombos(attributes) {
  const varAttrs = (attributes || []).filter(
    (a) => a.variation && (a.options || []).length > 0
  );
  if (!varAttrs.length) return [];
  const combos = varAttrs.reduce(
    (acc, attr) =>
      acc.flatMap((combo) =>
        attr.options.map((option) => [
          ...combo,
          { attribute_id: attr.attribute_id || "", name: attr.name, option },
        ])
      ),
    [[]]
  );
  return combos.map((attrs) => ({ attributes: attrs }));
}

/** Display label for a variation, e.g. "Color: Red / Size: M". */
export function variationLabel(variation) {
  return (variation?.attributes || [])
    .map((a) => `${a.name}: ${a.option}`)
    .join(" / ") || "Any";
}

/** True when two variations have the same attribute combo. */
export function sameCombo(a, b) {
  const key = (v) =>
    (v?.attributes || [])
      .map((x) => `${(x.name || "").toLowerCase()}=${(x.option || "").toLowerCase()}`)
      .sort()
      .join("|");
  return key(a) === key(b);
}
