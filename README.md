# VicuñaYa — Monorepo

Dos apps para Vicuña Mackenna, Córdoba, Argentina.

## Apps

| App | Puerto | Descripción |
|-----|--------|-------------|
| `packages/delivery` | :3000 | Delivery estilo PedidosYa |
| `packages/remises` | :3001 | Remises estilo Uber |

## Setup inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New project
2. Copiar `Project URL` y `anon public` key
3. Ir a **SQL Editor** y ejecutar `supabase/schema.sql`
4. Opcional: ejecutar `supabase/seed.sql` para datos de ejemplo

### 3. Variables de entorno

```bash
# Delivery
cp packages/delivery/.env.example packages/delivery/.env

# Remises
cp packages/remises/.env.example packages/remises/.env
```

Editar cada `.env` con las credenciales de Supabase.

### 4. Levantar apps

```bash
# Ambas en paralelo
npm run dev

# Solo Delivery
npm run dev:delivery

# Solo Remises
npm run dev:remises
```

## MercadoPago

1. Crear cuenta en [mercadopago.com.ar](https://mercadopago.com.ar)
2. Ir a Tus integraciones → Credenciales
3. Copiar **Public key** y pegarla en el `.env` como `VITE_MP_PUBLIC_KEY`

Para pagos reales con tarjeta se necesita también una **backend edge function** en Supabase para crear la preferencia de pago de forma segura (nunca exponer la Access Token en el frontend).

## Crear usuario admin (Delivery)

1. Supabase → Authentication → Users → Add user
2. Email + contraseña del negocio
3. Anotar el UUID del usuario creado
4. Ejecutar en SQL Editor:
   ```sql
   UPDATE restaurants SET owner_id = 'UUID-DEL-USUARIO' WHERE name = 'nombre-del-restaurante';
   ```

## Crear cuenta conductor (Remises)

1. Supabase → Authentication → Users → Add user
2. En SQL Editor:
   ```sql
   INSERT INTO drivers (id, name, phone, vehicle, license_plate)
   VALUES ('UUID-DEL-USUARIO', 'Nombre Conductor', '3571000000', 'Fiat Cronos 2022', 'ABC123');
   ```

## Estructura

```
vicunaya/
├── packages/
│   ├── delivery/          App 1: Delivery
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Home.jsx
│   │       │   ├── Restaurant.jsx
│   │       │   ├── Checkout.jsx
│   │       │   ├── OrderTracking.jsx
│   │       │   └── admin/
│   │       │       ├── AdminDashboard.jsx
│   │       │       ├── MenuManagement.jsx
│   │       │       └── Earnings.jsx
│   │       └── components/
│   ├── remises/           App 2: Remises
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Home.jsx          (mapa con conductores)
│   │       │   ├── RequestTrip.jsx   (pedir remis)
│   │       │   ├── TripTracking.jsx  (seguimiento)
│   │       │   ├── RateDriver.jsx    (calificación)
│   │       │   └── driver/
│   │       │       └── DriverDashboard.jsx
│   │       └── components/
│   └── ui/                Tema y componentes compartidos
├── supabase/
│   ├── schema.sql          Tablas + RLS + Storage
│   └── seed.sql            Datos de ejemplo
└── turbo.json
```

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Mapas**: Leaflet + OpenStreetMap (gratuito)
- **Pagos**: MercadoPago (tarjeta) + Transferencia + Efectivo
- **Monorepo**: Turborepo
