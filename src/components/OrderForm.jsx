import React, { useState, useEffect, useMemo } from "react";
import { Plus, Minus, Flame, Check, Loader2, ImageOff } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES, rupee } from "../lib/menu";

export default function OrderForm() {
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [cart, setCart] = useState([]); // {name, price, qty}
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [softDrinkPrice, setSoftDrinkPrice] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("available", true)
        .order("category")
        .order("sort_order");
      if (!error) setMenuItems(data || []);
      setMenuLoading(false);
    })();
  }, []);

  const menuByCategory = useMemo(() => {
    const grouped = {};
    CATEGORIES.forEach((c) => { grouped[c] = []; });
    menuItems.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });
    return grouped;
  }, [menuItems]);

  const addItem = (item, priceOverride) => {
    const price = item.variable_price ? priceOverride : item.price;
    if (item.variable_price && (price == null || isNaN(price) || price <= 0)) {
      setErrorMsg(`Enter a price for ${item.name} first`);
      return;
    }
    setErrorMsg("");
    setCart((prev) => {
      const idx = prev.findIndex((p) => p.name === item.name && p.price === price);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { name: item.name, price, qty: 1 }];
    });
  };

  const changeQty = (itemName, price, delta) => {
    setCart((prev) =>
      prev
        .map((p) => (p.name === itemName && p.price === price ? { ...p, qty: p.qty + delta } : p))
        .filter((p) => p.qty > 0)
    );
  };

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const submitOrder = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (cart.length === 0) {
      setErrorMsg("Add at least one item to your order.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setErrorMsg("Please enter your name and phone number.");
      return;
    }

    setStatus("submitting");
    const { error } = await supabase.rpc("place_order", {
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_items: cart.map(({ name, price, qty }) => ({ name, price, qty })),
      p_total: total,
    });

    if (error) {
      console.error(error);
      setStatus("error");
      setErrorMsg("Something went wrong placing your order. Please try again or order via WhatsApp.");
      return;
    }

    setStatus("success");
    setCart([]);
    setName("");
    setPhone("");
    setSoftDrinkPrice("");
  };

  if (status === "success") {
    return (
      <div className="mp-order-success">
        <div className="mp-order-success-icon"><Check size={28} /></div>
        <h2>Order received!</h2>
        <p>Thanks {name || "there"} — we're on it. You'll be able to pick it up shortly.</p>
        <button onClick={() => setStatus("idle")}>Place another order</button>
      </div>
    );
  }

  return (
    <div className="mp-order-page">
      <h1 className="mp-order-title">Place Your Order</h1>

      {menuLoading ? (
        <div className="mp-dash-loading"><Loader2 size={20} className="mp-spin" /> Loading menu…</div>
      ) : (
        <form className="mp-order-layout" onSubmit={submitOrder}>
          <div className="mp-order-menu">
            {CATEGORIES.map((category) =>
              (menuByCategory[category] || []).length === 0 ? null : (
                <div key={category} className="mp-order-category">
                  <h3>{category}</h3>
                  <div className="mp-order-items">
                    {menuByCategory[category].map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="mp-order-item"
                        onClick={() => addItem(item, Number(softDrinkPrice))}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="mp-order-item-img" />
                        ) : (
                          <span className="mp-order-item-img mp-order-item-img-placeholder"><ImageOff size={14} /></span>
                        )}
                        <span className="mp-order-item-info">
                          <span className="mp-order-item-name">
                            {item.name}
                            {item.category === "Food" && /misal|thecha/i.test(item.name) && <Flame size={12} />}
                          </span>
                          {item.variable_price ? (
                            <input
                              type="number"
                              placeholder="MRP ₹"
                              value={softDrinkPrice}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setSoftDrinkPrice(e.target.value)}
                              className="mp-order-item-mrp-input"
                            />
                          ) : (
                            <span className="mp-order-item-price">{rupee(item.price)}</span>
                          )}
                        </span>
                        <Plus size={14} className="mp-order-item-add" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
            {menuItems.length === 0 && <p className="mp-empty">No items available right now — please check back soon.</p>}
          </div>

          <div className="mp-order-ticket">
            <h3>Order Chit</h3>
            <div className="mp-order-cart">
              {cart.length === 0 ? (
                <p className="mp-order-empty">No items yet — tap a dish to add it.</p>
              ) : (
                cart.map((item) => (
                  <div className="mp-order-cart-row" key={item.name + item.price}>
                    <span className="mp-cart-row-name">{item.name}</span>
                    <div className="mp-cart-row-qty">
                      <button type="button" onClick={() => changeQty(item.name, item.price, -1)}><Minus size={11} /></button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => changeQty(item.name, item.price, 1)}><Plus size={11} /></button>
                    </div>
                    <span className="mp-cart-row-price">{rupee(item.price * item.qty)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mp-order-total-row">
              <span>Total</span>
              <span>{rupee(total)}</span>
            </div>

            <div className="mp-order-details">
              <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>

            {errorMsg && <p className="mp-order-error">{errorMsg}</p>}

            <button type="submit" disabled={status === "submitting"} className="mp-order-submit">
              {status === "submitting" ? <Loader2 size={15} className="mp-spin" /> : <Check size={15} />}
              {status === "submitting" ? "Placing order…" : `Place order — ${rupee(total)}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
