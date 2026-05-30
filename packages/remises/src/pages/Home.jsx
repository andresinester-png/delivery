import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Car, MapPin, Star, Shield } from 'lucide-react';
import { supabase, MAP_CENTER } from '../lib/supabase.js';

// Icono personalizado para conductor
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:#FA0050;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px">🚗</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export default function Home() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrivers = async () => {
      const { data } = await supabase.from('drivers').select('*').eq('is_active', true);
      setDrivers(data || []);
      setLoading(false);
    };
    fetchDrivers();

    // Realtime: posición de conductores
    const channel = supabase
      .channel('active-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchDrivers())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <nav className="bg-white shadow-nav z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-primary font-extrabold text-2xl">Vicuña</span>
            <span className="bg-primary text-white font-extrabold text-2xl px-1.5 rounded-lg">Ya</span>
            <span className="ml-2 text-sm font-medium text-gray-500 hidden sm:block">Remises</span>
          </div>
          <button onClick={() => navigate('/conductor/login')} className="text-sm text-gray-500 hover:text-primary transition-colors font-medium">
            Soy conductor →
          </button>
        </div>
      </nav>

      {/* Mapa */}
      <div className="flex-1 relative">
        <MapContainer
          center={MAP_CENTER}
          zoom={14}
          style={{ height: '100%', minHeight: '400px', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {drivers.filter(d => d.lat && d.lng).map(driver => (
            <Marker key={driver.id} position={[driver.lat, driver.lng]} icon={driverIcon}>
              <Popup>
                <div className="text-sm font-semibold">{driver.name}</div>
                <div className="text-xs text-gray-500">{driver.vehicle}</div>
                <div className="text-xs flex items-center gap-1 text-amber-500">
                  ★ {driver.rating?.toFixed(1)}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Panel inferior */}
      <div className="bg-white rounded-t-3xl shadow-2xl p-6 z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-bg rounded-xl flex items-center justify-center">
            <Car className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="font-bold text-lg">¿A dónde vas?</h1>
            <p className="text-xs text-gray-500">
              {loading ? 'Buscando conductores...' : `${drivers.length} conductor${drivers.length !== 1 ? 'es' : ''} disponible${drivers.length !== 1 ? 's' : ''} cerca`}
            </p>
          </div>
        </div>

        <button onClick={() => navigate('/pedir')} className="w-full flex items-center gap-3 border-2 border-neutral-200 rounded-xl px-4 py-3.5 hover:border-primary transition-colors text-left mb-4">
          <MapPin size={18} className="text-primary shrink-0" />
          <span className="text-gray-400 text-sm">Ingresá tu destino...</span>
        </button>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Car, label: 'Seguimiento en tiempo real' },
            { icon: Star, label: 'Calificá tu viaje' },
            { icon: Shield, label: 'Conductores verificados' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 bg-primary-bg rounded-xl flex items-center justify-center">
                <Icon className="text-primary" size={18} />
              </div>
              <span className="text-xs text-gray-500 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
