import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ShieldAlert } from "lucide-react";

/**
 * Access screens for the admin.
 * variant="unauthenticated" → sign-in prompt (props: onLogin)
 * variant="forbidden"       → admin-role required (props: email, onLogout)
 */
export default function AccessDenied({ variant = "forbidden", email, onLogin, onLogout }) {
  const unauth = variant === "unauthenticated";
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {unauth ? (
              <Lock className="h-6 w-6 text-muted-foreground" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-destructive" />
            )}
          </div>
          <CardTitle>{unauth ? "Sign in required" : "Admin access required"}</CardTitle>
          <CardDescription>
            {unauth
              ? "You must sign in to access the store admin."
              : "Your account does not have the admin role. Ask a store administrator to grant you access."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {unauth ? (
            <Button onClick={onLogin} className="w-full">
              Sign in
            </Button>
          ) : (
            <>
              {email && (
                <p className="text-sm text-muted-foreground">
                  Signed in as <span className="font-medium">{email}</span>
                </p>
              )}
              <Button variant="outline" onClick={onLogout} className="w-full">
                Sign out
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
