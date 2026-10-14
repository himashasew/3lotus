import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, doc, updateDoc, deleteDoc } from '../services/data';
import { db } from '../services/data';
import { useAuth, ROLES } from '../context/AuthContext';

export default function UserManagement() {
  const { t } = useTranslation();
  const { createNewUser, hasAccess } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'SALES' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // Admin can only assign roles up to ADMIN (not DEVELOPER)
  const availableRoles = Object.entries(ROLES)
    .filter(([key]) => key !== 'DEVELOPER')
    .map(([key, val]) => ({ value: key, label: val.label }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await createNewUser(form.email, form.password, form.role, form.displayName);
      setMessage({ text: t('userCreated'), type: 'success' });
      setForm({ email: '', password: '', displayName: '', role: 'SALES' });
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setSaving(false);
  };

  const changeRole = async (userId, newRole) => {
    if (newRole === 'DEVELOPER') return; // Admin can never assign Developer
    await updateDoc(doc(db, 'users', userId), { role: newRole });
    loadUsers();
  };

  const deleteUser = async (userId) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'users', userId));
      loadUsers();
    }
  };

  // Filter out developer users from the list (admins can't see them)
  const visibleUsers = users.filter(u => u.role !== 'DEVELOPER');

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>👤 {t('userManagement')}</h1>

      {message.text && (
        <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>
          {message.text}
        </div>
      )}

      <div className="data-section">
        <div className="data-section-header">
          <h2>{t('users')}</h2>
          <button className="btn-add" onClick={() => setShowModal(true)}>+ {t('addUser')}</button>
        </div>

        {visibleUsers.length > 0 ? (
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
              {visibleUsers.map(u => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => changeRole(u.id, e.target.value)}
                      style={{ width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
                  {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
