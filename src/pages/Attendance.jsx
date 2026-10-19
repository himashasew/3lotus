import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, addDocs, updateDoc, deleteDoc, doc, query, where, db } from '../services/data';
import { STATUSES, LEAVE_TYPES, summarise, leaveTaken, defaultHours, daysInMonth, today, DEFAULT_RATES } from '../lib/payroll';

const pad = (n) => String(n).padStart(2, '0');

export default function Attendance() {
  const [date, setDate] = useState(today());
  const [employees, setEmployees] = useState([]);
  const [monthRecords, setMonthRecords] = useState([]);
  const [yearRecords, setYearRecords] = useState([]);
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const month = date.slice(0, 7);
  const year = date.slice(0, 4);

  const load = useCallback(async () => {
    try {
      const [empSnap, monthSnap, yearSnap] = await Promise.all([
        getDocs(collection(db, 'employees')),
        getDocs(query(collection(db, 'attendance'), where('month', '==', month))),
        getDocs(query(collection(db, 'attendance'), where('year', '==', year))),
      ]);
      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => (e.status || 'active') === 'active')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setMonthRecords(monthSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setYearRecords(yearSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMessage({ text: '', type: '' });
    } catch (err) {
      setMessage({ text: `${err.message} — if this is a new feature, run supabase/migration-002-hr-invoices.sql in Supabase first.`, type: 'error' });
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  // Rebuild the editable rows whenever the day or loaded data changes
  useEffect(() => {
    const next = {};
    employees.forEach(e => {
      const rec = monthRecords.find(r => r.employeeId === e.id && r.date === date);
      next[e.id] = rec
        ? { docId: rec.id, status: rec.status, hours: String(rec.hours ?? ''), otHours: String(rec.otHours ?? ''), note: rec.note || '' }
        : { docId: null, status: '', hours: '', otHours: '', note: '' };
    });
    setRows(next);
  }, [employees, monthRecords, date]);

  const stdFor = (e) => Number(e.stdHours) || DEFAULT_RATES.stdHours;

  const setRow = (id, patch) => setRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const changeStatus = (emp, status) => {
    setRow(emp.id, { status, hours: status ? String(defaultHours(status, stdFor(emp))) : '', otHours: status === 'PRESENT' || status === 'HALF_DAY' ? rows[emp.id]?.otHours || '' : '' });
  };

  const markAllPresent = () => {
    const next = { ...rows };
    employees.forEach(e => {
      if (!next[e.id].status) next[e.id] = { ...next[e.id], status: 'PRESENT', hours: String(stdFor(e)) };
    });
    setRows(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const fresh = [];
      for (const e of employees) {
        const r = rows[e.id];
        if (!r) continue;
        if (!r.status) {
          if (r.docId) await deleteDoc(doc(db, 'attendance', r.docId));
          continue;
        }
        const data = {
          employeeId: e.id, employeeName: e.name, date, month, year: Number(year),
          status: r.status, hours: Number(r.hours) || 0, otHours: Number(r.otHours) || 0, note: r.note || '',
        };
        if (r.docId) await updateDoc(doc(db, 'attendance', r.docId), data);
        else fresh.push(data);
      }
      await addDocs(collection(db, 'attendance'), fresh);
      setMessage({ text: `Attendance saved for ${date}.`, type: 'success' });
      await load();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setSaving(false);
  };

  const shiftDay = (delta) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const marked = Object.values(rows).filter(r => r.status).length;
  const nDays = daysInMonth(month);

  const summary = useMemo(() => employees.map(e => {
    const mine = monthRecords.filter(r => r.employeeId === e.id);
    const yearly = yearRecords.filter(r => r.employeeId === e.id);
    const s = summarise(mine);
    const taken = leaveTaken(yearly);
    return { emp: e, s, taken };
  }), [employees, monthRecords, yearRecords]);

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>Attendance</h1>

      {message.text && <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>{message.text}</div>}

      <div className="panel">
        <div className="toolbar">
          <button className="btn-secondary" onClick={() => shiftDay(-1)}>←</button>
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ width: 'auto' }} />
          <button className="btn-secondary" onClick={() => shiftDay(1)}>→</button>
          <button className="btn-secondary" onClick={() => setDate(today())}>Today</button>
          <span className="muted">{new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={markAllPresent}>✔ Mark unmarked as present</button>
          <button className="btn-add" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save attendance (${marked}/${employees.length})`}</button>
        </div>

        {employees.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Status</th><th>Hours worked</th><th>Overtime hrs</th><th>Note</th></tr>
              </thead>
              <tbody>
                {employees.map(e => {
                  const r = rows[e.id] || { status: '', hours: '', otHours: '', note: '' };
                  const st = STATUSES[r.status];
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="doc-strong">{e.name}</div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>{e.designation || e.department || ''}</div>
                      </td>
                      <td>
                        <select value={r.status} onChange={ev => changeStatus(e, ev.target.value)} style={{ minWidth: 190, borderLeft: `4px solid ${st ? st.color : 'transparent'}` }}>
                          <option value="">— not marked —</option>
                          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td><input className="num-input" type="number" min="0" step="any" value={r.hours} disabled={!r.status} onChange={ev => setRow(e.id, { hours: ev.target.value })} /></td>
                      <td><input className="num-input" type="number" min="0" step="any" value={r.otHours} disabled={!r.status} onChange={ev => setRow(e.id, { otHours: ev.target.value })} /></td>
                      <td><input value={r.note} disabled={!r.status} onChange={ev => setRow(e.id, { note: ev.target.value })} placeholder="optional" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon">🗓️</div><p>No active employees yet. Add them on the Employees page.</p></div>
        )}
      </div>

      {employees.length > 0 && (
        <>
          <div className="panel">
            <h3>Month view — {new Date(month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
            <div className="toolbar" style={{ gap: '0.4rem' }}>
              {Object.entries(STATUSES).map(([k, v]) => (
                <span key={k} className="chip" style={{ background: v.color }}>{v.short} · {v.label}</span>
              ))}
            </div>
            <div className="table-scroll">
              <table className="data-table" style={{ fontSize: '0.72rem' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 130 }}>Employee</th>
                    {Array.from({ length: nDays }, (_, i) => {
                      const dstr = `${month}-${pad(i + 1)}`;
                      return <th key={i} style={{ padding: '0.4rem 0.25rem', textAlign: 'center', cursor: 'pointer', background: dstr === date ? 'var(--bg-hover)' : undefined }} onClick={() => setDate(dstr)}>{i + 1}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      {Array.from({ length: nDays }, (_, i) => {
                        const dstr = `${month}-${pad(i + 1)}`;
                        const rec = monthRecords.find(r => r.employeeId === e.id && r.date === dstr);
                        const st = rec && STATUSES[rec.status];
                        return (
                          <td key={i} style={{ padding: '0.3rem 0.15rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setDate(dstr)} title={st ? st.label : 'Not marked'}>
                            {st ? <span className="chip" style={{ background: st.color, padding: '0.05rem 0.3rem', fontSize: '0.65rem' }}>{st.short}</span> : <span className="muted">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Month totals and leave balances ({year})</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th><th>Present</th><th>Half</th><th>Absent</th><th>Leave this month</th><th>Holidays</th><th>Hours</th><th>OT hrs</th>
                    <th>Annual left</th><th>Casual left</th><th>Medical left</th><th>Unpaid taken ({year})</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(({ emp, s, taken }) => {
                    const left = (ent, used) => { const v = (Number(ent) || 0) - used; return <span className={v < 0 ? 'neg' : ''}>{v}</span>; };
                    return (
                      <tr key={emp.id}>
                        <td className="doc-strong">{emp.name}</td>
                        <td>{s.counts.PRESENT}</td><td>{s.counts.HALF_DAY}</td><td className={s.counts.ABSENT ? 'neg' : ''}>{s.counts.ABSENT}</td>
                        <td>{LEAVE_TYPES.reduce((a, k) => a + s.counts[k], 0) + s.counts.UNPAID_LEAVE}</td>
                        <td>{s.counts.HOLIDAY}</td><td>{s.hours}</td><td>{s.otHours}</td>
                        <td>{left(emp.annualLeave, taken.ANNUAL_LEAVE)} / {emp.annualLeave ?? 0}</td>
                        <td>{left(emp.casualLeave, taken.CASUAL_LEAVE)} / {emp.casualLeave ?? 0}</td>
                        <td>{left(emp.medicalLeave, taken.MEDICAL_LEAVE)} / {emp.medicalLeave ?? 0}</td>
                        <td>{taken.UNPAID_LEAVE}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
