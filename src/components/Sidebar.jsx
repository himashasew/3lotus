import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/3 lotus.svg" alt="3 Lotus" />
          <h2>3 Lotus</h2>
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
