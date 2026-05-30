import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Phone, Star, CheckCircle, Clock, Car, MapPin, X } from 'lucide-react';
import { supabase, MAP_CENTER } from '../lib/supabase.js';

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:#FA0050;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:20px">🚗</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const STATUS_INFO = {
  searching: { label: 'Buscando conductor...', icon: Clock,        color: 'text-amber-500', desc: 'Estamos buscando el conductor más cercano' },
  accepted:  { label: 'Conductor en camino', icon: Car,           color: 'text-blue-500',  desc: 'El conductor está yendo a buscarte' },
  arriving:  { label: 'Llegando',            icon: MapPin,        color: 'text-blue-500',  desc: 'El conductor está llegando a tu ubicación' },
  in_progress:{ label: 'En viaje',           icon: Car,           color: 'text-primary',   desc: 'Estás en camino a tu destino' },
  completed: { label: '¡Llegaste!',          icon: CheckCircle,   color: 'text-green-500', desc: 'Tu viaje finalizó' },
  cancelled: { label: 'Cancelado',           icon: X,             color: 'text-red-500',   desc: 'El viaje fue cancelado' },
};

export default function TripTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrip = async () => {
      const { data } = await supabase.from('trips').select('*, drivers(*)').eq('id', id).single();
      setTrip(data);
      if (data?.drivers) setDriver(data.drivers);
      setLoading(false);
    };
    fetchTrip();

    const channel = supabase
      .channel(`trip-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${id}` },
        ({ new: updated }) => {
          setTrip(prev => ({ ...prev, ...updated }));
          if (updated.status === 'completed') navigate(`/viaje/${id}/calificar`);
        }
      )
      .subscribe();

    // Actualizar posición del conductor en tiempo real
    const driverChannel = supabase
      .channel(`driver-pos-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers' },
        ({ new: d }) => { if (trip?.driver_id === d.id) setDriver(d); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(driverChannel); };
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const statusInfo = STATUS_INFO[trip?.status] || STATUS_INFO.searching;
  const StatusIcon = statusInfo.icon;
  const driverPos = driver?.lat && driver?.lng ? [driver.lat, driver.lng] : MAP_CENTER;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Mapa */}
      <div className="flex-1 relative">
        <MapContainer center={driverPos} zoom={15} style={{ height: '100%', minHeight: '350px', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {driver?.lat && driver?.lng && (
            <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
              <Popup>{driver.name}<br />{driver.vehicle}</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Status overlay */}
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-3 z-10`}>
          <StatusIcon className={statusInfo.color} size={20} />
          <div>
            <p className={`font-bold text-sm ${statusInfo.color}`}>{statusInfo.label}</p>
            <p className="text-xs text-gray-500">{statusInfo.desc}</p>
          </div>
        </div>
      </div>

      {/* Panel inferior */}
      <div className="bg-white rounded-t-3xl shadow-2xl p-6">
        {/* Info del conductor */}
        {driver ? (
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 bg-primary-bg rounded-2xl flex items-center justify-center text-3xl overflow-hidden">
              {driver.photo_url ? <img src={driver.photo_url} alt={driver.name} className="w-full h-full object-cover" /> : '👤'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-base">{driver.name}</p>
              <p className="text-sm text-gray-500">{driver.vehicle} · {driver.license_plate}</p>
              <div className="flex items-center gap-1 text-amber-500 text-sm">
                <Star size={13} fill="currentColor" />
                <span className="font-semibold">{driver.rating?.toFixed(1)}</span>
              </div>
            </div>
            {driver.phone && (
              <a href={`tel:${driver.phone}`} className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center hover:bg-green-100 transition-colors">
                <Phone size={20} />
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-5 animate-pulse">
            <div className="w-14 h-14 bg-gray-200 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        )}

        {/* Detalles del viaje */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
          <div className="flex gap-3 text-sm">
            <div className="w-3 h-3 bg-primary rounded-full mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Origen</p>
              <p className="font-medium">{trip?.origin_address}</p>
            </div>
          </div>
          <div className="flex gap-3 text-sm">
            <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Destino</p>
              <p className="font-medium">{trip?.dest_address}</p>
            </div>
          </div>
        </div>

        {trip?.estimated_price && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Precio estimado</span>
            <span className="font-extrabold text-xl text-primary">${trip.estimated_price.toLocaleString('es-AR')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
