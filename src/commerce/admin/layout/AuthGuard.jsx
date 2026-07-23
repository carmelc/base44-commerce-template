import React, { createContext, useContext, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "../lib/api";
import AccessDenied from "./AccessDenied";

const AuthContext = createContext(null);

/** Current admin user (only available inside AuthGuard). */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Blocks the admin UI unless the caller is an authenticated user with
 * role === "admin". Do NOT weaken this check — see skills/commerce/SKILL.md.
 * (Server-side RLS + requireAdmin() in functions enforce this independently.)
 */
export default function AuthGuard({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    base44.auth
      .me()
      .then((user) => setState({ loading: false, user }))
      .catch(() => setState({ loading: false, user: null }));
  }, []);

  if (state.loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.user) {
    return (
      <AccessDenied
        variant="unauthenticated"
        onLogin={() => base44.auth.loginWithProvider("google", window.location.pathname)}
      />
    );
  }

  if (state.user.role !== "admin") {
    return (
      <AccessDenied
        variant="forbidden"
        email={state.user.email}
        onLogout={() => base44.auth.logout(window.location.pathname)}
      />
    );
  }

  return <AuthContext.Provider value={state.user}>{children}</AuthContext.Provider>;
}
