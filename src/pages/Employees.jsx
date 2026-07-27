import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth, ROLES } from '../context/AuthContext';

export default function Employees() {
  const { t } = useTranslation();
  const { hasAccess } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', role: 'KITCHEN', salary: '', joinDate: '' });

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    const snap = await getDocs(collection(db, 'employees'));
    setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const openAdd = () => { setEditId(null); setForm({ name: '', phone: '', role: 'KITCHEN', salary: '', joinDate: '' }); setShowModal(true); };
  const openEdit = (e) => { setEditId(e.id); setForm({ name: e.name, phone: e.phone || '', role: e.role || 'KITCHEN', salary: String(e.salary || ''), joinDate: e.joinDate || '' }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    const data = { ...form, salary: Number(form.salary) };
    if (editId) {
      await updateDoc(doc(db, 'employees', editId), data);
    } else {
      await addDoc(collection(db, 'employees'), data);
    }
    setShowModal(false);
    loadEmployees();
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'employees', id));
      loadEmployees();
    }
  };

  const filtered = employees.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()));

  const roleOptions = Object.entries(ROLES).filter(([key]) => key !== 'DEVELOPER').map(([key, val]) => ({ value: key, label: val.label }));

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('employees')}</h1>
      <div className="data-section">
        <div className="data-section-header">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-add" onClick={openAdd}>+ {t('addEmployee')}</button>
        </div>

        {filtered.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('employeeName')}</th>
                <th>{t('phone')}</th>
                <th>{t('role')}</th>
                <th>{t('salary')} (Rs.)</th>
                <th>{t('joinDate')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{emp.phone}</td>
                  <td><span className="status-badge completed">{emp.role}</span></td>
                  <td>{(emp.salary || 0).toLocaleString()}</td>
                  <td>{emp.joinDate}</td>
                  <td>
                    <div className="action-btns">
                      <button className="action-btn" onClick={() => openEdit(emp)}>✏️</button>
                      <button className="action-btn delete" onClick={() => handleDelete(emp.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>{t('noEmployees')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? t('editEmployee') : t('addEmployee')}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>{t('employeeName')}</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('phone')}</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>{t('role')}</label>
                <select
                  value={form.role}
                  onChange={e => setForm({...form, role: e.target.value})}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', color: 'var(--text-main)', fontSize: '0.95rem', width: '100%', fontFamily: 'var(--font-family)' }}
                >
                  {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('salary')} (Rs.)</label>
                <input type="number" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} />
              </div>
              <div className="form-group">
                <label>{t('joinDate')}</label>
                <input type="date" value={form.joinDate} onChange={e => setForm({...form, joinDate: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-save">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
