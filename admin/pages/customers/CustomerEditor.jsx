import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Copy, Loader2, RefreshCw } from "lucide-react";

import { call, base44 } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { round2 } from "../../lib/order-utils";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import PageHeader from "../../components/PageHeader";
import AddressForm from "../../components/AddressForm";
import MetaDataEditor from "../../components/MetaDataEditor";
import ConfirmDialog from "../../components/ConfirmDialog";
import StatusBadge from "../../components/StatusBadge";

const EMPTY = {
  email: "",
  first_name: "",
  last_name: "",
  username: "",
  billing: {},
  shipping: {},
  meta_data: [],
};

export default function CustomerEditor() {
  const { id } = useParams();
  const isNew = !id;
  const href = useAdminHref();
  const navigate = useNavigate();
  const money = useMoney();

  const [customer, setCustomer] = useState(EMPTY);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sendInvite, setSendInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const set = (key) => (v) => setCustomer((c) => ({ ...c, [key]: v }));
  const setInput = (key) => (e) => set(key)(e.target.value);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      base44.entities.Customer.get(id),
      base44.entities.Order.filter({ customer_id: id }, "-created_date", 10).catch(() => []),
    ])
      .then(([c, orders]) => {
        if (cancelled) return;
        setCustomer({ ...EMPTY, ...c });
        setRecentOrders(orders || []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const save = async () => {
    if (!customer.email?.trim()) {
      toast.error("An email address is required");
      return;
    }
    setSaving(true);
    try {
      const saved = await call("admin-customers", "save", { customer });
      toast.success("Customer saved");
      if (isNew && sendInvite && saved?.email) {
        try {
          await call("admin-customers", "invite", { email: saved.email });
          toast.success("Invite sent");
        } catch {
          /* toast shown by call() */
        }
      }
      if (isNew && saved?.id) navigate(href(`customers/${saved.id}`), { replace: true });
      else if (saved) setCustomer((c) => ({ ...c, ...saved }));
    } catch {
      /* toast shown by call() */
    } finally {
      setSaving(false);
    }
  };

  const recalcStats = async () => {
    setRecalculating(true);
    try {
      const updated = await call("admin-customers", "recalculate-stats", { id });
      toast.success("Stats recalculated");
      if (updated) setCustomer((c) => ({ ...c, ...updated }));
    } catch {
      /* toast shown by call() */
    } finally {
      setRecalculating(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await call("admin-customers", "delete", { id, reassign_orders_to_guest: true });
      toast.success("Customer deleted");
      navigate(href("customers"));
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
  const aov =
    customer.orders_count > 0 ? round2((customer.total_spent || 0) / customer.orders_count) : 0;

  return (
    <div>
      <PageHeader
        title={isNew ? "Add customer" : name || customer.email}
        backHref={href("customers")}
        actions={
          <>
            {!isNew && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isNew ? "Create customer" : "Save customer"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Email address *</Label>
                <Input type="email" value={customer.email} onChange={setInput("email")} />
              </div>
              <div className="grid gap-1.5">
                <Label>First name</Label>
                <Input value={customer.first_name || ""} onChange={setInput("first_name")} />
              </div>
              <div className="grid gap-1.5">
                <Label>Last name</Label>
                <Input value={customer.last_name || ""} onChange={setInput("last_name")} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Username</Label>
                <Input value={customer.username || ""} onChange={setInput("username")} />
              </div>
              {isNew && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <Checkbox checked={sendInvite} onCheckedChange={(v) => setSendInvite(!!v)} />
                  Send the new user an account invite
                </label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Billing address</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressForm
                value={customer.billing || {}}
                onChange={set("billing")}
                showEmail
                showPhone
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Shipping address</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const { email: _email, ...rest } = customer.billing || {};
                  set("shipping")(rest);
                  toast.success("Copied from billing");
                }}
              >
                <Copy className="mr-1 h-4 w-4" /> Copy from billing
              </Button>
            </CardHeader>
            <CardContent>
              <AddressForm
                value={customer.shipping || {}}
                onChange={set("shipping")}
                showEmail={false}
                showPhone
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Custom fields</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaDataEditor value={customer.meta_data || []} onChange={set("meta_data")} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        {!isNew && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">Stats</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={recalcStats}
                  disabled={recalculating}
                >
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${recalculating ? "animate-spin" : ""}`} />
                  Recalculate
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total spend</span>
                  <span className="font-medium">{money.format(customer.total_spent ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders</span>
                  <span className="font-medium">{customer.orders_count ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average order value</span>
                  <span className="font-medium">{money.format(aov)}</span>
                </div>
                {customer.is_paying_customer && (
                  <p className="pt-1 text-xs text-muted-foreground">Paying customer ✓</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent orders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {recentOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                )}
                {recentOrders.map((o) => (
                  <div key={o.id}>
                    <Link
                      to={href(`orders/${o.id}`)}
                      className="flex items-center justify-between gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-muted"
                    >
                      <span className="font-medium">#{o.order_number ?? o.id.slice(0, 6)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(o.created_date)}
                      </span>
                      <StatusBadge status={o.status} className="text-[10px]" />
                      <span className="font-medium">{money.format(o.total ?? 0)}</span>
                    </Link>
                    <Separator className="last:hidden" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this customer?"
        description="Their orders are kept and reassigned to Guest. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  );
}
