// Menu items themselves now live in the Supabase `menu_items` table so staff
// can control availability, price, and photos from the dashboard (see
// components/OrderForm.jsx and components/ProductsPanel.jsx for the fetches).
// This file just keeps small shared constants/helpers used across components.

export const CATEGORIES = ["Food", "Drinks", "Extras"];
export const SPICE_LEVELS = ["Mild", "Medium", "Spicy", "Extra Spicy"];

export const rupee = (n) => `\u20b9${Number(n || 0).toFixed(0)}`;
