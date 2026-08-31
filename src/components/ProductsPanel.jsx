import React, { useState, useEffect, useRef } from "react";
import { Loader2, Upload, ImageOff, Check, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES, rupee } from "../lib/menu";

export default function ProductsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("menu_items").select("*").order("category").order("sort_order");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patchItem = (id, patch) => {
    // Optimistic local update so the UI feels instant; load() below re-syncs from the DB.
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const toggleAvailability = async (item) => {
    const next = !item.available;
    patchItem(item.id, { available: next });
    await supabase.from("menu_items").update({ available: next }).eq("id", item.id);
  };

  const savePrice = async (item, newPrice) => {
    const value = newPrice === "" ? null : Number(newPrice);
    patchItem(item.id, { price: value });
    await supabase.from("menu_items").update({ price: value }).eq("id", item.id);
  };

  const uploadImage = async (item, file) => {
    patchItem(item.id, { uploading: true });
    const ext = file.name.split(".").pop();
    const path = `${item.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("menu-images").upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      await supabase.from("menu_items").update({ image_url: data.publicUrl }).eq("id", item.id);
      patchItem(item.id, { image_url: data.publicUrl, uploading: false });
    } else {
      console.error(uploadError);
      patchItem(item.id, { uploading: false });
    }
  };

  const removeImage = async (item) => {
    patchItem(item.id, { image_url: null });
    await supabase.from("menu_items").update({ image_url: null }).eq("id", item.id);
  };

  if (loading) return <div className="mp-dash-loading"><Loader2 size={20} className="mp-spin" /> Loading products…</div>;

  return (
    <div className="mp-products">
      {CATEGORIES.map((category) => {
        const catItems = items.filter((i) => i.category === category);
        if (catItems.length === 0) return null;
        return (
          <div key={category} className="mp-products-category">
            <p className="mp-products-category-title">{category}</p>
            <div className="mp-products-list">
              {catItems.map((item) => (
                <ProductRow
                  key={item.id}
                  item={item}
                  onToggleAvailability={() => toggleAvailability(item)}
                  onSavePrice={(v) => savePrice(item, v)}
                  onUploadImage={(f) => uploadImage(item, f)}
                  onRemoveImage={() => removeImage(item)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductRow({ item, onToggleAvailability, onSavePrice, onUploadImage, onRemoveImage }) {
  const [priceInput, setPriceInput] = useState(item.price ?? "");
  const [priceDirty, setPriceDirty] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!priceDirty) setPriceInput(item.price ?? "");
  }, [item.price, priceDirty]);

  const handlePriceBlur = () => {
    if (String(priceInput) !== String(item.price ?? "")) onSavePrice(priceInput);
    setPriceDirty(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUploadImage(file);
    e.target.value = "";
  };

  return (
    <div className={`mp-product-row ${!item.available ? "mp-product-row-disabled" : ""}`}>
      <div className="mp-product-thumb-wrap">
        {item.uploading ? (
          <div className="mp-product-thumb mp-product-thumb-placeholder"><Loader2 size={16} className="mp-spin" /></div>
        ) : item.image_url ? (
          <div className="mp-product-thumb-img-wrap">
            <img src={item.image_url} alt={item.name} className="mp-product-thumb" />
            <button type="button" className="mp-product-thumb-remove" onClick={onRemoveImage} title="Remove image">
              <X size={10} />
            </button>
          </div>
        ) : (
          <button type="button" className="mp-product-thumb mp-product-thumb-placeholder" onClick={() => fileInputRef.current?.click()} title="Upload image">
            <ImageOff size={14} />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="mp-hidden-file-input" onChange={handleFileChange} />
        {!item.uploading && (
          <button type="button" className="mp-product-upload-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload size={10} /> {item.image_url ? "Replace" : "Upload"}
          </button>
        )}
      </div>

      <div className="mp-product-name-col">
        <p className="mp-product-name">{item.name}</p>
        {item.variable_price && <span className="mp-tag">MRP at order time</span>}
      </div>

      <div className="mp-product-price-col">
        {item.variable_price ? (
          <span className="mp-product-mrp-note">—</span>
        ) : (
          <div className="mp-price-input-wrap">
            <span>₹</span>
            <input
              type="number"
              value={priceInput}
              onChange={(e) => { setPriceInput(e.target.value); setPriceDirty(true); }}
              onBlur={handlePriceBlur}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        className={`mp-availability-toggle ${item.available ? "on" : "off"}`}
        onClick={onToggleAvailability}
        title={item.available ? "Available — click to hide from customers" : "Hidden — click to make available"}
      >
        <span className="mp-toggle-knob" />
      </button>
      <span className={`mp-availability-label ${item.available ? "on" : "off"}`}>
        {item.available ? <><Check size={11} /> Available</> : <><X size={11} /> Hidden</>}
      </span>
    </div>
  );
}
