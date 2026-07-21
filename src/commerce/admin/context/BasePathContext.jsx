import React, { createContext, useContext } from "react";

/**
 * The URL prefix the admin app is mounted under (default `/admin`).
 * All internal links are built from this, so the admin folder works no matter
 * where the consumer mounts it: `<AdminApp basePath="/backoffice" />`.
 */
const BasePathContext = createContext("/admin");

export function BasePathProvider({ value = "/admin", children }) {
  const clean = value.replace(/\/+$/, "") || "/admin";
  return <BasePathContext.Provider value={clean}>{children}</BasePathContext.Provider>;
}

export function useBasePath() {
  return useContext(BasePathContext);
}

/** Returns a builder: href("orders/123") → "/admin/orders/123"; href() → "/admin". */
export function useAdminHref() {
  const base = useBasePath();
  return (path = "") => (path ? `${base}/${String(path).replace(/^\/+/, "")}` : base);
}
