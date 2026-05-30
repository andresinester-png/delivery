import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder');

// Coordenadas de Vicuña Mackenna, Córdoba
export const MAP_CENTER = [
  parseFloat(import.meta.env.VITE_MAP_CENTER_LAT || '-33.9086'),
  parseFloat(import.meta.env.VITE_MAP_CENTER_LNG || '-64.3791'),
];

// Tarifa base de remises (en ARS)
export const FARE = {
  base: 800,       // tarifa base
  perKm: 350,      // por km
};
