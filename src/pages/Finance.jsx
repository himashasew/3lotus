import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, db } from '../services/data';
import { money, currentMonth, today } from '../lib/payroll';

const INCOME_CATEGORIES = ['Restaurant sales', 'Catering orders', 'Invoice payment', 'Other income'];
const EXPENSE_CATEGORIES = [
  'Ingredients & stock', 'Salaries & Wages', 'EPF / ETF', 'Rent', 'Electricity & water', 'Gas & fuel', 'Transport & delivery',
  'Repairs & maintenance', 'Packaging', 'Marketing', 'Equipment', 'Taxes & licences', 'Loan repayment', 'Other expense',
];
const METHODS = ['Cash', 'Bank transfer', 'Card', 'Cheque'];
const EMPTY = { type: 'income', category: 'Restaurant sales', description: '', amount: '', date: '', method: 'Cash', reference: '', party: '' };

const monthOf = (d) => (d || '').slice(0, 7);

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function Finance() {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState('month');   // month | all | range
  const [month, setMonth] = useState(currentMonth());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, 'finance'));
    setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    try {
      const inv = await getDocs(collection(db, 'invoices'));
      setInvoices(inv.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setInvoices([]); // invoices table not created yet
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inPeriod = useCallback((r) => {
    if (period === 'all') return true;
    if (period === 'month') return monthOf(r.date) === month;
    return (!from || r.date >= from) && (!to || r.date <= to);
  }, [period, month, from, to]);

  const periodRecords = useMemo(() => records.filter(inPeriod), [records, inPeriod]);
  const filtered = useMemo(() => periodRecords.filter(r =>
    (typeFilter === 'all' || r.type === typeFilter) &&
    (catFilter === 'all' || r.category === catFilter) &&
    [r.description, r.party, r.reference, r.category].some(v => (v || '').toLowerCase().includes(search.toLowerCase()))
  ), [periodRecords, typeFilter, catFilter, search]);

  const sum = (list, type) => list.filter(r => r.type === type).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalIncome = sum(periodRecords, 'income');
  const totalExpense = sum(periodRecords, 'expense');
  const profit = totalIncome - totalExpense;
  const payrollExpense = periodRecords.filter(r => r.category === 'Salaries & Wages' || r.category === 'EPF / ETF')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const byMethod = (m) => periodRecords.filter(r => (r.method || 'Cash') === m)
    .reduce((s, r) => s + (r.type === 'income' ? 1 : -1) * (Number(r.amount) || 0), 0);

  const receivable = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
    .reduce((s, i) => s + Math.max(0, (Number(i.total) || 0) - (Number(i.paidAmount) || 0)), 0);

  const breakdown = (type) => {
    const map = {};
    periodRecords.filter(r => r.type === type).forEach(r => { map[r.category || 'Uncategorised'] = (map[r.category || 'Uncategorised'] || 0) + (Number(r.amount) || 0); });
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, pct: (value / total) * 100 }));
  };

  const trend = useMemo(() => {
    const months = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map(m => {
      const list = records.filter(r => monthOf(r.date) === m);
      return { m, income: sum(list, 'income'), expense: sum(list, 'expense') };
    });
  }, [records]);
  const trendMax = Math.max(1, ...trend.flatMap(x => [x.income, x.expense]));

  const openAdd = () => { setEditId(null); setForm({ ...EMPTY, date: today() }); setError(''); setShowModal(true); };
  const openEdit = (r) => {
    setEditId(r.id);
    setForm({ ...EMPTY, ...r, amount: String(r.amount ?? '') });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const data = {
        type: form.type, category: form.category, description: form.description, amount: Number(form.amount),
        date: form.date, method: form.method, reference: form.reference, party: form.party,
      };
      if (editId) await updateDoc(doc(db, 'finance', editId), data);
      else await addDoc(collection(db, 'finance'), { ...data, createdAt: new Date().toISOString() });
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (r) => {
    if (r.source === 'payroll' || r.source === 'invoice') {
      window.alert(`This entry was created automatically from ${r.source === 'payroll' ? 'Payroll' : 'an invoice'}. Undo it there instead.`);
      return;
    }
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'finance', r.id));
      load();
    }
  };

  const exportCsv = () => {
    const head = ['Date', 'Type', 'Category', 'Description', 'Party', 'Method', 'Reference', 'Amount'];
    const rows = filtered.map(r => [r.date, r.type, r.category, r.description, r.party, r.method, r.reference, r.amount]);
    const csv = [head, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-${period === 'month' ? month : period === 'all' ? 'all' : `${from || 'start'}_${to || 'now'}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const allCats = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...records.map(r => r.category).filter(Boolean)])];

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('finance')}</h1>

      <div className="panel">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto' }}>
            <option value="month">Month</option><option value="range">Date range</option><option value="all">All time</option>
          </select>
          {period === 'month' && <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ width: 'auto' }} />}
          {period === 'range' && (<>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} />
            <span className="muted">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
          </>)}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card clients"><div className="stat-info"><h3>{t('totalIncome')}</h3><div className="stat-value" style={{ color: 'var(--color-secondary)' }}>Rs. {money(totalIncome)}</div></div><div className="stat-icon">📈</div></div>
        <div className="stat-card orders"><div className="stat-info"><h3>{t('totalExpense')}</h3><div className="stat-value" style={{ color: 'var(--color-primary)' }}>Rs. {money(totalExpense)}</div></div><div className="stat-icon">📉</div></div>
        <div className="stat-card revenue"><div className="stat-info"><h3>{t('profit')}</h3><div className="stat-value" style={{ color: profit >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)' }}>Rs. {money(profit)}</div></div><div className="stat-icon">💎</div></div>
        <div className="stat-card clients"><div className="stat-info"><h3>Payroll &amp; EPF/ETF</h3><div className="stat-value">Rs. {money(payrollExpense)}</div></div><div className="stat-icon">👥</div></div>
        <div className="stat-card orders"><div className="stat-info"><h3>Invoices unpaid</h3><div className="stat-value">Rs. {money(receivable)}</div></div><div className="stat-icon">🧾</div></div>
        <div className="stat-card revenue"><div className="stat-info"><h3>Cash / Bank balance</h3><div className="stat-value" style={{ fontSize: '1.05rem' }}>{money(byMethod('Cash'))} / {money(byMethod('Bank transfer') + byMethod('Card') + byMethod('Cheque'))}</div></div><div className="stat-icon">🏦</div></div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel">
          <h3>Expenses by category</h3>
          {breakdown('expense').length === 0 && <p className="muted">No expenses in this period.</p>}
          {breakdown('expense').map(b => (
            <div className="bar-row" key={b.name}>
              <span style={{ width: 150 }}>{b.name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${b.pct}%`, background: 'var(--color-primary)' }} /></div>
              <span style={{ width: 100, textAlign: 'right' }}>{money(b.value)}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Income by category</h3>
          {breakdown('income').length === 0 && <p className="muted">No income in this period.</p>}
          {breakdown('income').map(b => (
            <div className="bar-row" key={b.name}>
              <span style={{ width: 150 }}>{b.name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${b.pct}%`, background: 'var(--color-secondary)' }} /></div>
              <span style={{ width: 100, textAlign: 'right' }}>{money(b.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Last 6 months</h3>
        {trend.map(x => (
          <div key={x.m} style={{ margin: '0.5rem 0' }}>
            <div className="bar-row" style={{ margin: 0 }}>
              <span style={{ width: 70 }}>{x.m}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(x.income / trendMax) * 100}%`, background: 'var(--color-secondary)' }} /></div>
              <span style={{ width: 110, textAlign: 'right' }} className="pos">{money(x.income)}</span>
            </div>
            <div className="bar-row" style={{ margin: 0 }}>
              <span style={{ width: 70 }} />
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(x.expense / trendMax) * 100}%`, background: 'var(--color-primary)' }} /></div>
              <span style={{ width: 110, textAlign: 'right' }} className="neg">{money(x.expense)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="data-section">
        <div className="data-section-header">
          <h2>{t('transactions')}</h2>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <div className="search-bar"><span className="search-icon">🔍</span><input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">All types</option><option value="income">{t('income')}</option><option value="expense">{t('expense')}</option>
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">All categories</option>
              {allCats.map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn-secondary" onClick={exportCsv} disabled={filtered.length === 0}>⬇ CSV</button>
            <button className="btn-add" onClick={openAdd}>+ {t('addTransaction')}</button>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{t('date')}</th><th>{t('type')}</th><th>Category</th><th>{t('description')}</th><th>Method</th><th>{t('amount')} (Rs.)</th><th>{t('actions')}</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td><span className={`status-badge ${r.type === 'income' ? 'completed' : 'cooking'}`}>{r.type === 'income' ? t('income') : t('expense')}</span></td>
                    <td>{r.category || '—'}{r.source ? <span className="muted" style={{ fontSize: '0.7rem' }}> · auto</span> : null}</td>
                    <td>
                      <div>{r.description}</div>
                      {(r.party || r.reference) && <div className="muted" style={{ fontSize: '0.74rem' }}>{[r.party, r.reference].filter(Boolean).join(' · ')}</div>}
                    </td>
                    <td>{r.method || '—'}</td>
                    <td style={{ fontWeight: 600 }} className={r.type === 'income' ? 'pos' : 'neg'}>{r.type === 'income' ? '+' : '-'} {money(r.amount)}</td>
                    <td>
                      <div className="action-btns">
                        {!r.source && <button className="action-btn" onClick={() => openEdit(r)}>✏️</button>}
                        <button className="action-btn delete" onClick={() => handleDelete(r)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon">💰</div><p>{t('noTransactions')}</p></div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Edit transaction' : t('addTransaction')}</h2>
            {error && <div className="msg-error">{error}</div>}
            <form onSubmit={handleSave}>
              <div className="grid-2">
                <div className="form-group"><label>{t('type')}</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category: (e.target.value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] })}>
                    <option value="income">{t('income')}</option><option value="expense">{t('expense')}</option>
                  </select>
                </div>
                <div className="form-group"><label>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {[...new Set([...categories, form.category].filter(Boolean))].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label>{t('description')}</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></div>
              <div className="grid-2">
                <div className="form-group"><label>{t('amount')} (Rs.)</label><input type="number" min="0" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
                <div className="form-group"><label>{t('date')}</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
                <div className="form-group"><label>Payment method</label>
                  <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>{METHODS.map(m => <option key={m}>{m}</option>)}</select>
                </div>
                <div className="form-group"><label>Reference / bill no.</label><input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>{form.type === 'income' ? 'Received from' : 'Paid to'}</label><input value={form.party} onChange={e => setForm({ ...form, party: e.target.value })} /></div>
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
