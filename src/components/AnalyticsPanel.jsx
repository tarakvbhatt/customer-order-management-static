import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, ShoppingBag, Users, Wallet, Repeat, Flame } from "lucide-react";
import { rupee } from "../lib/menu";

const PERIOD_OPTIONS = [7, 14, 21, 30];

const COLORS = {
  masala: "#B33A2E",
  masalaRgb: "179,58,46",
  turmeric: "#D9A441",
  kokam: "#7A2048",
  green: "#3F7D4F",
  inkSoft: "#6B584A",
  line: "#E4D5BE",
};

const STATUS_COLORS = { pending: COLORS.turmeric, completed: COLORS.green, cancelled: COLORS.inkSoft };
const PIE_PALETTE = ["#B33A2E", "#D9A441", "#7A2048", "#3F7D4F", "#4A6FA5", "#C97B3F", "#8B5FBF", "#6B584A"];
const DAY_MS = 24 * 60 * 60 * 1000;
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ---------------- data helpers ---------------- */

function activeOnly(orders) {
  return orders.filter((o) => o.status !== "cancelled");
}

function withinLastDays(orders, days) {
  const cutoff = Date.now() - days * DAY_MS;
  return orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
}

// For each item: how many distinct customers ordered it 2+ times (separate orders) within the given order set.
function computeReorderStats(orders) {
  const perItem = {}; // name -> { customerId: orderCount }
  orders.forEach((o) => {
    const itemsInThisOrder = new Set(o.items.map((it) => it.name));
    itemsInThisOrder.forEach((name) => {
      if (!perItem[name]) perItem[name] = {};
      perItem[name][o.customer_id] = (perItem[name][o.customer_id] || 0) + 1;
    });
  });
  return Object.entries(perItem)
    .map(([name, custMap]) => {
      const counts = Object.values(custMap);
      const repeatCustomers = counts.filter((c) => c >= 2).length;
      const totalOrders = counts.reduce((a, b) => a + b, 0);
      return { name, repeatCustomers, totalOrders };
    })
    .filter((x) => x.repeatCustomers > 0)
    .sort((a, b) => b.repeatCustomers - a.repeatCustomers || b.totalOrders - a.totalOrders);
}

function topSpenders(orders, customers, limit) {
  const spend = {};
  orders.forEach((o) => { spend[o.customer_id] = (spend[o.customer_id] || 0) + Number(o.total); });
  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  return Object.entries(spend)
    .map(([id, total]) => ({ name: custMap[id]?.name || "Unknown", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function topVisitors(orders, customers, limit) {
  const visits = {};
  orders.forEach((o) => { visits[o.customer_id] = (visits[o.customer_id] || 0) + 1; });
  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  return Object.entries(visits)
    .map(([id, count]) => ({ name: custMap[id]?.name || "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function itemQty(orders, limit) {
  const counts = {};
  orders.forEach((o) => o.items.forEach((it) => { counts[it.name] = (counts[it.name] || 0) + it.qty; }));
  return Object.entries(counts)
    .map(([name, qty]) => ({ name: truncate(name, 18), qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

// Share of total items ordered, per menu item — top N slices plus an "Other items" bucket.
function itemShareData(orders, topN) {
  const counts = {};
  orders.forEach((o) => o.items.forEach((it) => { counts[it.name] = (counts[it.name] || 0) + it.qty; }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN).map(([name, qty]) => ({ name: truncate(name, 20), qty }));
  const restTotal = sorted.slice(topN).reduce((s, [, qty]) => s + qty, 0);
  if (restTotal > 0) top.push({ name: "Other items", qty: restTotal });
  return top;
}

function itemDayMatrix(allOrders, days, topN) {
  const scoped = withinLastDays(allOrders, days);
  const dayKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    dayKeys.push(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10));
  }
  const grid = {}; // item -> { dayKey: qty }
  scoped.forEach((o) => {
    const key = new Date(o.created_at).toISOString().slice(0, 10);
    o.items.forEach((it) => {
      if (!grid[it.name]) grid[it.name] = {};
      grid[it.name][key] = (grid[it.name][key] || 0) + it.qty;
    });
  });
  const items = Object.entries(grid)
    .map(([name, dayMap]) => ({ name, total: Object.values(dayMap).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN)
    .map((x) => x.name);
  let max = 1;
  items.forEach((name) => dayKeys.forEach((d) => { max = Math.max(max, grid[name]?.[d] || 0); }));
  return { dayKeys, items, grid, max };
}

/* ---------------- component ---------------- */

export default function AnalyticsPanel({ orders, customers }) {
  const active = useMemo(() => activeOnly(orders), [orders]);
  const last30 = useMemo(() => withinLastDays(active, 30), [active]);

  const [statsPeriod, setStatsPeriod] = useState(30);
  const [heatmapPeriod, setHeatmapPeriod] = useState(30);

  const revenueByDay = useMemo(() => {
    const map = {};
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
      map[key] = 0;
    }
    active.forEach((o) => {
      const key = new Date(o.created_at).toISOString().slice(0, 10);
      if (map[key] !== undefined) map[key] += Number(o.total);
    });
    return days.map((key) => ({
      date: new Date(key).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      revenue: map[key],
    }));
  }, [active]);

  const statusBreakdown = useMemo(() => {
    const counts = { pending: 0, completed: 0, cancelled: 0 };
    orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).filter(([, c]) => c > 0).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const statsScoped = useMemo(() => withinLastDays(active, statsPeriod), [active, statsPeriod]);
  const totals = useMemo(() => {
    const revenue = statsScoped.reduce((s, o) => s + Number(o.total), 0);
    const uniqueCustomers = new Set(statsScoped.map((o) => o.customer_id)).size;
    return {
      revenue,
      orderCount: statsScoped.length,
      customerCount: uniqueCustomers,
      avgOrder: statsScoped.length ? revenue / statsScoped.length : 0,
    };
  }, [statsScoped]);

  const reorder30 = useMemo(
    () => computeReorderStats(last30).slice(0, 5).map((x) => ({ name: truncate(x.name, 18), repeatCustomers: x.repeatCustomers })),
    [last30]
  );
  const reorderAllTime = useMemo(
    () => computeReorderStats(active).slice(0, 6).map((x) => ({ name: truncate(x.name, 18), repeatCustomers: x.repeatCustomers })),
    [active]
  );
  const spenders = useMemo(() => topSpenders(active, customers, 10), [active, customers]);
  const visitors = useMemo(() => topVisitors(active, customers, 10), [active, customers]);
  const bestSelling30 = useMemo(() => itemQty(last30, 8), [last30]);
  const itemShare = useMemo(() => itemShareData(active, 7), [active]);
  const heatmap = useMemo(() => itemDayMatrix(active, heatmapPeriod, 8), [active, heatmapPeriod]);

  if (orders.length === 0) {
    return <p className="mp-empty">No orders yet — analytics will appear once orders start coming in.</p>;
  }

  return (
    <div className="mp-analytics">
      <div className="mp-period-row">
        <span className="mp-period-label">Showing overview for:</span>
        <PeriodSelector value={statsPeriod} onChange={setStatsPeriod} />
      </div>
      <div className="mp-stat-cards">
        <StatCard icon={Wallet} label={`Revenue — last ${statsPeriod}d`} value={rupee(totals.revenue)} />
        <StatCard icon={ShoppingBag} label={`Orders — last ${statsPeriod}d`} value={totals.orderCount} />
        <StatCard icon={Users} label={`Customers — last ${statsPeriod}d`} value={totals.customerCount} />
        <StatCard icon={TrendingUp} label={`Avg. order — last ${statsPeriod}d`} value={rupee(totals.avgOrder)} />
      </div>

      <div className="mp-chart-card">
        <h3>Revenue — last 14 days</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={revenueByDay} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(v) => rupee(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
            <Line type="monotone" dataKey="revenue" stroke={COLORS.masala} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.masala }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mp-chart-row">
        {/* 6. Best selling items - last 30 days */}
        <div className="mp-chart-card">
          <h3><Flame size={13} /> Best Selling Items — Last 30 Days</h3>
          {bestSelling30.length === 0 ? <EmptySmall /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bestSelling30} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                <Bar dataKey="qty" name="Qty sold" fill={COLORS.turmeric} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order status */}
        <div className="mp-chart-card">
          <h3>Order Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {statusBreakdown.map((entry) => <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Legend verticalAlign="bottom" height={28} formatter={(v) => <span style={{ fontSize: 12, color: COLORS.inkSoft, textTransform: "capitalize" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Item-wise Orders */}
      <div className="mp-chart-card">
        <h3>Item-wise Orders</h3>
        {itemShare.length === 0 ? <EmptySmall /> : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={itemShare} dataKey="qty" nameKey="name" cx="38%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {itemShare.map((entry, i) => <Cell key={entry.name} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(v) => <span style={{ fontSize: 12, color: COLORS.inkSoft }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mp-chart-row">
        {/* 1. Top 5 highly re-ordered items - last 30 days */}
        <div className="mp-chart-card">
          <h3><Repeat size={13} /> Top 5 Highly Re-ordered Items — Last 30 Days</h3>
          {reorder30.length === 0 ? <EmptySmall text="No repeat orders on any item yet in the last 30 days." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reorder30} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} formatter={(v) => [v, "Repeat customers"]} />
                <Bar dataKey="repeatCustomers" fill={COLORS.kokam} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 5. Frequently reordered items - all time */}
        <div className="mp-chart-card">
          <h3><Repeat size={13} /> Frequently Reordered Items — All Time</h3>
          {reorderAllTime.length === 0 ? <EmptySmall text="No items have been reordered yet." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reorderAllTime} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} formatter={(v) => [v, "Repeat customers"]} />
                <Bar dataKey="repeatCustomers" fill={COLORS.masala} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mp-chart-row">
        {/* 2. Top 10 high spending customers */}
        <div className="mp-chart-card">
          <h3>Top 10 High-Spending Customers</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={spenders} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={110} />
              <Tooltip formatter={(v) => rupee(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Bar dataKey="total" fill={COLORS.masala} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Top 10 frequent visitors */}
        <div className="mp-chart-card">
          <h3>Top 10 Frequent Visitors</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={visitors} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} formatter={(v) => [v, "Orders"]} />
              <Bar dataKey="count" fill={COLORS.turmeric} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Item-wise day-wise selling heatmap */}
      <div className="mp-chart-card">
        <div className="mp-chart-card-header">
          <h3>Item-wise Day-wise Selling</h3>
          <PeriodSelector value={heatmapPeriod} onChange={setHeatmapPeriod} />
        </div>
        {heatmap.items.length === 0 ? <EmptySmall /> : (
          <div className="mp-heatmap-wrap">
            <table className="mp-heatmap-table">
              <thead>
                <tr>
                  <th className="mp-heatmap-corner">Item</th>
                  {heatmap.dayKeys.map((d) => (
                    <th key={d}>{new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.items.map((name) => (
                  <tr key={name}>
                    <td className="mp-heatmap-rowlabel">{truncate(name, 22)}</td>
                    {heatmap.dayKeys.map((d) => {
                      const val = heatmap.grid[name]?.[d] || 0;
                      const opacity = val === 0 ? 0 : Math.max(0.15, val / heatmap.max);
                      return (
                        <td key={d}>
                          <div
                            className="mp-heatmap-cell"
                            style={{ background: `rgba(${COLORS.masalaRgb}, ${opacity})`, color: opacity > 0.55 ? "#fff" : "inherit" }}
                            title={`${name} · ${d}: ${val}`}
                          >
                            {val > 0 ? val : ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mp-heatmap-hint">Darker cells mean more units sold that day. Scroll sideways to see all {heatmapPeriod} days.</p>
      </div>
    </div>
  );
}

function PeriodSelector({ value, onChange }) {
  return (
    <div className="mp-period-selector">
      {PERIOD_OPTIONS.map((p) => (
        <button key={p} className={value === p ? "active" : ""} onClick={() => onChange(p)}>
          {p}d
        </button>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="mp-stat-card">
      <Icon size={16} />
      <div><p>{label}</p><strong>{value}</strong></div>
    </div>
  );
}

function EmptySmall({ text = "Not enough data yet." }) {
  return <p className="mp-empty-small">{text}</p>;
}
