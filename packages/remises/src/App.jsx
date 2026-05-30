import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home.jsx';
import RequestTrip from './pages/RequestTrip.jsx';
import TripTracking from './pages/TripTracking.jsx';
import RateDriver from './pages/RateDriver.jsx';
import DriverLogin from './pages/driver/DriverLogin.jsx';
import DriverDashboard from './pages/driver/DriverDashboard.jsx';
import DriverGuard from './components/DriverGuard.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif' },
          success: { iconTheme: { primary: '#FA0050', secondary: '#fff' } },
        }}
      />
      <Routes>
        {/* Pasajero */}
        <Route path="/" element={<Home />} />
        <Route path="/pedir" element={<RequestTrip />} />
        <Route path="/viaje/:id" element={<TripTracking />} />
        <Route path="/viaje/:id/calificar" element={<RateDriver />} />

        {/* Conductor */}
        <Route path="/conductor/login" element={<DriverLogin />} />
        <Route path="/conductor" element={<DriverGuard />}>
          <Route index element={<DriverDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
