-- ================================================================
-- VicuñaYa — Setup Completo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- Hace TODO: schema + usuario admin + 3 rotiserías + 5 pedidos
-- ================================================================

-- ── 1. Extensiones ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. Schema (tablas) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid REFERENCES auth.users(id),
  name          text NOT NULL,
  description   text,
  image_url     text,
  address       text,
  phone         text,
  whatsapp      text,
  category      text,
  rating        numeric(3,2) DEFAULT 0,
  delivery_time int,
  delivery_price numeric(10,2) DEFAULT 350,
  min_order     numeric(10,2),
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  sort_order    int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  name          text NOT NULL,
  description   text,
  price         numeric(10,2) NOT NULL,
  image_url     text,
  is_available  boolean DEFAULT true,
  sort_order    int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        uuid REFERENCES restaurants(id),
  customer_name        text NOT NULL,
  customer_phone       text NOT NULL,
  customer_address     text,
  notes                text,
  items                jsonb NOT NULL DEFAULT '[]',
  subtotal             numeric(10,2) NOT NULL,
  total                numeric(10,2) NOT NULL,
  payment_method       text NOT NULL,
  payment_status       text DEFAULT 'pending',
  transfer_receipt_url text,
  order_status         text DEFAULT 'pending',
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
  id            uuid PRIMARY KEY REFERENCES auth.users(id),
  name          text NOT NULL,
  phone         text,
  vehicle       text,
  license_plate text,
  photo_url     text,
  rating        numeric(3,2) DEFAULT 5.0,
  is_active     boolean DEFAULT false,
  lat           double precision,
  lng           double precision,
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid REFERENCES drivers(id),
  passenger_name  text NOT NULL,
  passenger_phone text NOT NULL,
  origin_address  text NOT NULL,
  origin_lat      double precision,
  origin_lng      double precision,
  dest_address    text NOT NULL,
  dest_lat        double precision,
  dest_lng        double precision,
  distance_km     numeric(8,2),
  estimated_price numeric(10,2),
  final_price     numeric(10,2),
  payment_method  text,
  status          text DEFAULT 'searching',
  driver_rating   int,
  created_at      timestamptz DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

-- ── 3. RLS ──────────────────────────────────────────────────────
ALTER TABLE restaurants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips          ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas para evitar duplicados
DROP POLICY IF EXISTS "restaurants_read"        ON restaurants;
DROP POLICY IF EXISTS "restaurants_write"       ON restaurants;
DROP POLICY IF EXISTS "menu_categories_read"    ON menu_categories;
DROP POLICY IF EXISTS "menu_categories_write"   ON menu_categories;
DROP POLICY IF EXISTS "menu_items_read"         ON menu_items;
DROP POLICY IF EXISTS "menu_items_write"        ON menu_items;
DROP POLICY IF EXISTS "orders_insert"           ON orders;
DROP POLICY IF EXISTS "orders_select"           ON orders;
DROP POLICY IF EXISTS "orders_update"           ON orders;
DROP POLICY IF EXISTS "drivers_read"            ON drivers;
DROP POLICY IF EXISTS "drivers_write"           ON drivers;
DROP POLICY IF EXISTS "trips_insert"            ON trips;
DROP POLICY IF EXISTS "trips_select"            ON trips;
DROP POLICY IF EXISTS "trips_update"            ON trips;

CREATE POLICY "restaurants_read"  ON restaurants FOR SELECT USING (true);
CREATE POLICY "restaurants_write" ON restaurants FOR ALL    USING (auth.uid() = owner_id);

CREATE POLICY "menu_categories_read"  ON menu_categories FOR SELECT USING (true);
CREATE POLICY "menu_categories_write" ON menu_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM restaurants WHERE id = menu_categories.restaurant_id AND owner_id = auth.uid()));

CREATE POLICY "menu_items_read"  ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_write" ON menu_items FOR ALL
  USING (EXISTS (SELECT 1 FROM restaurants WHERE id = menu_items.restaurant_id AND owner_id = auth.uid()));

CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM restaurants WHERE id = orders.restaurant_id AND owner_id = auth.uid()));

CREATE POLICY "drivers_read"  ON drivers FOR SELECT USING (true);
CREATE POLICY "drivers_write" ON drivers FOR ALL    USING (auth.uid() = id);

CREATE POLICY "trips_insert"  ON trips FOR INSERT WITH CHECK (true);
CREATE POLICY "trips_select"  ON trips FOR SELECT USING (true);
CREATE POLICY "trips_update"  ON trips FOR UPDATE USING (true);

-- ── 4. Realtime ─────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trips;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── 5. Storage (bucket para comprobantes) ───────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('delivery-receipts', 'delivery-receipts', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_upload" ON storage.objects;
DROP POLICY IF EXISTS "receipts_read"   ON storage.objects;
CREATE POLICY "receipts_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'delivery-receipts');
CREATE POLICY "receipts_read"   ON storage.objects FOR SELECT USING  (bucket_id = 'delivery-receipts');

-- ================================================================
-- ── 6. USUARIO ADMIN ────────────────────────────────────────────
-- ================================================================
DO $$
DECLARE
  v_uid  uuid := 'a1b2c3d4-0000-0000-0000-000000000001'::uuid;
  v_hash text;
BEGIN
  v_hash := crypt('vicunaya123', gen_salt('bf', 10));

  -- Limpiar si ya existe
  DELETE FROM auth.identities WHERE user_id = v_uid;
  DELETE FROM auth.users      WHERE id      = v_uid
                                 OR email   = 'admin@vicunaya.com';

  -- Insertar usuario
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@vicunaya.com', v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin VicuñaYa"}',
    false,
    now(), now(),
    '', '', '', ''
  );

  -- Insertar identity (necesario para login con email+password)
  INSERT INTO auth.identities (
    provider_id, user_id,
    identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_uid::text, v_uid,
    format('{"sub":"%s","email":"admin@vicunaya.com","email_verified":true,"phone_verified":false}', v_uid)::jsonb,
    'email',
    now(), now(), now()
  );

  RAISE NOTICE '✅ Usuario admin creado: admin@vicunaya.com / vicunaya123 (id: %)', v_uid;
END $$;

-- ================================================================
-- ── 7. RESTAURANTES Y MENÚS ─────────────────────────────────────
-- ================================================================
DO $$
DECLARE
  v_admin uuid := 'a1b2c3d4-0000-0000-0000-000000000001'::uuid;
  v_r1    uuid := 'b1b1b1b1-0000-0000-0000-000000000001'::uuid;
  v_r2    uuid := 'b2b2b2b2-0000-0000-0000-000000000002'::uuid;
  v_r3    uuid := 'b3b3b3b3-0000-0000-0000-000000000003'::uuid;
  v_c1a   uuid; v_c1b uuid; v_c1c uuid; v_c1d uuid;
  v_c2a   uuid; v_c2b uuid; v_c2c uuid;
  v_c3a   uuid; v_c3b uuid; v_c3c uuid;
BEGIN

  -- Limpiar datos previos
  DELETE FROM orders          WHERE restaurant_id IN (v_r1, v_r2, v_r3);
  DELETE FROM menu_items      WHERE restaurant_id IN (v_r1, v_r2, v_r3);
  DELETE FROM menu_categories WHERE restaurant_id IN (v_r1, v_r2, v_r3);
  DELETE FROM restaurants     WHERE id            IN (v_r1, v_r2, v_r3);

  -- ── Restaurante 1: La Rotisería de Don Carlos ──────────────────
  INSERT INTO restaurants (id, owner_id, name, description, category, rating,
                           delivery_time, delivery_price, min_order, whatsapp, address, is_active)
  VALUES (v_r1, v_admin,
    'La Rotisería de Don Carlos',
    'Las mejores milanesas y pollos asados de la ciudad desde 1985',
    'Rotisería', 4.8, 25, 350, 1500, '3571111001', 'Av. San Martín 350', true);

  -- Insertar categorías sin RETURNING (se recuperan con SELECT LIMIT 1 abajo)
  INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES
    (v_r1, 'Milanesas',       1),
    (v_r1, 'Pollos y Carnes', 2),
    (v_r1, 'Guarniciones',    3),
    (v_r1, 'Bebidas',         4);

  SELECT id INTO v_c1a FROM menu_categories WHERE restaurant_id = v_r1 AND name = 'Milanesas'       LIMIT 1;
  SELECT id INTO v_c1b FROM menu_categories WHERE restaurant_id = v_r1 AND name = 'Pollos y Carnes' LIMIT 1;
  SELECT id INTO v_c1c FROM menu_categories WHERE restaurant_id = v_r1 AND name = 'Guarniciones'    LIMIT 1;
  SELECT id INTO v_c1d FROM menu_categories WHERE restaurant_id = v_r1 AND name = 'Bebidas'         LIMIT 1;

  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (v_r1, v_c1a, 'Milanesa de ternera',  'Clásica apanada, 300gr aprox.',              1800, 1),
    (v_r1, v_c1a, 'Milanesa napolitana',  'Con salsa, jamón y queso gratinado',         2200, 2),
    (v_r1, v_c1a, 'Suprema de pollo',     'Pechuga apanada dorada',                     2000, 3),
    (v_r1, v_c1a, 'Milanesa a caballo',   'Con 2 huevos fritos encima',                 2400, 4),
    (v_r1, v_c1b, 'Pollo entero asado',   'Con hierbas y limón, condimentado especial', 3500, 1),
    (v_r1, v_c1b, 'Medio pollo',          'Con papas fritas incluidas',                 1900, 2),
    (v_r1, v_c1b, 'Cuarto de pollo',      'Pata y muslo o pechuga a elección',          1100, 3),
    (v_r1, v_c1c, 'Papas fritas',         'Crocantes, porción generosa',                 700, 1),
    (v_r1, v_c1c, 'Puré de papas',        'Casero, mantequilla y leche',                 650, 2),
    (v_r1, v_c1c, 'Ensalada mixta',       'Lechuga, tomate, zanahoria y cebolla',        600, 3),
    (v_r1, v_c1d, 'Coca-Cola 500ml',      'Con o sin azúcar',                            500, 1),
    (v_r1, v_c1d, 'Agua mineral 500ml',   'Con o sin gas',                               350, 2),
    (v_r1, v_c1d, 'Jugo de naranja',      'Natural exprimido',                           550, 3);

  -- ── Restaurante 2: Rotisería Los Hermanos ──────────────────────
  INSERT INTO restaurants (id, owner_id, name, description, category, rating,
                           delivery_time, delivery_price, min_order, whatsapp, address, is_active)
  VALUES (v_r2, v_admin,
    'Rotisería Los Hermanos',
    'Menú del día, minutas y sándwiches artesanales. ¡Abierto desde las 11!',
    'Rotisería', 4.6, 35, 400, 1200, '3571111002', 'Rivadavia 240', true);

  INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES
    (v_r2, 'Menú del Día', 1),
    (v_r2, 'Minutas',      2),
    (v_r2, 'Sándwiches',   3);

  SELECT id INTO v_c2a FROM menu_categories WHERE restaurant_id = v_r2 AND name = 'Menú del Día' LIMIT 1;
  SELECT id INTO v_c2b FROM menu_categories WHERE restaurant_id = v_r2 AND name = 'Minutas'      LIMIT 1;
  SELECT id INTO v_c2c FROM menu_categories WHERE restaurant_id = v_r2 AND name = 'Sándwiches'   LIMIT 1;

  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (v_r2, v_c2a, 'Menú ejecutivo',       'Sopa + plato principal + postre + bebida',     2500, 1),
    (v_r2, v_c2a, 'Menú light',           'Ensalada + grillado + agua',                   2200, 2),
    (v_r2, v_c2a, 'Menú del trabajador',  'Milanesa + guarnición + gaseosa',              2000, 3),
    (v_r2, v_c2b, 'Bife a la criolla',    'Con salsa criolla y papas',                    2800, 1),
    (v_r2, v_c2b, 'Pollo grillado',       'Con vegetales salteados y arroz',              2400, 2),
    (v_r2, v_c2b, 'Lomo al verdeo',       'Con salsa de crema y ciboulette',              3200, 3),
    (v_r2, v_c2b, 'Revuelto gramajo',     'Papas, huevos, jamón y morrón',               1800, 4),
    (v_r2, v_c2c, 'Sándwich de milanesa', 'En pan casero con lechuga, tomate y mayonesa', 1400, 1),
    (v_r2, v_c2c, 'Sándwich de pollo',    'Pechuga grillada con queso derretido',         1300, 2),
    (v_r2, v_c2c, 'Sándwich de lomo',     'Con morrón y chimichurri casero',              1600, 3);

  -- ── Restaurante 3: El Buen Gusto ──────────────────────────────
  INSERT INTO restaurants (id, owner_id, name, description, category, rating,
                           delivery_time, delivery_price, min_order, whatsapp, address, is_active)
  VALUES (v_r3, v_admin,
    'El Buen Gusto',
    'Empanadas artesanales, locro norteño y postres caseros. ¡Tradición desde 1972!',
    'Empanadas', 4.9, 30, 250, 800, '3571111003', 'Belgrano 512', true);

  INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES
    (v_r3, 'Empanadas',      1),
    (v_r3, 'Locro y Guisos', 2),
    (v_r3, 'Postres',        3);

  SELECT id INTO v_c3a FROM menu_categories WHERE restaurant_id = v_r3 AND name = 'Empanadas'      LIMIT 1;
  SELECT id INTO v_c3b FROM menu_categories WHERE restaurant_id = v_r3 AND name = 'Locro y Guisos' LIMIT 1;
  SELECT id INTO v_c3c FROM menu_categories WHERE restaurant_id = v_r3 AND name = 'Postres'        LIMIT 1;

  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, sort_order) VALUES
    (v_r3, v_c3a, 'Docena de carne',       'Carne picada con huevo, aceitunas y morrón', 2400, 1),
    (v_r3, v_c3a, 'Docena de pollo',       'Pollo deshilachado con verduras',            2200, 2),
    (v_r3, v_c3a, 'Docena jamón y queso',  'Con queso cremoso y jamón cocido',           2000, 3),
    (v_r3, v_c3a, 'Docena de humita',      'Maíz cremoso con pimientos',                 2100, 4),
    (v_r3, v_c3a, 'Unidad de carne',       'Al horno, relleno jugoso',                    200, 5),
    (v_r3, v_c3a, 'Unidad de pollo',       'Al horno con cebolla y pimientos',            185, 6),
    (v_r3, v_c3b, 'Locro norteño',         'Maíz, porotos, panceta y chorizo colorado',  1800, 1),
    (v_r3, v_c3b, 'Guiso de lentejas',     'Con verduras y chorizo, receta de la abuela', 1600, 2),
    (v_r3, v_c3b, 'Carbonada criolla',     'Zapallo, maíz, durazno y carne',             1700, 3),
    (v_r3, v_c3c, 'Flan casero',           'Con dulce de leche y crema',                  600, 1),
    (v_r3, v_c3c, 'Budín de pan',          'Con salsa de vainilla',                        550, 2),
    (v_r3, v_c3c, 'Ensalada de frutas',    'Fruta de estación con jugo de naranja',       700, 3);

  RAISE NOTICE '✅ 3 restaurantes y menús creados';
END $$;

-- ================================================================
-- ── 8. PEDIDOS DE EJEMPLO ───────────────────────────────────────
-- ================================================================
DO $$
DECLARE
  v_r1 uuid := 'b1b1b1b1-0000-0000-0000-000000000001'::uuid;
  v_r2 uuid := 'b2b2b2b2-0000-0000-0000-000000000002'::uuid;
  v_r3 uuid := 'b3b3b3b3-0000-0000-0000-000000000003'::uuid;
BEGIN

  INSERT INTO orders (restaurant_id, customer_name, customer_phone, customer_address, items, subtotal, total, payment_method, payment_status, order_status, created_at)
  VALUES
  -- Pedido 1: Entregado (hace 2 horas)
  (v_r1,
   'Juan Pérez', '3571-234567', 'San Martín 120, B° Centro',
   '[
     {"id":"item1","name":"Pollo entero asado","price":3500,"qty":1},
     {"id":"item2","name":"Papas fritas","price":700,"qty":2},
     {"id":"item3","name":"Coca-Cola 500ml","price":500,"qty":2}
   ]'::jsonb,
   5900, 6250, 'cash', 'confirmed', 'delivered',
   now() - interval '2 hours'),

  -- Pedido 2: Aceptado (hace 18 minutos)
  (v_r2,
   'María González', '3571-345678', 'Belgrano 88, B° Urquiza',
   '[
     {"id":"item4","name":"Menú ejecutivo","price":2500,"qty":2},
     {"id":"item5","name":"Sándwich de lomo","price":1600,"qty":1}
   ]'::jsonb,
   6600, 7000, 'card', 'confirmed', 'accepted',
   now() - interval '18 minutes'),

  -- Pedido 3: Preparando (hace 10 minutos)
  (v_r1,
   'Carlos Rodríguez', '3571-456789', 'Rivadavia 340, B° Sud',
   '[
     {"id":"item6","name":"Milanesa napolitana","price":2200,"qty":2},
     {"id":"item7","name":"Puré de papas","price":650,"qty":2},
     {"id":"item8","name":"Agua mineral 500ml","price":350,"qty":2}
   ]'::jsonb,
   6400, 6750, 'transfer', 'confirmed', 'preparing',
   now() - interval '10 minutes'),

  -- Pedido 4: Pendiente (hace 3 minutos)
  (v_r3,
   'Ana Martínez', '3571-567890', 'Av. Libertad 215, B° Norte',
   '[
     {"id":"item9","name":"Docena de carne","price":2400,"qty":1},
     {"id":"item10","name":"Docena de pollo","price":2200,"qty":1},
     {"id":"item11","name":"Locro norteño","price":1800,"qty":2}
   ]'::jsonb,
   8200, 8450, 'cash', 'pending', 'pending',
   now() - interval '3 minutes'),

  -- Pedido 5: Rechazado (hace 1 hora)
  (v_r2,
   'Luis Fernández', '3571-678901', 'Brown 77, B° Centro',
   '[
     {"id":"item12","name":"Bife a la criolla","price":2800,"qty":1},
     {"id":"item13","name":"Jugo de naranja","price":550,"qty":1}
   ]'::jsonb,
   3350, 3750, 'cash', 'pending', 'rejected',
   now() - interval '1 hour');

  RAISE NOTICE '✅ 5 pedidos de ejemplo creados';
END $$;

-- ── Verificación final ───────────────────────────────────────────
SELECT
  '👤 Usuarios'      AS tipo, count(*)::text AS cantidad FROM auth.users    WHERE email = 'admin@vicunaya.com'
UNION ALL
SELECT '🏪 Restaurantes', count(*)::text FROM restaurants
UNION ALL
SELECT '🍽️ Items de menú', count(*)::text FROM menu_items
UNION ALL
SELECT '📦 Pedidos',       count(*)::text FROM orders;
