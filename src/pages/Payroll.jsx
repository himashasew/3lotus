import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, addDoc, addDocs, updateDoc, deleteDoc, doc, query, where, db } from '../services/data';
import { calcPay, currentMonth, money, today, PAY_TYPES, DEFAULT_RATES } from '../lib/payroll';
import { printElementById, downloadElementAsPdf } from '../lib/documents';
import { useCompany } from '../lib/useCompany';
import Payslip from '../components/Payslip';

const EXTRA_KEYS = ['bonus', 'otherEarnings', 'advance', 'otherDeductions'];

export default function Payroll() {
  const { company, rates, save: saveCompany } = useCompany();
  const [month, setMonth] = useState(currentMonth());
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [saved, setSaved] = useState([]);
  const [extras, setExtras] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [payFor, setPayFor] = useState(null);
  const [payForm, setPayForm] = useState({ date: today(), method: 'Cash' });
  const [slips, setSlips] = useState(null);
  const [showRates, setShowRates] = useState(false);
  const [rateForm, setRateForm] = useState({});

  const load = useCallback(async () => {
    try {
      const [empSnap, attSnap, paySnap] = await Promise.all([
        getDocs(collection(db, 'employees')),
        getDocs(query(collection(db, 'attendance'), where('month', '==', month))),
        getDocs(query(collection(db, 'payroll'), where('month', '==', month))),
      ]);
      const payDocs = paySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const att = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const emps = empSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => (e.status || 'active') === 'active' || payDocs.some(p => p.employeeId === e.id))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setEmployees(emps);
      setRecords(att);
      setSaved(payDocs);
      const ex = {};
      emps.forEach(e => {
        const p = payDocs.find(x => x.employeeId === e.id);
        ex[e.id] = Object.fromEntries(EXTRA_KEYS.map(k => [k, p ? String(p[k] || '') : '']));
      });
      setExtras(ex);
      setMessage({ text: '', type: '' });
    } catch (err) {
      setMessage({ text: `${err.message} — if this is a new feature, run supabase/migration-002-hr-invoices.sql in Supabase first.`, type: 'error' });
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const lines = useMemo(() => employees.map(emp => {
    const savedDoc = saved.find(p => p.employeeId === emp.id);
    const paid = savedDoc?.status === 'paid';
    const mine = records.filter(r => r.employeeId === emp.id);
    const pay = paid ? savedDoc : { ...calcPay(emp, mine, extras[emp.id] || {}, rates), month };
    return { emp, pay: { ...pay, month }, savedDoc, paid };
  }), [employees, records, saved, extras, rates, month]);

  const totals = useMemo(() => lines.reduce((t, { pay }) => ({
    gross: t.gross + (pay.gross || 0),
    net: t.net + (pay.net || 0),
    epfEmployee: t.epfEmployee + (pay.epfEmployee || 0),
    epfEmployer: t.epfEmployer + (pay.epfEmployer || 0),
    etfEmployer: t.etfEmployer + (pay.etfEmployer || 0),
  }), { gross: 0, net: 0, epfEmployee: 0, epfEmployer: 0, etfEmployer: 0 }), [lines]);

  const setExtra = (id, key, value) => setExtras(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const toDoc = ({ emp, pay }) => ({
    ...pay,
    key: `${emp.id}|${month}`,
    employeeId: emp.id,
    employeeName: emp.name,
    month,
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  const saveAll = async () => {
    setBusy(true);
    try {
      const fresh = [];
      for (const line of lines) {
        if (line.paid) continue;
        const data = toDoc(line);
        if (line.savedDoc) await updateDoc(doc(db, 'payroll', line.savedDoc.id), data);
        else fresh.push(data);
      }
      await addDocs(collection(db, 'payroll'), fresh);
      setMessage({ text: `Payroll for ${month} saved.`, type: 'success' });
      await load();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setBusy(false);
  };

  const markPaid = async (line, when, method) => {
    const data = { ...toDoc(line), status: 'paid', paidDate: when, paidMethod: method };
    let payrollId = line.savedDoc?.id;
    if (payrollId) await updateDoc(doc(db, 'payroll', payrollId), data);
    else payrollId = (await addDoc(collection(db, 'payroll'), data)).id;
    const fin = await addDoc(collection(db, 'finance'), {
      type: 'expense', category: 'Salaries & Wages',
      description: `Salary - ${line.emp.name} (${month})`,
      amount: data.net, date: when, method, party: line.emp.name,
      source: 'payroll', sourceId: payrollId, createdAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'payroll', payrollId), { financeId: fin.id });
  };

  const confirmPay = async () => {
    setBusy(true);
    try {
      const targets = payFor === 'all' ? lines.filter(l => !l.paid && l.pay.net > 0) : [payFor];
      for (const line of targets) await markPaid(line, payForm.date, payForm.method);
      setPayFor(null);
      setMessage({ text: `${targets.length} salary payment(s) recorded and added to Finance as expenses.`, type: 'success' });
      await load();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setBusy(false);
  };

  const undoPaid = async (line) => {
    if (!window.confirm(`Mark ${line.emp.name}'s salary as unpaid and remove the Finance expense?`)) return;
    try {
      if (line.savedDoc.financeId) await deleteDoc(doc(db, 'finance', line.savedDoc.financeId));
      await updateDoc(doc(db, 'payroll', line.savedDoc.id), { status: 'draft', paidDate: '', paidMethod: '', financeId: '' });
      await load();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const recordStatutory = async () => {
    const epf = totals.epfEmployee + totals.epfEmployer;
    const etf = totals.etfEmployer;
    if (epf + etf <= 0) return;
    if (!window.confirm(`Record EPF (Rs. ${money(epf)}) and ETF (Rs. ${money(etf)}) remittance for ${month} in Finance?`)) return;
    try {
      const existing = await getDocs(query(collection(db, 'finance'), where('sourceId', '==', `statutory-${month}`)));
      if (existing.docs.length > 0) { setMessage({ text: 'EPF/ETF for this month is already recorded in Finance.', type: 'error' }); return; }
      const when = today();
      const base = { type: 'expense', date: when, method: 'Bank', source: 'statutory', sourceId: `statutory-${month}`, createdAt: new Date().toISOString() };
      const entries = [];
      if (epf > 0) entries.push({ ...base, category: 'EPF / ETF', description: `EPF contribution 20% (${month})`, amount: Math.round(epf * 100) / 100 });
      if (etf > 0) entries.push({ ...base, category: 'EPF / ETF', description: `ETF contribution 3% (${month})`, amount: Math.round(etf * 100) / 100 });
      await addDocs(collection(db, 'finance'), entries);
      setMessage({ text: 'EPF/ETF remittance recorded in Finance.', type: 'success' });
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const openRates = () => { setRateForm({ ...DEFAULT_RATES, ...rates }); setShowRates(true); };
  const saveRates = async (e) => {
    e.preventDefault();
    const payroll = Object.fromEntries(Object.keys(DEFAULT_RATES).map(k => [k, Number(rateForm[k]) || DEFAULT_RATES[k]]));
    try {
      await saveCompany({ ...company, payroll });
      setShowRates(false);
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const numInput = (line, key) => (
    <input className="num-input" type="number" min="0" step="any" value={extras[line.emp.id]?.[key] ?? ''} disabled={line.paid}
      onChange={e => setExtra(line.emp.id, key, e.target.value)} style={{ maxWidth: 90 }} />
  );

  const unpaid = lines.filter(l => !l.paid && l.pay.net > 0);

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>Payroll</h1>
      {message.text && <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>{message.text}</div>}

      <div className="dashboard-grid">
        <div className="stat-card clients"><div className="stat-info"><h3>Gross pay</h3><div className="stat-value">Rs. {money(totals.gross)}</div></div><div className="stat-icon">💵</div></div>
        <div className="stat-card revenue"><div className="stat-info"><h3>Net pay</h3><div className="stat-value">Rs. {money(totals.net)}</div></div><div className="stat-icon">🧾</div></div>
        <div className="stat-card orders"><div className="stat-info"><h3>EPF 20% · ETF 3% due</h3><div className="stat-value" style={{ fontSize: '1.2rem' }}>Rs. {money(totals.epfEmployee + totals.epfEmployer)} · {money(totals.etfEmployer)}</div></div><div className="stat-icon">🏛️</div></div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ width: 'auto' }} />
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={openRates}>⚙ Rates (EPF, ETF, OT)</button>
          <button className="btn-secondary" onClick={() => setSlips(lines.map(l => l))} disabled={lines.length === 0}>🖨 All payslips</button>
          <button className="btn-secondary" onClick={recordStatutory} disabled={totals.epfEmployee + totals.etfEmployer <= 0}>🏛 Record EPF/ETF to Finance</button>
          <button className="btn-secondary" onClick={saveAll} disabled={busy || lines.length === 0}>💾 Save payroll</button>
          <button className="btn-add" onClick={() => { setPayForm({ date: today(), method: 'Cash' }); setPayFor('all'); }} disabled={busy || unpaid.length === 0}>Pay all ({unpaid.length})</button>
        </div>

        {lines.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Employee</th><th>Days / hrs</th><th>Basic</th><th>OT</th><th>Allow.</th>
                  <th>Bonus</th><th>Other +</th><th>Gross</th><th>EPF 8%</th><th>Advance</th><th>Other −</th><th>Net pay</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const { emp, pay, paid } = line;
                  return (
                    <tr key={emp.id}>
                      <td><div className="doc-strong">{emp.name}</div><div className="muted" style={{ fontSize: '0.72rem' }}>{PAY_TYPES[emp.payType || 'monthly']}{emp.epf ? ' · EPF' : ''}{emp.etf ? ' · ETF' : ''}</div></td>
                      <td>{pay.payType === 'hourly' ? `${pay.hours} h` : `${pay.payableDays} d`}{pay.otHours ? ` +${pay.otHours} OT` : ''}</td>
                      <td>{money(pay.basic)}</td><td>{money(pay.otPay)}</td><td>{money(pay.allowance)}</td>
                      <td>{numInput(line, 'bonus')}</td><td>{numInput(line, 'otherEarnings')}</td>
                      <td className="doc-strong">{money(pay.gross)}</td>
                      <td>{money(pay.epfEmployee)}</td>
                      <td>{numInput(line, 'advance')}</td><td>{numInput(line, 'otherDeductions')}</td>
                      <td className="doc-strong pos">{money(pay.net)}</td>
                      <td>{paid ? <span className="status-badge completed">Paid {pay.paidDate}</span> : <span className="status-badge cooking">{line.savedDoc ? 'Saved' : 'Draft'}</span>}</td>
                      <td>
                        <div className="action-btns">
                          <button className="action-btn" title="Payslip" onClick={() => setSlips([line])}>🧾</button>
                          {paid
                            ? <button className="action-btn" title="Undo payment" onClick={() => undoPaid(line)}>↩️</button>
                            : <button className="action-btn" title="Mark paid" disabled={pay.net <= 0} onClick={() => { setPayForm({ date: today(), method: 'Cash' }); setPayFor(line); }}>💳</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={7}>Totals</td><td>{money(totals.gross)}</td><td>{money(totals.epfEmployee)}</td><td colSpan={2}></td><td className="pos">{money(totals.net)}</td><td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon">🧾</div><p>No active employees. Add employees and mark attendance first.</p></div>
        )}
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.8rem' }}>
          EPF/ETF are worked out on basic pay + fixed allowance (overtime and bonus excluded), only for employees marked EPF/ETF.
          Daily-wage staff are paid for days present, half days, paid leave and (if enabled) public holidays. Monthly staff are reduced
          by 1/{rates.monthDivisor} of salary per absent or unpaid-leave day. Paid payslips are frozen and no longer change with attendance.
        </p>
      </div>

      {payFor && (
        <div className="modal-overlay" onClick={() => setPayFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{payFor === 'all' ? `Pay all (${unpaid.length} staff)` : `Pay ${payFor.emp.name}`}</h2>
            <p className="muted">
              Total Rs. {money(payFor === 'all' ? unpaid.reduce((s, l) => s + l.pay.net, 0) : payFor.pay.net)} will be recorded as a
              "Salaries &amp; Wages" expense in Finance.
            </p>
            <div className="form-group"><label>Payment date</label><input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} /></div>
            <div className="form-group"><label>Method</label>
              <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                <option>Cash</option><option>Bank transfer</option><option>Cheque</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setPayFor(null)}>Cancel</button>
              <button className="btn-save" onClick={confirmPay} disabled={busy}>{busy ? 'Saving…' : 'Confirm payment'}</button>
            </div>
          </div>
        </div>
      )}

      {showRates && (
        <div className="modal-overlay" onClick={() => setShowRates(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Payroll rates</h2>
            <form onSubmit={saveRates}>
              <div className="grid-2">
                <div className="form-group"><label>EPF employee %</label><input type="number" step="any" value={rateForm.epfEmployee} onChange={e => setRateForm({ ...rateForm, epfEmployee: e.target.value })} /></div>
                <div className="form-group"><label>EPF employer %</label><input type="number" step="any" value={rateForm.epfEmployer} onChange={e => setRateForm({ ...rateForm, epfEmployer: e.target.value })} /></div>
                <div className="form-group"><label>ETF employer %</label><input type="number" step="any" value={rateForm.etfEmployer} onChange={e => setRateForm({ ...rateForm, etfEmployer: e.target.value })} /></div>
                <div className="form-group"><label>Days in pay month (for deductions)</label><input type="number" step="any" value={rateForm.monthDivisor} onChange={e => setRateForm({ ...rateForm, monthDivisor: e.target.value })} /></div>
                <div className="form-group"><label>Standard hours / day</label><input type="number" step="any" value={rateForm.stdHours} onChange={e => setRateForm({ ...rateForm, stdHours: e.target.value })} /></div>
                <div className="form-group"><label>Default OT multiplier</label><input type="number" step="any" value={rateForm.otMultiplier} onChange={e => setRateForm({ ...rateForm, otMultiplier: e.target.value })} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowRates(false)}>Cancel</button>
                <button type="submit" className="btn-save">Save rates</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {slips && (
        <div className="modal-overlay" onClick={() => setSlips(null)}>
          <div className="modal wide" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div className="toolbar">
              <h2 style={{ marginRight: 'auto' }}>Payslip{slips.length > 1 ? 's' : ''}</h2>
              <button className="btn-secondary" onClick={() => printElementById('payslip-area')}>🖨 Print</button>
              <button className="btn-secondary" onClick={() => downloadElementAsPdf('payslip-area', `Payslip-${month}${slips.length === 1 ? '-' + slips[0].emp.name.replace(/\s+/g, '_') : ''}`)}>⬇ Download PDF</button>
              <button className="btn-cancel" onClick={() => setSlips(null)}>Close</button>
            </div>
            <div id="payslip-area">
              {slips.map(line => <Payslip key={line.emp.id} company={company} emp={line.emp} pay={line.pay} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
