import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Check, X, Flame, Clock, User, RefreshCw, LogOut,
  ClipboardList, Users, CircleCheck, CircleX, CircleDashed, BarChart3, Package
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { rupee, SPICE_LEVELS } from "../lib/menu";
import AnalyticsPanel from "./AnalyticsPanel";
import ProductsPanel from "./ProductsPanel";

export default function StaffDashboard() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (checkingSession) {
    return (
      <div className="mp-dash-loading">
        <Loader2 size={22} className="mp-spin" /> Loading…
      </div>
    );
  }
  if (!session) return <LoginForm />;
  return <Dashboard onSignOut={handleSignOut} />;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <div className="mp-login-page">
      <form className="mp-login-form" onSubmit={handleLogin}>
        <p className="mp-login-title">मु.पो.महाराष्ट्र</p>
        <h2>Staff sign in</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="mp-login-error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        <p className="mp-login-hint">
          Staff accounts are created in the Supabase dashboard — no public sign-up.
        </p>
      </form>
    </div>
  );
}

function Dashboard({ onSignOut }) {
  const [tab, setTab] = useState("orders");
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: c }, { data: o }, { data: oi }] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("order_items").select("*"),
    ]);
    setCustomers(c || []);
    setOrders(o || []);
    setOrderItems(oi || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const ordersWithItems = useMemo(
    () => orders.map((o) => ({ ...o, items: orderItems.filter((i) => i.order_id === o.id) })),
    [orders, orderItems]
  );

  const setOrderStatus = async (id, status) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    loadAll();
  };

  const updateCustomer = async (id, patch) => {
    await supabase.from("customers").update(patch).eq("id", id);
    loadAll();
  };

  return (
    <div className="mp-dashboard">
      <div className="mp-dash-header">
        <p className="mp-dash-title">Counter Desk</p>
        <div className="mp-dash-actions">
          <button onClick={loadAll}><RefreshCw size={13} /> Refresh</button>
          <button onClick={onSignOut}><LogOut size={13} /> Sign out</button>
        </div>
      </div>

      <div className="mp-dash-tabs">
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          <ClipboardList size={14} /> Orders
        </button>
        <button className={tab === "customers" ? "active" : ""} onClick={() => setTab("customers")}>
          <Users size={14} /> Customers
        </button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
          <Package size={14} /> Products
        </button>
        <button className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}>
          <BarChart3 size={14} /> Analytics
        </button>
      </div>

      {loading ? (
        <div className="mp-dash-loading"><Loader2 size={20} className="mp-spin" /> Loading data…</div>
      ) : tab === "orders" ? (
        <OrdersPanel orders={ordersWithItems} customers={customers} setOrderStatus={setOrderStatus} />
      ) : tab === "customers" ? (
        <CustomersPanel customers={customers} orders={ordersWithItems} updateCustomer={updateCustomer} />
      ) : tab === "products" ? (
        <ProductsPanel />
      ) : (
        <AnalyticsPanel orders={ordersWithItems} customers={customers} />
      )}
    </div>
  );
}

const STATUS_META = {
  pending: { icon: CircleDashed, label: "Pending", cls: "mp-status-pending" },
  completed: { icon: CircleCheck, label: "Completed", cls: "mp-status-completed" },
  cancelled: { icon: CircleX, label: "Cancelled", cls: "mp-status-cancelled" },
};

function OrdersPanel({ orders, customers, setOrderStatus }) {
  const [filter, setFilter] = useState("all");
  const custMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);
  const filtered = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div>
      <div className="mp-filter-row">
        {["all", "pending", "completed", "cancelled"].map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mp-empty">No orders here yet.</p>
      ) : (
        <div className="mp-order-list">
          {filtered.map((o) => {
            const c = custMap[o.customer_id];
            const meta = STATUS_META[o.status] || STATUS_META.pending;
            const StatusIcon = meta.icon;
            return (
              <div className="mp-order-card" key={o.id}>
                <div className="mp-order-card-top">
                  <p><User size={13} /> {c ? c.name : "Customer"}</p>
                  <p className="mp-order-card-time"><Clock size={11} /> {new Date(o.created_at).toLocaleString()}</p>
                  <span className={`mp-status ${meta.cls}`}><StatusIcon size={13} /> {meta.label}</span>
                  <span className="mp-order-card-total">{rupee(o.total)}</span>
                </div>
                <p className="mp-order-items-line">{o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</p>
                {o.status === "pending" && (
                  <div className="mp-order-actions">
                    <button className="mp-btn-complete" onClick={() => setOrderStatus(o.id, "completed")}>
                      <Check size={11} /> Complete
                    </button>
                    <button className="mp-btn-cancel" onClick={() => setOrderStatus(o.id, "cancelled")}>
                      <X size={11} /> Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomersPanel({ customers, orders, updateCustomer }) {
  const [editingId, setEditingId] = useState(null);

  const stats = useMemo(() => {
    const map = {};
    for (const c of customers) {
      const custOrders = orders.filter((o) => o.customer_id === c.id);
      const itemCount = {};
      let spent = 0;
      for (const o of custOrders) {
        spent += Number(o.total);
        for (const it of o.items) itemCount[it.name] = (itemCount[it.name] || 0) + it.qty;
      }
      const top = Object.entries(itemCount).sort((a, b) => b[1] - a[1])[0];
      map[c.id] = { orderCount: custOrders.length, spent, topItem: top ? top[0] : null };
    }
    return map;
  }, [customers, orders]);

  if (customers.length === 0) return <p className="mp-empty">No customers yet — they'll appear after the first order.</p>;

  return (
    <div className="mp-customers-grid">
      {customers.map((c) => {
        const s = stats[c.id] || { orderCount: 0, spent: 0, topItem: null };
        const editing = editingId === c.id;
        return (
          <div className="mp-customer-card" key={c.id}>
            <div className="mp-customer-top">
              <div>
                <p className="mp-customer-name">{c.name}</p>
                <p className="mp-customer-phone">{c.phone}</p>
              </div>
              <button className="mp-edit-btn" onClick={() => setEditingId(editing ? null : c.id)}>
                {editing ? "Close" : "Edit"}
              </button>
            </div>

            <div className="mp-customer-stats">
              <div><p>Orders</p><strong>{s.orderCount}</strong></div>
              <div><p>Spent</p><strong>{rupee(s.spent)}</strong></div>
            </div>

            {(c.favorite_override || s.topItem) && (
              <p className="mp-customer-fav"><Flame size={11} /> Likes: {c.favorite_override || s.topItem}</p>
            )}
            {c.spice_level && <span className="mp-tag">{c.spice_level}</span>}
            {c.dietary_notes && <p className="mp-customer-notes">{c.dietary_notes}</p>}

            {editing && (
              <CustomerEditForm
                customer={c}
                onSave={(patch) => { updateCustomer(c.id, patch); setEditingId(null); }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CustomerEditForm({ customer, onSave }) {
  const [form, setForm] = useState({
    address: customer.address || "",
    spice_level: customer.spice_level || "",
    favorite_override: customer.favorite_override || "",
    dietary_notes: customer.dietary_notes || "",
  });

  return (
    <div className="mp-customer-edit">
      <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <select value={form.spice_level} onChange={(e) => setForm({ ...form, spice_level: e.target.value })}>
        <option value="">Spice level: not set</option>
        {SPICE_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input placeholder="Favorite item override" value={form.favorite_override} onChange={(e) => setForm({ ...form, favorite_override: e.target.value })} />
      <textarea placeholder="Dietary notes" value={form.dietary_notes} onChange={(e) => setForm({ ...form, dietary_notes: e.target.value })} />
      <button onClick={() => onSave(form)}>Save</button>
    </div>
  );
}
