import React from "react";
import { Toaster } from "sonner";
import AuthGuard from "./layout/AuthGuard";
import AdminLayout from "./layout/AdminLayout";
import AdminRoutes from "./routes";
import { SettingsProvider } from "./context/SettingsContext";
import { BasePathProvider } from "./context/BasePathContext";

/**
 * The store admin application.
 *
 * Mount inside your app's router:
 *   <Route path="/admin/*" element={<AdminApp />} />
 *
 * If mounted somewhere other than /admin, pass the prefix:
 *   <Route path="/backoffice/*" element={<AdminApp basePath="/backoffice" />} />
 *
 * Requires an authenticated user with role "admin" (enforced by AuthGuard,
 * and independently by entity RLS + requireAdmin() in backend functions).
 */
export default function AdminApp({ basePath = "/admin" }) {
  return (
    <BasePathProvider value={basePath}>
      <Toaster richColors position="top-right" />
      <AuthGuard>
        <SettingsProvider>
          <AdminLayout>
            <AdminRoutes />
          </AdminLayout>
        </SettingsProvider>
      </AuthGuard>
    </BasePathProvider>
  );
}
