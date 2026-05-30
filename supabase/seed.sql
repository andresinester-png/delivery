-- ============================================================
-- Seed de ejemplo — VicuñaYa Delivery
-- ============================================================
-- Primero crear un usuario admin en Supabase Auth, luego ejecutar este seed
-- reemplazando 'TU-USER-ID' con el ID del usuario creado.

-- Restaurante de ejemplo
insert into restaurants (name, description, image_url, address, whatsapp, category, rating, delivery_time, min_order, is_active, owner_id)
values
  ('La Rotisería de Don Carlos', 'Las mejores milanesas y pollos asados de Vicuña Mackenna', null, 'Av. San Martín 350', '3571000001', 'Rotisería', 4.8, 30, 1500, true, (select id from auth.users limit 1)),
  ('Parrilla El Gaucho', 'Asado y parrillada al mejor estilo cordobés', null, 'Rivadavia 120', '3571000002', 'Parrilla', 4.6, 45, 2000, true, (select id from auth.users limit 1)),
  ('Pizza & Co.', 'Pizzas artesanales a la piedra', null, 'Belgrano 500', '3571000003', 'Pizza', 4.5, 25, 1200, true, (select id from auth.users limit 1));

-- Categorías para el primer restaurante
with rest as (select id from restaurants where name = 'La Rotisería de Don Carlos' limit 1)
insert into menu_categories (restaurant_id, name, sort_order)
select rest.id, unnest(array['Milanesas', 'Pollos', 'Guarniciones', 'Bebidas']), generate_series(0, 3)
from rest;

-- Items del menú
with cat as (select mc.id, mc.name from menu_categories mc join restaurants r on r.id = mc.restaurant_id where r.name = 'La Rotisería de Don Carlos')
insert into menu_items (restaurant_id, category_id, name, description, price, is_available)
select
  (select id from restaurants where name = 'La Rotisería de Don Carlos'),
  cat.id,
  item.name,
  item.desc,
  item.price,
  true
from (
  select 'Milanesas' as cat_name, 'Milanesa de ternera' as name, 'Clásica apanada, 300gr' as desc, 1800 as price
  union all select 'Milanesas', 'Milanesa a la napolitana', 'Con salsa, jamón y queso', 2200
  union all select 'Pollos', 'Pollo entero asado', 'Condimentado con hierbas', 3500
  union all select 'Pollos', 'Medio pollo', 'Con papas fritas', 2200
  union all select 'Guarniciones', 'Papas fritas', 'Crocantes, porción', 600
  union all select 'Guarniciones', 'Ensalada mixta', 'Lechuga, tomate, zanahoria', 500
  union all select 'Bebidas', 'Gaseosa 500ml', 'Coca-Cola, Sprite o 7Up', 400
  union all select 'Bebidas', 'Agua mineral 500ml', 'Con o sin gas', 300
) item
join cat on cat.name = item.cat_name;
