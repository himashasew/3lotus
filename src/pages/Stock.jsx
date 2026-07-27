import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Stock() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', quantity: '', unit: '', price: '' });

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const snap = await getDocs(collection(db, 'products'));
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const openAdd = () => { setEditId(null); setForm({ name: '', category: '', quantity: '', unit: '', price: '' }); setShowModal(true); };
  const openEdit = (p) => { setEditId(p.id); setForm({ name: p.name, category: p.category || '', quantity: String(p.quantity || ''), unit: p.unit || '', price: String(p.price || '') }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    const data = { name: form.name, category: form.category, quantity: Number(form.quantity), unit: form.unit, price: Number(form.price) };
    if (editId) {
      await updateDoc(doc(db, 'products', editId), data);
    } else {
      await addDoc(collection(db, 'products'), data);
    }
    setShowModal(false);
    loadProducts();
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'products', id));
      loadProducts();
    }
  };

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('stock')}</h1>
      <div className="data-section">
        <div className="data-section-header">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-add" onClick={openAdd}>+ {t('addProduct')}</button>
        </div>

        {filtered.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('productName')}</th>
                <th>{t('category')}</th>
                <th>{t('quantity')}</th>
                <th>{t('unit')}</th>
                <th>{t('price')} (Rs.)</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td style={{ color: p.quantity < 10 ? 'var(--color-danger)' : 'inherit', fontWeight: p.quantity < 10 ? '700' : '400' }}>
                    {p.quantity} {p.quantity < 10 ? '⚠️' : ''}
                  </td>
                  <td>{p.unit}</td>
                  <td>{(p.price || 0).toLocaleString()}</td>
                  <td>
                    <div className="action-btns">
                      <button className="action-btn" onClick={() => openEdit(p)}>✏️</button>
                      <button className="action-btn delete" onClick={() => handleDelete(p.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p>{t('noProducts')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? t('editProduct') : t('addProduct')}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>{t('productName')}</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('category')}</label>
                <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
              </div>
              <div className="form-group">
                <label>{t('quantity')}</label>
                <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('unit')}</label>
                <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="kg, liters, pcs..." />
              </div>
              <div className="form-group">
                <label>{t('price')} (Rs.)</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
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
