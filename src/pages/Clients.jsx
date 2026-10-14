import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from '../services/data';
import { db } from '../services/data';

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ companyName: '', contactPerson: '', phone: '', email: '', address: '' });

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    const snap = await getDocs(collection(db, 'clients'));
    setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const openAdd = () => { setEditId(null); setForm({ companyName: '', contactPerson: '', phone: '', email: '', address: '' }); setShowModal(true); };
  const openEdit = (c) => { setEditId(c.id); setForm({ companyName: c.companyName, contactPerson: c.contactPerson || '', phone: c.phone || '', email: c.email || '', address: c.address || '' }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editId) {
      await updateDoc(doc(db, 'clients', editId), form);
    } else {
      await addDoc(collection(db, 'clients'), { ...form, createdAt: new Date().toISOString() });
    }
    setShowModal(false);
    loadClients();
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'clients', id));
      loadClients();
    }
  };

  const filtered = clients.filter(c => c.companyName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('clients')}</h1>
      <div className="data-section">
        <div className="data-section-header">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-add" onClick={openAdd}>+ {t('addClient')}</button>
        </div>

        {filtered.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('companyName')}</th>
                <th>{t('contactPerson')}</th>
                <th>{t('phone')}</th>
                <th>{t('email')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>{c.companyName}</td>
                  <td>{c.contactPerson}</td>
                  <td>{c.phone}</td>
                  <td>{c.email}</td>
                  <td>
                    <div className="action-btns">
                      <button className="action-btn" onClick={() => openEdit(c)}>✏️</button>
                      <button className="action-btn delete" onClick={() => handleDelete(c.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <p>{t('noClients')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? t('editClient') : t('addClient')}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>{t('companyName')}</label>
                <input value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('contactPerson')}</label>
                <input value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} />
              </div>
              <div className="form-group">
                <label>{t('phone')}</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>{t('email')}</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>{t('address')}</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
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
