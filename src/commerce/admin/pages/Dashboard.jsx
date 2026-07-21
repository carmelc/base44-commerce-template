import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, PackagePlus, Plus, ShoppingCart, TicketPercent, TrendingUp, AlertTriangle } from "lucide-react";

import { call, base44 } from "../lib/api";
import useAsync from "../hooks/useAsync";
import useMoney from "../hooks/useMoney";
import { useAdminHref } from "../context/BasePathContext";
import { formatDate } from "../lib/format";
import { ORDER_STATUSES } from "../lib/constants";
import { customerName } from "../lib/order-utils";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

/** Pull a number out of a summary value that may be a number or {net, gross, …}. */
function asMoneyNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.net_sales ?? v.net ?? v.total ?? 0;
}

function StatCard({ icon: Icon, label, value, hint, loading }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-muted p-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-20" />
          ) : (
            <p className="truncate text-xl font-semibold">{value}</p>
          )}
          {hint && !loading && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const href = useAdminHref();
  const navigate = useNavigate();
  const { format } = useMoney();

  const summary = useAsync(() => call("admin-reports", "summary", {}, { silent: true }), []);
  const stock = useAsync(() => call("admin-reports", "stock", {}, { silent: true }), []);
  const latest = useAsync(() => base44.entities.Order.list("-created_date", 8), []);

  const s = summary.data || {};
  const ordersByStatus = s.orders_by_status || {};
  const lowStock = (stock.data?.low_stock || []).slice(0, 6);
  const processingCount = ordersByStatus.processing || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your store at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={href("products/new")}>
              <PackagePlus className="mr-1.5 h-4 w-4" /> Add product
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={href("coupons/new")}>
              <TicketPercent className="mr-1.5 h-4 w-4" /> Create coupon
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={href("reports")}>
              <BarChart3 className="mr-1.5 h-4 w-4" /> View reports
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Net sales today"
          value={format(asMoneyNumber(s.sales_today))}
          loading={summary.loading}
        />
        <StatCard
          icon={BarChart3}
          label="Net sales this month"
          value={format(asMoneyNumber(s.sales_month))}
          loading={summary.loading}
        />
        <StatCard
          icon={ShoppingCart}
          label="Awaiting processing"
          value={processingCount}
          hint="orders to fulfill"
          loading={summary.loading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Low stock"
          value={s.low_stock_count ?? lowStock.length}
          hint="products at or below threshold"
          loading={summary.loading && stock.loading}
        />
      </div>

      {/* Orders by status */}
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((st) => (
          <Link key={st.value} to={href(`orders?status=${st.value}`)}>
            <Badge variant="outline" className={`${st.color} cursor-pointer`}>
              {st.label}: {ordersByStatus[st.value] || 0}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Latest orders */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {latest.loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (latest.data || []).length === 0 ? (
              <div className="py-10">
                <EmptyState
                  icon={ShoppingCart}
                  title="No orders yet"
                  description="Orders will appear here as soon as they come in."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(latest.data || []).map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => navigate(href(`orders/${o.id}`))}
                    >
                      <TableCell className="font-medium">#{o.order_number || o.id}</TableCell>
                      <TableCell>{formatDate(o.created_date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell>{customerName(o)}</TableCell>
                      <TableCell className="text-right">{format(o.total || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Low on stock</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stock.loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : lowStock.length === 0 ? (
              <div className="py-10">
                <EmptyState icon={Plus} title="All stocked up" description="No products are low on stock." />
              </div>
            ) : (
              <ul className="divide-y">
                {lowStock.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={href(`products/${p.product_id || p.id}`)}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        {p.sku && <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>}
                      </span>
                      <Badge variant="outline" className="ml-2 shrink-0 bg-amber-100 text-amber-800 border-amber-200">
                        {p.stock_quantity ?? 0} left
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
