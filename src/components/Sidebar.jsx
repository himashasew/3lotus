import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { userProfile, logout, hasAccess } = useAuth();

  const navItems = [
    { to: '/', icon: '📊', label: t('dashboard'), minRole: 'DELIVERY' },
    { to: '/orders', icon: '📋', label: t('orders'), minRole: 'DELIVERY' },
    { to: '/stock', icon: '📦', label: t('stock'), minRole: 'KITCHEN' },
    { to: '/clients', icon: '🏢', label: t('clients'), minRole: 'SALES' },
    { to: '/employees', icon: '👥', label: t('employees'), minRole: 'MANAGER' },
    { to: '/finance', icon: '💰', label: t('finance'), minRole: 'MANAGER' },
    { to: '/settings', icon: '⚙️', label: t('settings'), minRole: 'ADMIN' },
  ];

  // Only Developer can see user management at admin level
  const adminItems = hasAccess('ADMIN') && !hasAccess('DEVELOPER') ? [
    { to: '/user-management', icon: '👤', label: t('userManagement'), minRole: 'ADMIN' },
  ] : [];

  const devItems = hasAccess('DEVELOPER') ? [
    { to: '/developer', icon: '🛠️', label: t('developer'), minRole: 'DEVELOPER' },
  ] : [];

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    if (hasAccess('ADMIN')) {
      const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(15));
      const unsubscribe = onSnapshot(q, (snap) => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsubscribe();
    }
  }, [hasAccess]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/3 lotus.svg" alt="3 Lotus" />
            <h2>3 Lotus</h2>
          </div>
          {hasAccess('ADMIN') && (
            <div className="notif-bell" onClick={() => setShowNotif(!showNotif)} style={{ cursor: 'pointer', position: 'relative', fontSize: '1.25rem' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 5px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {unreadCount}
                </span>
              )}
            </div>
          )}

          {showNotif && (
            <div className="notif-dropdown" style={{ position: 'absolute', top: '100%', right: '1rem', width: '280px', background: 'var(--bg-card-solid)', border: 'var(--glass-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--glass-shadow)', zIndex: 100, maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: 'var(--glass-border)', fontWeight: 'bold' }}>
                {t('notifications') || 'Notifications'}
              </div>
              {notifications.length > 0 ? notifications.map(n => (
                <div key={n.id} onClick={() => markAsRead(n.id)} style={{ padding: '0.75rem 1rem', borderBottom: 'var(--glass-border)', background: n.read ? 'transparent' : 'rgba(255, 71, 87, 0.05)', cursor: 'pointer' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: n.read ? 'normal' : 'bold', color: 'var(--text-main)' }}>{n.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{n.message}</div>
                </div>
              )) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('noNotifications') || 'No notifications'}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">{t('mainMenu')}</span>
          {navItems.map((item) =>
            hasAccess(item.minRole) ? (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ) : null
          )}

          {adminItems.length > 0 && (
            <>
              <span className="nav-section-label">{t('admin')}</span>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          {devItems.length > 0 && (
            <>
              <span className="nav-section-label">{t('developer')}</span>
              {devItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {getInitials(userProfile?.displayName)}
            </div>
            <div className="user-details">
              <div className="name">{userProfile?.displayName}</div>
              <div className="role">{userProfile?.role === 'DEVELOPER' ? 'ADMIN' : userProfile?.role}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            🚪 {t('logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
