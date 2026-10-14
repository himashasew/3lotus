import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, deleteDoc, doc } from '../services/data';
import { db } from '../services/data';

export default function Finance() {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: 'income', description: '', amount: '', date: '' });

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    const snap = await getDocs(collection(db, 'finance'));
    setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
  };

  const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0);
  const profit = totalIncome - totalExpense;

  const handleSave = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'finance'), { ...form, amount: Number(form.amount), createdAt: new Date().toISOString() });
    setShowModal(false);
    setForm({ type: 'income', description: '', amount: '', date: '' });
    loadRecords();
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'finance', id));
      loadRecords();
    }
  };

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('finance')}</h1>

      <div className="dashboard-grid">
        <div className="stat-card clients">
          <div className="stat-info">
            <h3>{t('totalIncome')}</h3>
            <div className="stat-value" style={{ color: 'var(--color-secondary)' }}>Rs. {totalIncome.toLocaleString()}</div>
          </div>
          <div className="stat-icon">📈</div>
        </div>
        <div className="stat-card orders">
          <div className="stat-info">
            <h3>{t('totalExpense')}</h3>
            <div className="stat-value" style={{ color: 'var(--color-primary)' }}>Rs. {totalExpense.toLocaleString()}</div>
          </div>
          <div className="stat-icon">📉</div>
        </div>
        <div className="stat-card revenue">
          <div className="stat-info">
            <h3>{t('profit')}</h3>
            <div className="stat-value" style={{ color: profit >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)' }}>Rs. {profit.toLocaleString()}</div>
          </div>
          <div className="stat-icon">💎</div>
        </div>
      </div>

      <div className="data-section">
        <div className="data-section-header">
          <h2>{t('transactions')}</h2>
          <button className="btn-add" onClick={() => { setForm({ type: 'income', description: '', amount: '', date: new Date().toISOString().split('T')[0] }); setShowModal(true); }}>+ {t('addTransaction')}</button>
        </div>

        {records.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('type')}</th>
                <th>{t('description')}</th>
                <th>{t('amount')} (Rs.)</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>
                    <span className={`status-badge ${r.type === 'income' ? 'completed' : 'cooking'}`}>
                      {r.type === 'income' ? t('income') : t('expense')}
                    </span>
                  </td>
                  <td>{r.description}</td>
                  <td style={{ fontWeight: '600', color: r.type === 'income' ? 'var(--color-secondary)' : 'var(--color-primary)' }}>
                    {r.type === 'income' ? '+' : '-'} {(r.amount || 0).toLocaleString()}
                  </td>
                  <td>
                    <button className="action-btn delete" onClick={() => handleDelete(r.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <p>{t('noTransactions')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{t('addTransaction')}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>{t('type')}</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="income">{t('income')}</option>
                  <option value="expense">{t('expense')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('description')}</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('amount')} (Rs.)</label>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('date')}</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
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
