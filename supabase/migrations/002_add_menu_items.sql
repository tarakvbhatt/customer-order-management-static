-- Incremental migration: adds admin-managed product catalog (availability,
-- price, image) on top of an existing मु.पो.महाराष्ट्र database.
--
-- Run this instead of the full schema.sql if you already ran schema.sql
-- previously — running the whole file again will fail on policies that
-- already exist for customers/orders/order_items.

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

create policy "public can view available menu items" on menu_items
  for select to anon using (available = true);

create policy "staff full access - menu_items" on menu_items
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "staff can upload menu images" on storage.objects
  for insert to authenticated with check (bucket_id = 'menu-images');

create policy "staff can update menu images" on storage.objects
  for update to authenticated using (bucket_id = 'menu-images');

create policy "staff can delete menu images" on storage.objects
  for delete to authenticated using (bucket_id = 'menu-images');

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
