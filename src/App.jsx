import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';

import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Clients from './pages/Clients';
import Orders from './pages/Orders';
import Finance from './pages/Finance';
import Employees from './pages/Employees';
import Settings from './pages/Settings';
import Developer from './pages/Developer';
import UserManagement from './pages/UserManagement';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Invoices from './pages/Invoices';
import Letters from './pages/Letters';

function ProtectedRoute({ children, minRole }) {
  const { user, loading, hasAccess } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1rem', color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (minRole && !hasAccess(minRole)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user, loading, profileError, logout } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1rem', color: 'var(--text-muted)' }}>Loading...</div>;

  if (user && profileError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', padding: '1.5rem', textAlign: 'center', color: 'var(--text-main)' }}>
        <h2>Could not load your account</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: 480 }}>
          {profileError.message}
        </p>
        <button className="btn-logout" style={{ width: 'auto', padding: '0.5rem 1.5rem' }} onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<ProtectedRoute minRole="DELIVERY"><Orders /></ProtectedRoute>} />
        <Route path="stock" element={<ProtectedRoute minRole="KITCHEN"><Stock /></ProtectedRoute>} />
        <Route path="clients" element={<ProtectedRoute minRole="SALES"><Clients /></ProtectedRoute>} />
        <Route path="employees" element={<ProtectedRoute minRole="MANAGER"><Employees /></ProtectedRoute>} />
        <Route path="attendance" element={<ProtectedRoute minRole="MANAGER"><Attendance /></ProtectedRoute>} />
        <Route path="payroll" element={<ProtectedRoute minRole="MANAGER"><Payroll /></ProtectedRoute>} />
        <Route path="invoices" element={<ProtectedRoute minRole="SALES"><Invoices /></ProtectedRoute>} />
        <Route path="letterhead" element={<ProtectedRoute minRole="SALES"><Letters /></ProtectedRoute>} />
        <Route path="finance" element={<ProtectedRoute minRole="MANAGER"><Finance /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute minRole="ADMIN"><Settings /></ProtectedRoute>} />
        <Route path="user-management" element={<ProtectedRoute minRole="ADMIN"><UserManagement /></ProtectedRoute>} />
        <Route path="developer" element={<ProtectedRoute minRole="DEVELOPER"><Developer /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
