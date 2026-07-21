import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { call } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import PageHeader from "../../components/PageHeader";
import DateRangePicker from "../../components/DateRangePicker";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import {
  COUPON_TYPES,
  PRODUCT_TYPES,
  REVIEW_STATUSES,
} from "../../lib/constants";

const toISO = (d) => d.toISOString().slice(0, 10);

function thisMonth() {
  const now = new Date();
  return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) };
}

/** day for ≤31d ranges, week for ≤120d, else month. */
function autoInterval(range) {
  if (!range?.from || !range?.to) return "month";
  const days = (new Date(range.to) - new Date(range.from)) / 86400000;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/* Tolerant readers: the reports function is the source of truth, but we accept
   near-synonym keys so a small backend rename doesn't blank the page. */
const num = (...vals) => {
  for (const v of vals) if (typeof v === "number" && !isNaN(v)) return v;
  return 0;
};

function StatCard({ label, value, loading }) {
  return (
    <Card>
      <CardContent className="pt-5">
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="text-xl font-semibold tracking-tight">{value}</div>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- Sales ---------------------------------- */

function SalesTab({ range, setRange }) {
  const money = useMoney();
  const interval = autoInterval(range);

  const { data, loading } = useAsync(
    () =>
      call("admin-reports", "sales", {
        date_min: range.from,
        date_max: range.to,
        interval,
      }),
    [range.from, range.to, interval]
  );

  const totals = data?.totals || data || {};
  const series = useMemo(
    () =>
      (data?.series || data?.rows || []).map((r) => ({
        bucket: r.bucket || r.date || r.period || "",
        net: num(r.net_sales, r.net),
        gross: num(r.gross_sales, r.gross),
        orders: num(r.orders, r.orders_count),
      })),
    [data]
  );

  const stats = [
    { label: "Gross sales", value: money.format(num(totals.gross_sales, totals.gross)) },
    { label: "Net sales", value: money.format(num(totals.net_sales, totals.net)) },
    { label: "Orders", value: num(totals.orders, totals.orders_count) },
    { label: "Items sold", value: num(totals.items, totals.items_sold) },
    { label: "Refunded", value: money.format(num(totals.refunds, totals.refunded)) },
    { label: "Discounted", value: money.format(num(totals.discount, totals.discounted)) },
    { label: "Shipping", value: money.format(num(totals.shipping, totals.shipping_total)) },
  ];

  return (
    <div className="space-y-4">
      <DateRangePicker value={range} onChange={(r) => r && setRange(r)} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} loading={loading} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Sales by {interval}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : series.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No sales in this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="money"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => money.format(v)}
                  width={80}
                />
                <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Orders" ? [value, name] : [money.format(value), name]
                  }
                />
                <Legend />
                <Line
                  yAxisId="money"
                  type="monotone"
                  dataKey="net"
                  name="Net sales"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Top sellers ------------------------------- */

function TopSellersTab({ range, setRange }) {
  const money = useMoney();
  const href = useAdminHref();

  const { data, loading } = useAsync(
    () =>
      call("admin-reports", "top-sellers", {
        date_min: range.from,
        date_max: range.to,
      }),
    [range.from, range.to]
  );

  const rows = useMemo(
    () =>
      (data?.rows || data?.sellers || (Array.isArray(data) ? data : [])).map((r, i) => ({
        id: r.product_id || i,
        product_id: r.product_id,
        name: r.name || r.product_name || r.product_id,
        quantity: num(r.quantity, r.qty),
        total: num(r.total, r.net_revenue, r.revenue),
      })),
    [data]
  );

  return (
    <div className="space-y-4">
      <DateRangePicker value={range} onChange={(r) => r && setRange(r)} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top sellers by quantity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No sales in this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 36)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v, name) => (name === "Quantity" ? [v, name] : [money.format(v), name])} />
                <Bar dataKey="quantity" name="Quantity" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <DataTable
        columns={[
          {
            key: "name",
            label: "Product",
            render: (r) =>
              r.product_id ? (
                <Link to={href(`products/${r.product_id}`)} className="font-medium hover:underline">
                  {r.name}
                </Link>
              ) : (
                r.name
              ),
          },
          { key: "quantity", label: "Quantity sold" },
          { key: "total", label: "Net revenue", render: (r) => money.format(r.total) },
        ]}
        rows={rows}
        loading={loading}
        empty={{ icon: BarChart3, title: "No sales in this period" }}
      />
    </div>
  );
}

/* ---------------------------------- Totals --------------------------------- */

/** Normalize a *-totals payload into [{label, count}] rows. */
function normalizeTotals(data, labelMap) {
  if (!data) return [];
  const rows = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : null;
  if (rows) {
    return rows.map((r) => ({
      key: r.slug || r.value || r.name || r.label,
      label: r.name || r.label || r.slug || r.value,
      count: num(r.total, r.count),
    }));
  }
  // Plain map: { pending: 3, completed: 8, ... } (possibly under .totals / .counts)
  const map = data.totals || data.counts || data;
  return Object.entries(map)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({
      key: k,
      label: labelMap?.find?.((l) => l.value === k)?.label || k,
      count: v,
    }));
}

function TotalsCard({ title, rows, loading, renderLabel }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2 text-sm">
              {renderLabel ? renderLabel(r) : <span className="text-muted-foreground">{r.label}</span>}
              <span className="font-medium tabular-nums">{r.count}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

const TOTALS_ACTIONS = [
  "orders-totals",
  "products-totals",
  "customers-totals",
  "coupons-totals",
  "reviews-totals",
  "categories-totals",
  "tags-totals",
  "attributes-totals",
];

function TotalsTab() {
  const { data, loading } = useAsync(async () => {
    const results = await Promise.all(
      TOTALS_ACTIONS.map((action) =>
        call("admin-reports", action, {}, { silent: true }).catch(() => null)
      )
    );
    return Object.fromEntries(TOTALS_ACTIONS.map((a, i) => [a, results[i]]));
  }, []);

  const d = data || {};

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <TotalsCard
        title="Orders by status"
        loading={loading}
        rows={normalizeTotals(d["orders-totals"])}
        renderLabel={(r) => <StatusBadge status={r.key} className="text-[10px]" />}
      />
      <TotalsCard
        title="Products by type"
        loading={loading}
        rows={normalizeTotals(d["products-totals"], PRODUCT_TYPES)}
      />
      <TotalsCard title="Customers" loading={loading} rows={normalizeTotals(d["customers-totals"])} />
      <TotalsCard
        title="Coupons by type"
        loading={loading}
        rows={normalizeTotals(d["coupons-totals"], COUPON_TYPES)}
      />
      <TotalsCard
        title="Reviews by status"
        loading={loading}
        rows={normalizeTotals(d["reviews-totals"], REVIEW_STATUSES)}
      />
      <TotalsCard title="Categories" loading={loading} rows={normalizeTotals(d["categories-totals"])} />
      <TotalsCard title="Tags" loading={loading} rows={normalizeTotals(d["tags-totals"])} />
      <TotalsCard title="Attributes" loading={loading} rows={normalizeTotals(d["attributes-totals"])} />
    </div>
  );
}

/* ----------------------------------- Page ---------------------------------- */

export default function Reports() {
  const [range, setRange] = useState(thisMonth());

  return (
    <div>
      <PageHeader title="Reports" description="Sales performance and store totals." />
      <Tabs defaultValue="sales">
        <TabsList className="mb-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="top-sellers">Top sellers</TabsTrigger>
          <TabsTrigger value="totals">Totals</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <SalesTab range={range} setRange={setRange} />
        </TabsContent>
        <TabsContent value="top-sellers">
          <TopSellersTab range={range} setRange={setRange} />
        </TabsContent>
        <TabsContent value="totals">
          <TotalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
