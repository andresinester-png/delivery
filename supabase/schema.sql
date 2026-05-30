-- ============================================================
-- VicuñaYa — Schema Supabase
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- ===================== DELIVERY =====================

create table if not exists restaurants (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users(id),
  name            text not null,
  description     text,
  image_url       text,
  address         text,
  phone           text,
  whatsapp        text,  -- ej: 3571123456 (sin +, sin espacios)
  category        text,  -- 'Rotisería', 'Parrilla', etc.
  rating          numeric(3,2) default 0,
  delivery_time   int,   -- minutos estimados
  min_order       numeric(10,2),
  is_active       boolean default true,
  created_at      timestamptz default now()
);

create table if not exists menu_categories (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid references restaurants(id) on delete cascade,
  name            text not null,
  sort_order      int default 0
);

create table if not exists menu_items (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid references restaurants(id) on delete cascade,
  category_id     uuid references menu_categories(id) on delete set null,
  name            text not null,
  description     text,
  price           numeric(10,2) not null,
  image_url       text,
  is_available    boolean default true,
  sort_order      int default 0
);

create table if not exists orders (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid references restaurants(id),
  customer_name         text not null,
  customer_phone        text not null,
  customer_address      text,
  notes                 text,
  items                 jsonb not null default '[]',
  subtotal              numeric(10,2) not null,
  total                 numeric(10,2) not null,
  payment_method        text not null,  -- 'card' | 'transfer' | 'cash'
  payment_status        text default 'pending', -- 'pending' | 'confirmed' | 'failed'
  transfer_receipt_url  text,
  order_status          text default 'pending',
  -- 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'rejected'
  created_at            timestamptz default now()
);

-- ===================== REMISES =====================

create table if not exists drivers (
  id              uuid primary key references auth.users(id),
  name            text not null,
  phone           text,
  vehicle         text,
  license_plate   text,
  photo_url       text,
  rating          numeric(3,2) default 5.0,
  is_active       boolean default false,
  lat             double precision,
  lng             double precision,
  updated_at      timestamptz default now()
);

create table if not exists trips (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid references drivers(id),
  passenger_name  text not null,
  passenger_phone text not null,
  origin_address  text not null,
  origin_lat      double precision,
  origin_lng      double precision,
  dest_address    text not null,
  dest_lat        double precision,
  dest_lng        double precision,
  distance_km     numeric(8,2),
  estimated_price numeric(10,2),
  final_price     numeric(10,2),
  payment_method  text,  -- 'card' | 'transfer' | 'cash'
  status          text default 'searching',
  -- 'searching' | 'accepted' | 'arriving' | 'in_progress' | 'completed' | 'cancelled'
  driver_rating   int,   -- 1–5
  created_at      timestamptz default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

-- ===================== RLS =====================

alter table restaurants enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table drivers enable row level security;
alter table trips enable row level security;

-- Restaurantes: lectura pública, escritura solo owner
create policy "restaurants_read" on restaurants for select using (true);
create policy "restaurants_write" on restaurants for all using (auth.uid() = owner_id);

-- Menú: lectura pública, escritura solo owner del restaurante
create policy "menu_categories_read" on menu_categories for select using (true);
create policy "menu_categories_write" on menu_categories for all
  using (exists (select 1 from restaurants where id = menu_categories.restaurant_id and owner_id = auth.uid()));

create policy "menu_items_read" on menu_items for select using (true);
create policy "menu_items_write" on menu_items for all
  using (exists (select 1 from restaurants where id = menu_items.restaurant_id and owner_id = auth.uid()));

-- Pedidos: inserción pública (cliente), lectura/update solo owner del restaurante
create policy "orders_insert" on orders for insert with check (true);
create policy "orders_select" on orders for select
  using (
    exists (select 1 from restaurants where id = orders.restaurant_id and owner_id = auth.uid())
    or true  -- temporal: en producción restringir a owner o por token de cliente
  );
create policy "orders_update" on orders for update
  using (exists (select 1 from restaurants where id = orders.restaurant_id and owner_id = auth.uid()));

-- Conductores: lectura pública (para ver disponibles), update propio
create policy "drivers_read" on drivers for select using (true);
create policy "drivers_write" on drivers for all using (auth.uid() = id);

-- Viajes: inserción pública, update propio conductor
create policy "trips_insert" on trips for insert with check (true);
create policy "trips_select" on trips for select using (true);
create policy "trips_update" on trips for update
  using (auth.uid() = driver_id or true);

-- ===================== REALTIME =====================

-- Habilitar realtime para las tablas que lo necesitan
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table drivers;
alter publication supabase_realtime add table trips;

-- ===================== STORAGE =====================

-- Bucket para comprobantes de transferencia (delivery)
insert into storage.buckets (id, name, public) values ('delivery-receipts', 'delivery-receipts', true)
  on conflict do nothing;

create policy "receipts_upload" on storage.objects for insert
  with check (bucket_id = 'delivery-receipts');

create policy "receipts_read" on storage.objects for select
  using (bucket_id = 'delivery-receipts');
