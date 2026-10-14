import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from '../services/data';
import { db } from '../services/data';

const STATUS_OPTIONS = ['Pending', 'Cooking', 'Delivering', 'Completed'];

export default function Orders() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ clientId: '', clientName: '', items: [{ productId: '', productName: '', qty: 1, price: 0 }], status: 'Pending', date: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [ordSnap, cliSnap, proSnap] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'clients')),
      getDocs(collection(db, 'products')),
    ]);
    setOrders(ordSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setClients(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setProducts(proSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ clientId: '', clientName: '', items: [{ productId: '', productName: '', qty: 1, price: 0 }], status: 'Pending', date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const openEdit = (o) => {
    setEditId(o.id);
    setForm({ clientId: o.clientId || '', clientName: o.clientName || '', items: o.items || [{ productId: '', productName: '', qty: 1, price: 0 }], status: o.status || 'Pending', date: o.date || '' });
    setShowModal(true);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: '', productName: '', qty: 1, price: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i][field] = value;
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) { items[i].productName = prod.name; items[i].price = prod.price || 0; }
    }
    setForm({ ...form, items });
  };

  const calcTotal = () => form.items.reduce((sum, it) => sum + (it.qty * it.price), 0);

  const handleSave = async (e) => {
    e.preventDefault();
    const data = { ...form, total: calcTotal() };
    if (editId) {
      await updateDoc(doc(db, 'orders', editId), data);
    } else {
      await addDoc(collection(db, 'orders'), data);
    }
    setShowModal(false);
    loadAll();
  };

  const updateStatus = async (orderId, newStatus) => {
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    loadAll();
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'orders', id));
      loadAll();
    }
  };

  const filtered = orders.filter(o => o.clientName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('orders')}</h1>
      <div className="data-section">
        <div className="data-section-header">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-add" onClick={openAdd}>+ {t('addOrder')}</button>
        </div>

        {filtered.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('client')}</th>
                <th>{t('date')}</th>
                <th>{t('items')}</th>
                <th>{t('total')} (Rs.)</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td>{o.clientName}</td>
                  <td>{o.date}</td>
                  <td>{o.items?.length || 0} {t('items')}</td>
                  <td>{(o.total || 0).toLocaleString()}</td>
                  <td>
                    <select
                      value={o.status}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      style={{ width: 'auto', padding: '0.3rem 0.4rem', fontSize: '0.78rem' }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="action-btn" onClick={() => openEdit(o)}>✏️</button>
                      <button className="action-btn delete" onClick={() => handleDelete(o.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>{t('noOrders')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <h2>{editId ? t('editOrder') : t('addOrder')}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>{t('client')}</label>
                <select
                  value={form.clientId}
                  onChange={e => {
                    const cl = clients.find(c => c.id === e.target.value);
                    setForm({ ...form, clientId: e.target.value, clientName: cl?.companyName || '' });
                  }}
                  required
                >
                  <option value="">{t('selectClient')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>{t('date')}</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
              </div>

              <div className="form-group">
                <label>{t('items')}</label>
                {form.items.map((item, i) => (
                  <div key={i} className="order-item-row">
                    <select
                      value={item.productId}
                      onChange={e => updateItem(i, 'productId', e.target.value)}
                      className="order-item-product"
                    >
                      <option value="">{t('selectProduct')}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={e => updateItem(i, 'qty', Number(e.target.value))}
                      className="order-item-qty"
                    />
                    <span className="order-item-subtotal">Rs. {(item.qty * item.price).toLocaleString()}</span>
                    {form.items.length > 1 && (
                      <button type="button" className="order-item-remove" onClick={() => removeItem(i)}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="order-add-item-btn" onClick={addItem}>+ {t('addItem')}</button>
              </div>

              <div className="order-total">
                {t('total')}: Rs. {calcTotal().toLocaleString()}
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
