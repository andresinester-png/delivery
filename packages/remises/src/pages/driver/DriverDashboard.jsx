import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Power, CheckCircle, XCircle, Navigation, Star, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase, MAP_CENTER } from '../../lib/supabase.js';

const myIcon = L.divIcon({
  className: '',
  html: `<div style="background:#FA0050;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:4px solid white;box-shadow:0 2px 12px rgba(250,0,80,0.4);font-size:22px">🚗</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [pendingTrips, setPendingTrips] = useState([]);
  const [myPos, setMyPos] = useState(MAP_CENTER);
  const watchRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('drivers').select('*').eq('id', user.id).single();
      if (data) { setDriver(data); setIsActive(data.is_active); }
    };
    init();
    fetchPendingTrips();

    const channel = supabase
      .channel('driver-trips')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips', filter: 'status=eq.searching' }, () => {
        fetchPendingTrips();
        toast('🚗 Nuevo pedido de viaje!', { duration: 8000, icon: '🔔' });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchPendingTrips = async () => {
    const { data } = await supabase.from('trips').select('*').eq('status', 'searching').order('created_at', { ascending: false });
    setPendingTrips(data || []);
  };

  const toggleActive = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const newStatus = !isActive;
    setIsActive(newStatus);

    if (newStatus) {
      // Activar GPS
      watchRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          const pos = [coords.latitude, coords.longitude];
          setMyPos(pos);
          supabase.from('drivers').update({ is_active: true, lat: coords.latitude, lng: coords.longitude, updated_at: new Date().toISOString() }).eq('id', user.id);
        },
        () => toast.error('No se pudo obtener tu ubicación'),
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
      toast.success('Estás activo — aparecés en el mapa');
    } else {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      await supabase.from('drivers').update({ is_active: false }).eq('id', user.id);
      toast('Estás offline', { icon: '😴' });
    }
  };

  const acceptTrip = async (tripId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('trips').update({ driver_id: user.id, status: 'accepted' }).eq('id', tripId).eq('status', 'searching');
    if (error) { toast.error('Este viaje ya fue tomado'); fetchPendingTrips(); }
    else { toast.success('¡Viaje aceptado!'); fetchPendingTrips(); }
  };

  const updateTripStatus = async (tripId, status) => {
    await supabase.from('trips').update({ status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) }).eq('id', tripId);
    fetchPendingTrips();
  };

  const handleLogout = async () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('drivers').update({ is_active: false }).eq('id', user.id);
    await supabase.auth.signOut();
    navigate('/conductor/login');
  };

  const PAYMENT_LABELS = { card: 'Tarjeta', transfer: 'Transferencia', cash: 'Efectivo' };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <nav className="bg-white shadow-nav z-40">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-primary font-extrabold text-xl">Vicuña</span>
            <span className="bg-primary text-white font-extrabold text-xl px-1 rounded-md">Ya</span>
            <span className="ml-2 text-xs text-gray-500 hidden sm:block">Panel conductor</span>
          </div>
          <div className="flex items-center gap-3">
            {driver && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{driver.name}</p>
                <div className="flex items-center gap-1 text-amber-500 text-xs justify-end">
                  <Star size={11} fill="currentColor" /> {driver.rating?.toFixed(1)}
                </div>
              </div>
            )}
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mapa */}
      <div style={{ height: '35vh' }}>
        <MapContainer center={myPos} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={myPos} icon={myIcon} />
        </MapContainer>
      </div>

      {/* Panel */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Toggle activo */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-bold">{isActive ? '🟢 Estás activo' : '⚫ Estás offline'}</p>
            <p className="text-xs text-gray-500">{isActive ? 'Los pasajeros te pueden ver' : 'Activate para recibir viajes'}</p>
          </div>
          <button
            onClick={toggleActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${isActive ? 'bg-red-50 text-red-600 border border-red-200' : 'btn-primary'}`}
          >
            <Power size={16} /> {isActive ? 'Desactivar' : 'Activarme'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-xl font-extrabold text-primary">{driver?.rating?.toFixed(1) || '—'}</p>
            <p className="text-xs text-gray-500">Rating</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-extrabold text-green-600">{pendingTrips.length}</p>
            <p className="text-xs text-gray-500">Disponibles</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-extrabold text-blue-600">0</p>
            <p className="text-xs text-gray-500">Hoy</p>
          </div>
        </div>

        {/* Viajes disponibles */}
        <h2 className="font-bold text-base">Viajes disponibles</h2>
        {pendingTrips.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <Navigation size={40} strokeWidth={1} className="mx-auto mb-3" />
            <p className="text-sm">Sin viajes pendientes en este momento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTrips.map(trip => (
              <div key={trip.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold">{trip.passenger_name}</p>
                    <p className="text-xs text-gray-500">{trip.passenger_phone}</p>
                  </div>
                  {trip.estimated_price && (
                    <p className="font-extrabold text-lg text-primary">${trip.estimated_price.toLocaleString('es-AR')}</p>
                  )}
                </div>
                <div className="text-sm space-y-1 mb-4">
                  <p className="flex items-center gap-2 text-gray-600">
                    <div className="w-2 h-2 bg-primary rounded-full" /> {trip.origin_address}
                  </p>
                  <p className="flex items-center gap-2 text-gray-600">
                    <Navigation size={12} className="text-gray-400" /> {trip.dest_address}
                  </p>
                  <p className="text-xs text-gray-400">Pago: {PAYMENT_LABELS[trip.payment_method] || 'Efectivo'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptTrip(trip.id)} className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5">
                    <CheckCircle size={15} /> Aceptar
                  </button>
                  <button className="flex-1 py-2 px-4 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors">
                    <XCircle size={15} className="inline mr-1" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
