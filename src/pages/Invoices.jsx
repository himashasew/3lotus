import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, db } from '../services/data';
import { money, today } from '../lib/payroll';
import { printElementById, downloadElementAsPdf, formatDate } from '../lib/documents';
import { useCompany } from '../lib/useCompany';
import InvoiceDocument, { invoiceTotals, isMealInvoice } from '../components/InvoiceDocument';
import {
  blockStart, blockEnd, nextPeriod, monthPresets, buildRows, blankRow, rowAmounts, periodLabel, addDaysIso,
} from '../lib/mealInvoice';

const blankItem = () => ({ description: '', qty: '1', unit: '', price: '' });

const effectiveStatus = (inv) => {
  if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') return inv.status;
  const { total } = invoiceTotals(inv);
  if ((Number(inv.paidAmount) || 0) >= total && total > 0) return 'paid';
  if (inv.dueDate && inv.dueDate < today()) return 'overdue';
  return (Number(inv.paidAmount) || 0) > 0 ? 'partial' : 'sent';
};

const STATUS_STYLE = { draft: 'cooking', sent: 'cooking', partial: 'cooking', overdue: 'cancelled', paid: 'completed', cancelled: 'cancelled' };

export default function Invoices() {
  const { company } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [editing, setEditing] = useState(null);       // invoice being edited (with optional id)
  const [preview, setPreview] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', date: today(), method: 'Cash', reference: '' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [invSnap, cliSnap] = await Promise.all([getDocs(collection(db, 'invoices')), getDocs(collection(db, 'clients'))]);
      setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.number || '').localeCompare(a.number || '')));
      setClients(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.companyName || '').localeCompare(b.companyName || '')));
    } catch (err) {
      setMessage({ text: `${err.message} — if this is a new feature, run supabase/migration-002-hr-invoices.sql in Supabase first.`, type: 'error' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nextNumber = () => {
    const year = new Date().getFullYear();
    const prefix = `${company.invoicePrefix || 'INV'}-${year}-`;
    const max = invoices.filter(i => (i.number || '').startsWith(prefix))
      .reduce((m, i) => Math.max(m, parseInt(i.number.slice(prefix.length), 10) || 0), 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  };

  const baseInvoice = () => ({
    number: nextNumber(), date: today(), dueDate: addDaysIso(today(), 14), clientId: '', clientName: '', clientContact: '', clientAddress: '', clientPhone: '', clientEmail: '',
    reference: '', items: [blankItem()], discountType: 'amount', discount: '', taxPercent: '', notes: company.invoiceNotes || '', terms: company.invoiceTerms || '',
    status: 'draft', paidAmount: 0, type: 'standard',
  });

  const newInvoice = () => setEditing(baseInvoice());

  const newMealInvoice = () => {
    const start = blockStart(today());
    const end = blockEnd(today());
    setEditing({
      ...baseInvoice(), type: 'meal_period', items: [],
      periodStart: start, periodEnd: end, bLabel: 'Breakfast', oLabel: 'OT Meal', bRate: '', oRate: '',
      mealRows: buildRows(start, end),
    });
  };

  /** Latest daily-meal invoice for a client — used to carry rates over and to suggest the next period. */
  const lastMealInvoice = (clientId, clientName) => invoices
    .filter(i => isMealInvoice(i) && ((clientId && i.clientId === clientId) || (!clientId && i.clientName === clientName)))
    .sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || ''))[0];

  const pickClient = (id) => {
    const c = clients.find(x => x.id === id);
    if (!c) { setEditing(prev => ({ ...prev, clientId: '' })); return; }
    setEditing(prev => {
      let next = {
        ...prev, clientId: id, clientName: c.companyName || c.contactPerson || '', clientContact: c.companyName ? c.contactPerson || '' : '',
        clientAddress: c.address || '', clientPhone: c.phone || '', clientEmail: c.email || '',
      };
      if (isMealInvoice(prev) && !prev.id) {
        const last = lastMealInvoice(id, next.clientName);
        if (last) {
          const p = nextPeriod(last.periodEnd);
          next = {
            ...next, bLabel: last.bLabel || 'Breakfast', oLabel: last.oLabel || 'OT Meal', bRate: String(last.bRate ?? ''), oRate: String(last.oRate ?? ''),
            periodStart: p.start, periodEnd: p.end,
            mealRows: buildRows(p.start, p.end, [], last.bRate ?? '', last.oRate ?? ''),
          };
        }
      }
      return next;
    });
  };

  const saveAsClient = async () => {
    if (!editing.clientName.trim()) return;
    try {
      const ref = await addDoc(collection(db, 'clients'), {
        companyName: editing.clientName, contactPerson: editing.clientContact || '', phone: editing.clientPhone || '',
        email: editing.clientEmail || '', address: editing.clientAddress || '', createdAt: new Date().toISOString(),
      });
      await load();
      setEditing(prev => ({ ...prev, clientId: ref.id }));
      setMessage({ text: `${editing.clientName} saved to Clients.`, type: 'success' });
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const setField = (field) => (e) => setEditing({ ...editing, [field]: e.target.value });
  const setItem = (i, field, value) => setEditing({ ...editing, items: editing.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it) });
  const addItem = () => setEditing({ ...editing, items: [...editing.items, blankItem()] });
  const removeItem = (i) => setEditing({ ...editing, items: editing.items.length > 1 ? editing.items.filter((_, idx) => idx !== i) : editing.items });

  // ---- daily meal editor helpers
  const setPeriod = (start, end) => setEditing(prev => ({
    ...prev, periodStart: start, periodEnd: end, mealRows: buildRows(start, end, prev.mealRows, prev.bRate, prev.oRate),
  }));
  const changeStart = (start) => {
    if (!start) return;
    // a new start date moves the end to the close of its 10-day block (5th -> 10th, 11th -> 20th, 21st -> month end)
    setPeriod(start, blockEnd(start));
  };
  const changeEnd = (end) => { if (end) setPeriod(editing.periodStart, end); };
  const setRow = (i, field, value) => setEditing(prev => ({ ...prev, mealRows: prev.mealRows.map((r, idx) => idx === i ? { ...r, [field]: value } : r) }));
  const addRow = () => setEditing(prev => {
    const last = prev.mealRows[prev.mealRows.length - 1];
    return { ...prev, mealRows: [...prev.mealRows, blankRow(last ? addDaysIso(last.date, 1) : prev.periodStart, prev.bRate, prev.oRate)] };
  });
  const removeRow = (i) => setEditing(prev => ({ ...prev, mealRows: prev.mealRows.filter((_, idx) => idx !== i) }));
  const applyRates = () => setEditing(prev => ({
    ...prev, mealRows: prev.mealRows.map(r => ({ ...r, bRate: String(prev.bRate), oRate: String(prev.oRate) })),
  }));
  const setRate = (field, value) => setEditing(prev => ({
    ...prev, [field]: value,
    // rows still on the old rate follow the new one; rows that were changed by hand keep theirs
    mealRows: prev.mealRows.map(r => {
      const key = field === 'bRate' ? 'bRate' : 'oRate';
      return String(r[key] ?? '') === String(prev[field] ?? '') ? { ...r, [key]: value } : r;
    }),
  }));
  const goNextPeriod = () => { const p = nextPeriod(editing.periodEnd); setPeriod(p.start, p.end); };

  const totals = editing ? invoiceTotals(editing) : null;
  const meal = editing && isMealInvoice(editing);

  const save = async (status) => {
    if (!editing.clientName.trim()) { setMessage({ text: 'Enter or choose a client name.', type: 'error' }); return null; }
    if (meal) {
      if (!editing.mealRows.some(r => Number(r.bQty) > 0 || Number(r.oQty) > 0)) { setMessage({ text: 'Enter at least one day with a quantity.', type: 'error' }); return null; }
    } else if (!editing.items.some(i => i.description.trim())) { setMessage({ text: 'Add at least one item.', type: 'error' }); return null; }
    setBusy(true);
    try {
      const t = invoiceTotals(editing);
      const { id, ...rest } = editing;
      const data = {
        ...rest,
        items: meal ? [] : editing.items.filter(i => i.description.trim()).map(i => ({ ...i, qty: Number(i.qty) || 0, price: Number(i.price) || 0 })),
        discount: Number(editing.discount) || 0,
        taxPercent: Number(editing.taxPercent) || 0,
        subtotal: t.subtotal, discountAmount: t.discountAmount, tax: t.tax, total: t.total,
        status: status || editing.status,
        updatedAt: new Date().toISOString(),
      };
      if (meal) {
        data.mealRows = editing.mealRows.map(r => ({
          date: r.date, bQty: Number(r.bQty) || 0, bRate: Number(r.bRate) || 0, oQty: Number(r.oQty) || 0, oRate: Number(r.oRate) || 0,
        }));
        data.bRate = Number(editing.bRate) || 0;
        data.oRate = Number(editing.oRate) || 0;
        data.breakfastTotal = t.meal.bAmount;
        data.otMealTotal = t.meal.oAmount;
        delete data.meal;
      }
      let savedId = id;
      if (id) await updateDoc(doc(db, 'invoices', id), data);
      else savedId = (await addDoc(collection(db, 'invoices'), { ...data, createdAt: new Date().toISOString() })).id;
      setMessage({ text: `Invoice ${data.number} saved.`, type: 'success' });
      await load();
      setBusy(false);
      return { ...data, id: savedId };
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
      setBusy(false);
      return null;
    }
  };

  const saveAndPreview = async () => {
    const saved = await save();
    if (saved) { setEditing(null); setPreview(saved); }
  };

  const openPay = (inv) => {
    const { total } = invoiceTotals(inv);
    setPayForm({ amount: String(Math.max(0, total - (Number(inv.paidAmount) || 0))), date: today(), method: 'Cash', reference: '' });
    setPayFor(inv);
  };

  const recordPayment = async () => {
    const amount = Number(payForm.amount);
    if (!(amount > 0)) return;
    setBusy(true);
    try {
      const { total } = invoiceTotals(payFor);
      const paidAmount = Math.round(((Number(payFor.paidAmount) || 0) + amount) * 100) / 100;
      await addDoc(collection(db, 'finance'), {
        type: 'income', category: 'Invoice payment', description: `Payment for ${payFor.number}`, amount,
        date: payForm.date, method: payForm.method, reference: payForm.reference || payFor.number, party: payFor.clientName,
        source: 'invoice', sourceId: payFor.id, createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'invoices', payFor.id), {
        paidAmount, status: paidAmount >= total ? 'paid' : 'partial', paymentDate: payForm.date,
      });
      setPayFor(null);
      setMessage({ text: 'Payment recorded and added to Finance as income.', type: 'success' });
      await load();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setBusy(false);
  };

  const markSent = async (inv) => { await updateDoc(doc(db, 'invoices', inv.id), { status: 'sent' }); load(); };
  const cancelInvoice = async (inv) => {
    if (window.confirm(`Cancel invoice ${inv.number}?`)) { await updateDoc(doc(db, 'invoices', inv.id), { status: 'cancelled' }); load(); }
  };
  const remove = async (inv) => {
    if ((Number(inv.paidAmount) || 0) > 0) { window.alert('This invoice has payments recorded in Finance. Cancel it instead of deleting.'); return; }
    if (window.confirm(`Delete invoice ${inv.number}?`)) { await deleteDoc(doc(db, 'invoices', inv.id)); load(); }
  };

  const clientNames = useMemo(() => [...new Set(invoices.map(i => i.clientName).filter(Boolean))].sort(), [invoices]);

  const filtered = useMemo(() => invoices.filter(i =>
    (statusFilter === 'all' || effectiveStatus(i) === statusFilter) &&
    (clientFilter === 'all' || i.clientName === clientFilter) &&
    [i.number, i.clientName, i.reference].some(v => (v || '').toLowerCase().includes(search.toLowerCase()))), [invoices, search, statusFilter, clientFilter]);

  const outstanding = invoices.filter(i => ['sent', 'partial', 'overdue'].includes(effectiveStatus(i)))
    .reduce((s, i) => s + Math.max(0, invoiceTotals(i).total - (Number(i.paidAmount) || 0)), 0);
  const overdueCount = invoices.filter(i => effectiveStatus(i) === 'overdue').length;

  const editInvoice = (inv) => setEditing({
    ...inv,
    items: (inv.items || []).map(i => ({ ...i, qty: String(i.qty), price: String(i.price) })),
    discount: String(inv.discount || ''), taxPercent: String(inv.taxPercent || ''),
    ...(isMealInvoice(inv) ? {
      bRate: String(inv.bRate ?? ''), oRate: String(inv.oRate ?? ''),
      mealRows: (inv.mealRows || []).map(r => ({
        date: r.date, bQty: r.bQty ? String(r.bQty) : '', bRate: String(r.bRate ?? ''), oQty: r.oQty ? String(r.oQty) : '', oRate: String(r.oRate ?? ''),
      })),
    } : {}),
  });

  // ---------------------------------------------------------------- editor
  if (editing) {
    const mt = meal ? totals.meal : null;
    return (
      <div className="fade-in">
        <div className="toolbar">
          <button className="btn-secondary" onClick={() => setEditing(null)}>← Back</button>
          <h1 style={{ marginRight: 'auto' }}>{editing.id ? `Edit ${editing.number}` : meal ? 'New daily meal invoice' : 'New invoice'}</h1>
          <button className="btn-secondary" onClick={() => save('draft')} disabled={busy}>Save draft</button>
          <button className="btn-add" onClick={saveAndPreview} disabled={busy}>Save &amp; preview / print</button>
        </div>
        {message.text && <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>{message.text}</div>}

        <div className="panel">
          <h3>Invoice</h3>
          <div className="grid-4">
            <div className="form-group"><label>Invoice no.</label><input value={editing.number} onChange={setField('number')} /></div>
            <div className="form-group"><label>Invoice date</label><input type="date" value={editing.date} onChange={setField('date')} /></div>
            <div className="form-group"><label>Due date</label><input type="date" value={editing.dueDate} onChange={setField('dueDate')} /></div>
            <div className="form-group"><label>Reference / PO / event</label><input value={editing.reference} onChange={setField('reference')} placeholder="optional" /></div>
          </div>
        </div>

        <div className="panel">
          <h3>Client</h3>
          <div className="form-group">
            <label>Choose an existing client — or leave blank and type details for any other customer</label>
            <select value={editing.clientId || ''} onChange={e => pickClient(e.target.value)}>
              <option value="">— Other / new customer —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}{c.contactPerson ? ` (${c.contactPerson})` : ''}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group"><label>Name / company</label><input value={editing.clientName} onChange={setField('clientName')} /></div>
            <div className="form-group"><label>Contact person</label><input value={editing.clientContact} onChange={setField('clientContact')} /></div>
            <div className="form-group"><label>Phone</label><input value={editing.clientPhone} onChange={setField('clientPhone')} /></div>
            <div className="form-group"><label>Email</label><input value={editing.clientEmail} onChange={setField('clientEmail')} /></div>
          </div>
          <div className="form-group"><label>Address</label><textarea rows={2} value={editing.clientAddress} onChange={setField('clientAddress')} /></div>
          {!editing.clientId && editing.clientName.trim() && (
            <button className="btn-secondary" onClick={saveAsClient}>💾 Save this customer to Clients (so next time you can just pick it)</button>
          )}
        </div>

        {meal ? (<>
          <div className="panel">
            <h3>Billing period (10-day bills)</h3>
            <div className="toolbar">
              <span className="muted">Quick:</span>
              {monthPresets(editing.periodStart).map(p => (
                <button key={p.label} className="btn-secondary" onClick={() => setPeriod(p.start, p.end)}
                  style={editing.periodStart === p.start && editing.periodEnd === p.end ? { outline: '2px solid var(--color-primary)' } : undefined}>{p.label}</button>
              ))}
              <button className="btn-secondary" onClick={goNextPeriod}>Next period →</button>
            </div>
            <div className="grid-4">
              <div className="form-group"><label>Period start</label><input type="date" value={editing.periodStart} onChange={e => changeStart(e.target.value)} /></div>
              <div className="form-group"><label>Period end</label><input type="date" value={editing.periodEnd} onChange={e => changeEnd(e.target.value)} /></div>
              <div className="form-group"><label>1st meal name</label><input value={editing.bLabel} onChange={setField('bLabel')} /></div>
              <div className="form-group"><label>2nd meal name</label><input value={editing.oLabel} onChange={setField('oLabel')} /></div>
            </div>
            <p className="muted" style={{ fontSize: '0.78rem' }}>
              Starting on a later date (say the 5th) gives a shorter first bill that still ends on the 10th; the following bills are 11–20 and 21–month end.
              You can change either date freely: <b>{periodLabel(editing.periodStart, editing.periodEnd)}</b>.
            </p>
          </div>

          <div className="panel">
            <h3>Rates (Rs. per meal)</h3>
            <div className="grid-4">
              <div className="form-group"><label>{editing.bLabel} rate</label><input type="number" min="0" step="any" value={editing.bRate} onChange={e => setRate('bRate', e.target.value)} /></div>
              <div className="form-group"><label>{editing.oLabel} rate</label><input type="number" min="0" step="any" value={editing.oRate} onChange={e => setRate('oRate', e.target.value)} /></div>
              <div className="form-group" style={{ justifyContent: 'flex-end' }}><button className="btn-secondary" onClick={applyRates}>Apply to all days</button></div>
            </div>
          </div>

          <div className="panel">
            <h3>Daily quantities</h3>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th rowSpan={2}>Date</th>
                    <th colSpan={3} style={{ textAlign: 'center' }}>{editing.bLabel}</th>
                    <th colSpan={3} style={{ textAlign: 'center' }}>{editing.oLabel}</th>
                    <th rowSpan={2} />
                  </tr>
                  <tr><th>Qty</th><th>Rate</th><th>Amount</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {editing.mealRows.map((r, i) => {
                    const a = rowAmounts(r);
                    return (
                      <tr key={i}>
                        <td><input type="date" value={r.date} onChange={e => setRow(i, 'date', e.target.value)} style={{ minWidth: 150 }} /></td>
                        <td><input className="num-input" type="number" min="0" step="any" value={r.bQty} onChange={e => setRow(i, 'bQty', e.target.value)} /></td>
                        <td><input className="num-input" type="number" min="0" step="any" value={r.bRate} onChange={e => setRow(i, 'bRate', e.target.value)} /></td>
                        <td>{a.b ? money(a.b) : '—'}</td>
                        <td><input className="num-input" type="number" min="0" step="any" value={r.oQty} onChange={e => setRow(i, 'oQty', e.target.value)} /></td>
                        <td><input className="num-input" type="number" min="0" step="any" value={r.oRate} onChange={e => setRow(i, 'oRate', e.target.value)} /></td>
                        <td>{a.o ? money(a.o) : '—'}</td>
                        <td><button className="action-btn delete" title="Remove day" onClick={() => removeRow(i)}>🗑️</button></td>
                      </tr>
                    );
                  })}
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td>{mt.bQty}</td><td /><td className="pos">{money(mt.bAmount)}</td>
                    <td>{mt.oQty}</td><td /><td className="pos">{money(mt.oAmount)}</td><td />
                  </tr>
                </tbody>
              </table>
            </div>
            <button className="btn-secondary" onClick={addRow} style={{ marginTop: '0.6rem' }}>+ Add day</button>
          </div>
        </>) : (
          <div className="panel">
            <h3>Items</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Description</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 90 }}>Unit</th><th style={{ width: 140 }}>Unit price (Rs.)</th><th style={{ width: 130 }}>Amount</th><th /></tr></thead>
                <tbody>
                  {editing.items.map((it, i) => (
                    <tr key={i}>
                      <td><input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="e.g. Wedding buffet — 150 guests" /></td>
                      <td><input type="number" min="0" step="any" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} /></td>
                      <td><input value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} placeholder="pax / kg" /></td>
                      <td><input type="number" min="0" step="any" value={it.price} onChange={e => setItem(i, 'price', e.target.value)} /></td>
                      <td>{money((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                      <td><button className="action-btn delete" onClick={() => removeItem(i)}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-secondary" onClick={addItem} style={{ marginTop: '0.6rem' }}>+ Add item</button>
          </div>
        )}

        <div className="panel">
          <h3>Totals</h3>
          <div className="grid-3">
            <div className="form-group"><label>Discount type</label>
              <select value={editing.discountType} onChange={setField('discountType')}><option value="amount">Amount (Rs.)</option><option value="percent">Percent (%)</option></select>
            </div>
            <div className="form-group"><label>Discount</label><input type="number" min="0" step="any" value={editing.discount} onChange={setField('discount')} /></div>
            <div className="form-group"><label>VAT / tax % (0 for none)</label><input type="number" min="0" step="any" value={editing.taxPercent} onChange={setField('taxPercent')} /></div>
          </div>
          <div className="doc-totals" style={{ color: 'var(--text-main)', width: 'min(380px, 100%)' }}>
            {meal ? (<>
              <div><span>{editing.bLabel} total</span><span>{money(mt.bAmount)}</span></div>
              <div><span>{editing.oLabel} total</span><span>{money(mt.oAmount)}</span></div>
            </>) : (
              <div><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            )}
            {totals.discountAmount > 0 && <div><span>Discount</span><span>− {money(totals.discountAmount)}</span></div>}
            {totals.tax > 0 && <div><span>Tax</span><span>{money(totals.tax)}</span></div>}
            <div className="grand"><span>TOTAL</span><span>Rs. {money(totals.total)}</span></div>
          </div>
        </div>

        <div className="panel">
          <h3>Notes &amp; terms</h3>
          <div className="form-group"><label>Notes</label><textarea rows={2} value={editing.notes} onChange={setField('notes')} /></div>
          <div className="form-group"><label>Terms</label><textarea rows={2} value={editing.terms} onChange={setField('terms')} /></div>
          <p className="muted" style={{ fontSize: '0.78rem' }}>Bank details and company address come from the Letterhead page (Company details).</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ list
  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>Invoices</h1>
      {message.text && <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>{message.text}</div>}

      <div className="dashboard-grid">
        <div className="stat-card clients"><div className="stat-info"><h3>Invoices</h3><div className="stat-value">{invoices.length}</div></div><div className="stat-icon">🧾</div></div>
        <div className="stat-card orders"><div className="stat-info"><h3>Outstanding</h3><div className="stat-value">Rs. {money(outstanding)}</div></div><div className="stat-icon">⏳</div></div>
        <div className="stat-card revenue"><div className="stat-info"><h3>Overdue</h3><div className="stat-value" style={{ color: overdueCount ? 'var(--color-danger)' : undefined }}>{overdueCount}</div></div><div className="stat-icon">⚠️</div></div>
      </div>

      <div className="data-section">
        <div className="data-section-header">
          <div className="search-bar"><span className="search-icon">🔍</span><input placeholder="Search number or client…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">All clients</option>
              {clientNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">All</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="partial">Part paid</option>
              <option value="overdue">Overdue</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
            </select>
            <button className="btn-secondary" onClick={newMealInvoice}>+ Daily meal invoice</button>
            <button className="btn-add" onClick={newInvoice}>+ New invoice</button>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Due</th><th>Total (Rs.)</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(inv => {
                  const st = effectiveStatus(inv);
                  const { total } = invoiceTotals(inv);
                  return (
                    <tr key={inv.id}>
                      <td className="doc-strong">{inv.number}</td>
                      <td>
                        {inv.clientName}
                        {isMealInvoice(inv) && <div className="muted" style={{ fontSize: '0.74rem' }}>Period {periodLabel(inv.periodStart, inv.periodEnd)}</div>}
                      </td>
                      <td>{formatDate(inv.date)}</td>
                      <td>{formatDate(inv.dueDate)}</td>
                      <td>{money(total)}</td>
                      <td>{money(inv.paidAmount)}</td>
                      <td><span className={`status-badge ${STATUS_STYLE[st]}`}>{st}</span></td>
                      <td>
                        <div className="action-btns">
                          <button className="action-btn" title="View / print / download" onClick={() => setPreview(inv)}>🖨️</button>
                          <button className="action-btn" title="Edit" onClick={() => editInvoice(inv)}>✏️</button>
                          {['draft'].includes(st) && <button className="action-btn" title="Mark as sent" onClick={() => markSent(inv)}>📤</button>}
                          {!['paid', 'cancelled'].includes(st) && <button className="action-btn" title="Record payment" onClick={() => openPay(inv)}>💳</button>}
                          {!['paid', 'cancelled'].includes(st) && <button className="action-btn" title="Cancel invoice" onClick={() => cancelInvoice(inv)}>🚫</button>}
                          <button className="action-btn delete" title="Delete" onClick={() => remove(inv)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon">🧾</div><p>No invoices yet. Click “New invoice” for a normal bill, or “Daily meal invoice” for the 10-day bills with daily breakfast / OT meal quantities.</p></div>
        )}
      </div>

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal wide" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div className="toolbar">
              <h2 style={{ marginRight: 'auto' }}>{preview.number}</h2>
              <button className="btn-secondary" onClick={() => printElementById('invoice-sheet')}>🖨 Print</button>
              <button className="btn-secondary" onClick={() => downloadElementAsPdf('invoice-sheet', preview.number)}>⬇ Download PDF</button>
              <button className="btn-cancel" onClick={() => setPreview(null)}>Close</button>
            </div>
            <InvoiceDocument company={company} invoice={preview} id="invoice-sheet" />
          </div>
        </div>
      )}

      {payFor && (
        <div className="modal-overlay" onClick={() => setPayFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Record payment — {payFor.number}</h2>
            <p className="muted">Added to Finance as income (category “Invoice payment”).</p>
            <div className="grid-2">
              <div className="form-group"><label>Amount (Rs.)</label><input type="number" min="0" step="any" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} /></div>
              <div className="form-group"><label>Date</label><input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} /></div>
              <div className="form-group"><label>Method</label>
                <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Cheque</option></select>
              </div>
              <div className="form-group"><label>Reference</label><input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="cheque / transfer no." /></div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setPayFor(null)}>Cancel</button>
              <button className="btn-save" onClick={recordPayment} disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
