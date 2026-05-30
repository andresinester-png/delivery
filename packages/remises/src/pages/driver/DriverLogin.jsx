import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase.js';

export default function DriverLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(form);
    if (error) toast.error('Credenciales incorrectas');
    else navigate('/conductor');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 mb-2">
            <span className="text-primary font-extrabold text-3xl">Vicuña</span>
            <span className="bg-primary text-white font-extrabold text-3xl px-1.5 rounded-lg">Ya</span>
          </div>
          <p className="text-gray-500 text-sm">Panel del conductor</p>
        </div>
        <div className="card p-6">
          <h1 className="font-bold text-xl mb-5 text-center">Ingresar</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="tu@email.com" className="input" required />
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Contraseña" className="input pr-10" required />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Ingresando...' : 'Entrar'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
