import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, ChevronLeft, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import PaymentSelector from '../components/PaymentSelector.jsx';
import { supabase, FARE } from '../lib/supabase.js';

function estimatePrice(distanceKm) {
  return Math.round(FARE.base + FARE.perKm * distanceKm);
}

// Distancia estimada (sin API real de rutas)
function roughDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const VM_CENTER = [-33.9086, -64.3791];

export default function RequestTrip() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', origin: '', dest: '' });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState(null);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const calculateEstimate = () => {
    if (!form.origin || !form.dest) return;
    // Simulación: distancia aleatoria entre 1 y 10 km para demo
    const km = 1 + Math.random() * 9;
    const price = estimatePrice(km);
    setEstimate({ km: km.toFixed(1), price });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.origin || !form.dest) {
      toast.error('Completá todos los campos');
      return;
    }

    setLoading(true);
    try {
      const { data: trip, error } = await supabase.from('trips').insert({
        passenger_name: form.name,
        passenger_phone: form.phone,
        origin_address: form.origin,
        origin_lat: VM_CENTER[0],
        origin_lng: VM_CENTER[1],
        dest_address: form.dest,
        dest_lat: VM_CENTER[0] + 0.01,
        dest_lng: VM_CENTER[1] + 0.01,
        distance_km: estimate ? parseFloat(estimate.km) : null,
        estimated_price: estimate ? estimate.price : null,
        payment_method: paymentMethod,
        status: 'searching',
      }).select().single();

      if (error) throw error;
      navigate(`/viaje/${trip.id}`);
      toast.success('Buscando conductor...');
    } catch (err) {
      toast.error('Error al solicitar el remis: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-nav">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h1 className="font-bold text-lg">Pedir remis</h1>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Datos personales */}
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-base">Tus datos</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre *</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Tu nombre" className="input" required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Teléfono *</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="3571-000000" className="input" required />
              </div>
            </div>
          </div>

          {/* Origen y destino */}
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-base">Recorrido</h2>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 rounded-full bg-primary" />
              </div>
              <input
                name="origin"
                value={form.origin}
                onChange={handleChange}
                placeholder="¿Dónde te recogemos? *"
                className="input pl-9"
                onBlur={calculateEstimate}
                required
              />
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <MapPin size={14} className="text-gray-400" />
              </div>
              <input
                name="dest"
                value={form.dest}
                onChange={handleChange}
                placeholder="¿A dónde vas? *"
                className="input pl-9"
                onBlur={calculateEstimate}
                required
              />
            </div>

            {/* Estimación de precio */}
            {estimate && (
              <div className="bg-primary-bg border border-primary/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Distancia estimada</p>
                    <p className="font-semibold text-sm">{estimate.km} km</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Precio estimado</p>
                    <p className="font-extrabold text-xl text-primary">${estimate.price.toLocaleString('es-AR')}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">* El precio final puede variar según el recorrido real</p>
              </div>
            )}
          </div>

          {/* Pago */}
          <div className="card p-5">
            <h2 className="font-bold text-base mb-3">Método de pago</h2>
            <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4 flex items-center justify-center gap-2">
            <Car size={18} />
            {loading ? 'Buscando...' : 'Solicitar remis'}
          </button>
        </form>
      </div>
    </div>
  );
}
