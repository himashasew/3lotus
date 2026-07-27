import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth, ROLES } from '../context/AuthContext';

export default function Developer() {
  const { t } = useTranslation();
  const { hasAccess, createNewUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [dbStats, setDbStats] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'ADMIN' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hasAccess('DEVELOPER')) loadDevData();
  }, []);

  const loadDevData = async () => {
    const [usersSnap, ordersSnap, clientsSnap, productsSnap, financeSnap, employeesSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'clients')),
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'finance')),
      getDocs(collection(db, 'employees')),
    ]);
    setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setDbStats({
      users: usersSnap.size,
      orders: ordersSnap.size,
      clients: clientsSnap.size,
      products: productsSnap.size,
      finance: financeSnap.size,
      employees: employeesSnap.size,
    });
  };

  const changeUserRole = async (userId, newRole) => {
    await updateDoc(doc(db, 'users', userId), { role: newRole });
    loadDevData();
  };

  const deleteUser = async (userId) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'users', userId));
      loadDevData();
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await createNewUser(form.email, form.password, form.role, form.displayName);
      setMessage({ text: t('userCreated'), type: 'success' });
      setForm({ email: '', password: '', displayName: '', role: 'ADMIN' });
      setShowModal(false);
      loadDevData();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setSaving(false);
  };

  // Developer has access to ALL roles
  const allRoles = Object.entries(ROLES).map(([key, val]) => ({ value: key, label: val.label }));

  if (!hasAccess('DEVELOPER')) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <p>Access Denied</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>🛠️ {t('developer')}</h1>

      {message.text && (
        <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>
          {message.text}
        </div>
      )}

      {/* Database Stats */}
      <div className="dashboard-grid">
        {Object.entries(dbStats).map(([key, val]) => (
          <div className="stat-card stock" key={key}>
            <div className="stat-info">
              <h3>{key.toUpperCase()}</h3>
              <div className="stat-value">{val}</div>
            </div>
            <div className="stat-icon">📊</div>
          </div>
        ))}
      </div>

      {/* User Management */}
      <div className="data-section">
        <div className="data-section-header">
          <h2>👥 {t('userManagement')}</h2>
          <button className="btn-add" onClick={() => setShowModal(true)}>+ {t('addUser')}</button>
        </div>
        {users.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('displayName')}</th>
                <th>{t('email')}</th>
                <th>{t('role')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => changeUserRole(u.id, e.target.value)}
                      style={{ width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      {allRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="action-btn delete" onClick={() => deleteUser(u.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <p>{t('noUsers')}</p>
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="data-section">
        <div className="data-section-header">
          <h2>ℹ️ System Info</h2>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '2' }}>
          <p><strong style={{ color: 'var(--text-main)' }}>App:</strong> 3 Lotus CRM v1.0.0</p>
          <p><strong style={{ color: 'var(--text-main)' }}>Framework:</strong> React + Vite</p>
          <p><strong style={{ color: 'var(--text-main)' }}>Database:</strong> Firebase Firestore</p>
          <p><strong style={{ color: 'var(--text-main)' }}>Auth:</strong> Firebase Authentication</p>
          <p><strong style={{ color: 'var(--text-main)' }}>Project ID:</strong> lotus-crm-262f3</p>
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{t('addUser')}</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>{t('displayName')}</label>
                <input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('email')}</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('password')}</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} />
              </div>
              <div className="form-group">
                <label>{t('role')}</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  {allRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving}>{saving ? '...' : t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
