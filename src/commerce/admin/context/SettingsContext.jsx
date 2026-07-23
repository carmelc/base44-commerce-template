import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { base44, call } from "../lib/api";

const SettingsCtx = createContext(null);

export function useSettings() {
  return useContext(SettingsCtx);
}

/**
 * Loads all StoreSettings groups once and exposes:
 *   { settings, recordIds, get(group, key, fallback), saveGroup(group, values), refresh, isSeeded, loading }
 * When the store is not seeded (no `general` group), renders the first-run
 * SetupScreen instead of children.
 */
export function SettingsProvider({ children }) {
  const [state, setState] = useState({ loading: true, groups: {}, ids: {} });

  const load = useCallback(async () => {
    try {
      const records = await base44.entities["commerce.StoreSettings"].list(undefined, 100);
      const groups = {};
      const ids = {};
      (records || []).forEach((r) => {
        groups[r.group_id] = r.values || {};
        ids[r.group_id] = r.id;
      });
      setState({ loading: false, groups, ids });
    } catch (err) {
      setState({ loading: false, groups: {}, ids: {}, error: err });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const get = useCallback(
    (group, key, fallback) => {
      const v = state.groups?.[group]?.[key];
      return v === undefined || v === null ? fallback : v;
    },
    [state.groups]
  );

  const saveGroup = useCallback(
    async (group, values) => {
      const id = state.ids[group];
      if (id) await base44.entities["commerce.StoreSettings"].update(id, { values });
      else await base44.entities["commerce.StoreSettings"].create({ group_id: group, values });
      await load();
    },
    [state.ids, load]
  );

  const isSeeded = !!state.groups.general;
  const value = {
    loading: state.loading,
    settings: state.groups,
    recordIds: state.ids,
    get,
    saveGroup,
    refresh: load,
    isSeeded,
  };

  if (state.loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSeeded) {
    return (
      <SettingsCtx.Provider value={value}>
        <SetupScreen onDone={load} />
      </SettingsCtx.Provider>
    );
  }

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

/** First-run screen: initialize store defaults via the commerce/seed-store function. */
function SetupScreen({ onDone }) {
  const [hasProducts, setHasProducts] = useState(null);
  const [withSample, setWithSample] = useState(false);
  const [running, setRunning] = useState(false);
  const [schemaErrors, setSchemaErrors] = useState(null);

  useEffect(() => {
    base44.entities["commerce.Product"].list(undefined, 1)
      .then((rows) => setHasProducts((rows || []).length > 0))
      .catch(() => setHasProducts(true)); // on error, hide the sample-data option
  }, []);

  const run = async () => {
    setRunning(true);
    setSchemaErrors(null);
    try {
      await call("seed-store", null, { with_sample_data: withSample }, { silent: true });
      toast.success("Store defaults initialized");
      onDone();
    } catch (err) {
      if (err.code === "schema_incompatible") {
        setSchemaErrors(err.details?.errors || [{ entity: "unknown", error: err.message }]);
      } else {
        toast.error(err.message);
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Set up your store</CardTitle>
          <CardDescription>
            This looks like a fresh installation. Initialize the store with default
            settings (currency, tax classes, payment methods, shipping zone and
            email configuration) to start using the admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasProducts === false && (
            <div className="flex items-start gap-2 rounded-md border p-3">
              <Checkbox
                id="with-sample"
                checked={withSample}
                onCheckedChange={(v) => setWithSample(!!v)}
              />
              <div className="grid gap-1">
                <Label htmlFor="with-sample" className="cursor-pointer">
                  Include sample data
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adds demo categories, products (simple, variable, downloadable,
                  external, grouped) and coupons so you can explore the admin.
                </p>
              </div>
            </div>
          )}
          {schemaErrors && (
            <Alert variant="destructive">
              <AlertTitle>Entity schemas are incompatible</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  The entity schemas in this app have been modified in a way that
                  prevents seeding. Restore the template schemas or fix the fields
                  below, then retry.
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {schemaErrors.map((e, i) => (
                    <li key={i}>
                      <span className="font-semibold">{e.entity}</span>: {e.error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <Button onClick={run} disabled={running} className="w-full">
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Initialize store defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
