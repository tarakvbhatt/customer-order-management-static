-- मु.पो.महाराष्ट्र — database schema for Supabase
-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  address text,
  spice_level text,
  dietary_notes text,
  favorite_override text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  total numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  name text not null,
  price numeric not null,
  qty int not null check (qty > 0)
);

create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_order_items_order_id on order_items(order_id);

-- ---------- Row Level Security ----------
-- Public visitors (the "anon" role) get NO direct table access.
-- They place orders only through the place_order() function below.
-- Staff (signed in via Supabase Auth, the "authenticated" role) get full access,
-- which is what powers the staff dashboard.

alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "staff full access - customers" on customers
  for all to authenticated using (true) with check (true);

create policy "staff full access - orders" on orders
  for all to authenticated using (true) with check (true);

create policy "staff full access - order_items" on order_items
  for all to authenticated using (true) with check (true);

-- ---------- Public ordering function ----------
-- Called from the website's order form. Runs with elevated privileges
-- (security definer) so anonymous customers can place an order without
-- being able to read or edit anyone else's data.

create or replace function place_order(
  p_name text,
  p_phone text,
  p_items jsonb,   -- e.g. [{"name": "Mumbai Vada Pav", "price": 25, "qty": 2}, ...]
  p_total numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  item jsonb;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Name is required';
  end if;
  if p_phone is null or trim(p_phone) = '' then
    raise exception 'Phone is required';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must have at least one item';
  end if;

  select id into v_customer_id from customers where phone = trim(p_phone);
  if v_customer_id is null then
    insert into customers (name, phone) values (trim(p_name), trim(p_phone))
    returning id into v_customer_id;
  end if;

  insert into orders (customer_id, total, status)
  values (v_customer_id, p_total, 'pending')
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, name, price, qty)
    values (v_order_id, item->>'name', (item->>'price')::numeric, (item->>'qty')::int);
  end loop;

  return v_order_id;
end;
$$;

-- Allow both anonymous website visitors and signed-in staff to call it.
grant execute on function place_order(text, text, jsonb, numeric) to anon, authenticated;

-- ---------- Menu items (admin-managed product catalog) ----------
-- Lets staff control availability, price, and photo for each dish from the
-- staff dashboard, instead of these being hardcoded in the frontend.

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('Food', 'Drinks', 'Extras')),
  price numeric,                 -- null for variable-price items (e.g. Soft Drinks, sold at printed MRP)
  variable_price boolean not null default false,
  available boolean not null default true,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table menu_items enable row level security;

-- Public order form only ever sees items marked available.
create policy "public can view available menu items" on menu_items
  for select to anon using (available = true);

-- Staff (signed in) manage the full catalog, including hidden/unavailable items.
create policy "staff full access - menu_items" on menu_items
  for all to authenticated using (true) with check (true);

-- ---------- Product images (Supabase Storage) ----------

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "staff can upload menu images" on storage.objects
  for insert to authenticated with check (bucket_id = 'menu-images');

create policy "staff can update menu images" on storage.objects
  for update to authenticated using (bucket_id = 'menu-images');

create policy "staff can delete menu images" on storage.objects
  for delete to authenticated using (bucket_id = 'menu-images');

-- ---------- Seed the current menu ----------
-- Safe to re-run: existing rows (matched by name) are left untouched.

insert into menu_items (name, category, price, variable_price, sort_order) values
  ('Mu.Po Special Loni Thalipeeth', 'Food', 120, false, 1),
  ('Thalipeeth (Oil)', 'Food', 100, false, 2),
  ('Khamang Thalipeeth', 'Food', 120, false, 3),
  ('Kolhapuri Misal Pav', 'Food', 110, false, 4),
  ('Kolhapuri Dahi Misal Pav', 'Food', 120, false, 5),
  ('Kat Vada (1 pc)', 'Food', 60, false, 6),
  ('Katt Vada with Pav (2 pc)', 'Food', 110, false, 7),
  ('Batata Vada', 'Food', 20, false, 8),
  ('Mumbai Vada Pav', 'Food', 25, false, 9),
  ('Butter Vada Pav', 'Food', 30, false, 10),
  ('Cheese Vada Pav', 'Food', 40, false, 11),
  ('Kothimbir Vadi (4 pcs)', 'Food', 80, false, 12),
  ('Thecha Vada Pav', 'Food', 35, false, 13),
  ('Maharashtrian Poha', 'Food', 30, false, 14),
  ('Kokam Sarbat', 'Drinks', 50, false, 1),
  ('Solkadi', 'Drinks', 50, false, 2),
  ('Soft Drinks', 'Drinks', null, true, 3),
  ('Farsan', 'Extras', 20, false, 1),
  ('Dahi', 'Extras', 10, false, 2),
  ('Pav', 'Extras', 10, false, 3)
on conflict (name) do nothing;
