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

function ProtectedRoute({ children, minRole }) {
  const { user, loading, hasAccess } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1rem', color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (minRole && !hasAccess(minRole)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1rem', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<ProtectedRoute minRole="DELIVERY"><Orders /></ProtectedRoute>} />
        <Route path="stock" element={<ProtectedRoute minRole="KITCHEN"><Stock /></ProtectedRoute>} />
        <Route path="clients" element={<ProtectedRoute minRole="SALES"><Clients /></ProtectedRoute>} />
        <Route path="employees" element={<ProtectedRoute minRole="MANAGER"><Employees /></ProtectedRoute>} />
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
