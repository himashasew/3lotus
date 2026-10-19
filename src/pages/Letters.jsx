import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, db } from '../services/data';
import { today } from '../lib/payroll';
import { printElementById, downloadElementAsPdf, formatDate, COMPANY_DEFAULTS } from '../lib/documents';
import { useCompany } from '../lib/useCompany';
import { useAuth } from '../context/AuthContext';
import Letterhead from '../components/Letterhead';

const BLANK = {
  name: '', date: '', toName: '', toAddress: '', subject: '', salutation: 'Dear Sir / Madam,',
  body: '', closing: 'Yours faithfully,', signatory: '', designation: '', blank: false,
};

export default function Letters() {
  const { company, save: saveCompany, error: companyError } = useCompany();
  const { hasAccess } = useAuth();
  const canEditCompany = hasAccess('MANAGER');

  const [form, setForm] = useState({ ...BLANK, date: today() });
  const [letterId, setLetterId] = useState(null);
  const [letters, setLetters] = useState([]);
  const [co, setCo] = useState(null);                 // company form (strings)
  const [message, setMessage] = useState({ text: '', type: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCo({
      ...company,
      addressText: (company.addressLines || []).join('\n'),
    });
  }, [company]);

  const loadLetters = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'letterheads'));
      setLetters(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    } catch (err) {
      setMessage({ text: `${err.message} — if this is a new feature, run supabase/migration-002-hr-invoices.sql in Supabase first.`, type: 'error' });
    }
  }, []);

  useEffect(() => { loadLetters(); }, [loadLetters]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setC = (field) => (e) => setCo({ ...co, [field]: e.target.value });

  const saveCo = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { addressText, ...rest } = co;
      await saveCompany({ ...rest, addressLines: addressText.split('\n').map(s => s.trim()).filter(Boolean) });
      setMessage({ text: 'Company details saved. They now appear on invoices, payslips and letters.', type: 'success' });
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setBusy(false);
  };

  const resetCo = () => setCo({ ...COMPANY_DEFAULTS, ...co, addressText: COMPANY_DEFAULTS.addressLines.join('\n'), phone: COMPANY_DEFAULTS.phone, email: COMPANY_DEFAULTS.email, name: COMPANY_DEFAULTS.name });

  const saveLetter = async () => {
    setBusy(true);
    try {
      const data = { ...form, name: form.name || form.subject || `Letter ${form.date}`, updatedAt: new Date().toISOString() };
      if (letterId) await updateDoc(doc(db, 'letterheads', letterId), data);
      else setLetterId((await addDoc(collection(db, 'letterheads'), { ...data, createdAt: new Date().toISOString() })).id);
      setMessage({ text: 'Letter saved.', type: 'success' });
      await loadLetters();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
    setBusy(false);
  };

  const openLetter = (l) => { const { id, ...rest } = l; setForm({ ...BLANK, ...rest }); setLetterId(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const newLetter = () => { setForm({ ...BLANK, date: today() }); setLetterId(null); };
  const removeLetter = async (l) => {
    if (!window.confirm(`Delete "${l.name}"?`)) return;
    await deleteDoc(doc(db, 'letterheads', l.id));
    if (letterId === l.id) newLetter();
    loadLetters();
  };

  const fileName = (form.subject || 'Letter').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Letter';

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>Letterhead &amp; Letters</h1>
      {message.text && <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>{message.text}</div>}
      {companyError && <div className="msg-error">{companyError.message} — run supabase/migration-002-hr-invoices.sql in Supabase first.</div>}

      <div className="split-view">
        <div>
          <div className="panel">
            <div className="toolbar" style={{ marginBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, marginRight: 'auto' }}>Write a letter</h3>
              <button className="btn-secondary" onClick={newLetter}>New</button>
            </div>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.8rem' }}>
              <input type="checkbox" checked={form.blank} onChange={set('blank')} style={{ width: 'auto' }} /> Blank letterhead only (for hand-written letters)
            </label>
            {!form.blank && (<>
              <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={set('date')} /></div>
              <div className="form-group"><label>To (name)</label><input value={form.toName} onChange={set('toName')} /></div>
              <div className="form-group"><label>To (address)</label><textarea rows={3} value={form.toAddress} onChange={set('toAddress')} /></div>
              <div className="form-group"><label>Subject</label><input value={form.subject} onChange={set('subject')} /></div>
              <div className="form-group"><label>Salutation</label><input value={form.salutation} onChange={set('salutation')} /></div>
              <div className="form-group"><label>Letter body</label><textarea rows={10} value={form.body} onChange={set('body')} placeholder="Write the letter here…" /></div>
              <div className="form-group"><label>Closing</label><input value={form.closing} onChange={set('closing')} /></div>
              <div className="grid-2">
                <div className="form-group"><label>Signed by</label><input value={form.signatory} onChange={set('signatory')} /></div>
                <div className="form-group"><label>Designation</label><input value={form.designation} onChange={set('designation')} /></div>
              </div>
            </>)}
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button className="btn-add" onClick={() => printElementById('letter-sheet')}>🖨 Print</button>
              <button className="btn-secondary" onClick={() => downloadElementAsPdf('letter-sheet', form.blank ? 'Letterhead' : fileName)}>⬇ PDF</button>
              {!form.blank && <button className="btn-secondary" onClick={saveLetter} disabled={busy}>💾 {letterId ? 'Update' : 'Save'} letter</button>}
            </div>
          </div>
        </div>

        <div>
          <Letterhead company={company} id="letter-sheet">
            {!form.blank && (<>
              <div style={{ textAlign: 'right' }}>{formatDate(form.date)}</div>
              <div style={{ marginTop: 14 }}>
                {form.toName && <div className="doc-strong">{form.toName}</div>}
                {form.toAddress && <div style={{ whiteSpace: 'pre-line' }}>{form.toAddress}</div>}
              </div>
              {form.subject && <div className="doc-strong" style={{ marginTop: 18, textDecoration: 'underline' }}>{form.subject}</div>}
              <div style={{ marginTop: 18 }}>{form.salutation}</div>
              <div className="doc-letter-body">{form.body}</div>
              <div style={{ marginTop: 24 }}>{form.closing}</div>
              <div style={{ marginTop: 56 }}>
                {form.signatory && <div className="doc-strong">{form.signatory}</div>}
                {form.designation && <div>{form.designation}</div>}
                <div>{company.name}</div>
              </div>
            </>)}
          </Letterhead>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', marginTop: '1.1rem' }}>
          <div className="panel">
            <h3>Company &amp; letterhead details</h3>
            {co && (
              <form onSubmit={saveCo}>
                <div className="form-group"><label>Business name</label><input value={co.name || ''} onChange={setC('name')} disabled={!canEditCompany} /></div>
                <div className="form-group"><label>Address (one line per row)</label><textarea rows={3} value={co.addressText || ''} onChange={setC('addressText')} disabled={!canEditCompany} /></div>
                <div className="form-group"><label>Phone numbers</label><input value={co.phone || ''} onChange={setC('phone')} disabled={!canEditCompany} /></div>
                <div className="form-group"><label>Email</label><input value={co.email || ''} onChange={setC('email')} disabled={!canEditCompany} /></div>
                <div className="form-group"><label>Registration / VAT no. (shown under contacts)</label><input value={co.taxId || ''} onChange={setC('taxId')} disabled={!canEditCompany} /></div>
                <div className="form-group"><label>Bank details for invoices</label><textarea rows={3} value={co.bankDetails || ''} onChange={setC('bankDetails')} placeholder={'Bank: …\nAccount name: …\nAccount no: …\nBranch: …'} disabled={!canEditCompany} /></div>
                <div className="grid-2">
                  <div className="form-group"><label>Invoice prefix</label><input value={co.invoicePrefix || ''} onChange={setC('invoicePrefix')} disabled={!canEditCompany} /></div>
                  <div className="form-group"><label>Accent colour (pink line)</label><input type="color" value={co.accent || '#c2467a'} onChange={setC('accent')} disabled={!canEditCompany} style={{ height: 42, padding: 2 }} /></div>
                </div>
                <div className="form-group"><label>Default invoice notes</label><textarea rows={2} value={co.invoiceNotes || ''} onChange={setC('invoiceNotes')} disabled={!canEditCompany} /></div>
                <div className="form-group"><label>Default invoice terms</label><textarea rows={2} value={co.invoiceTerms || ''} onChange={setC('invoiceTerms')} disabled={!canEditCompany} /></div>
                {canEditCompany
                  ? (<div className="toolbar" style={{ marginBottom: 0 }}>
                      <button type="submit" className="btn-save" disabled={busy} style={{ width: 'auto' }}>Save company details</button>
                      <button type="button" className="btn-secondary" onClick={resetCo}>Reset to defaults</button>
                    </div>)
                  : <p className="muted">Only managers can change company details.</p>}
              </form>
            )}
          </div>

          <div className="panel">
            <h3>Saved letters</h3>
            {letters.length === 0 && <p className="muted">No saved letters yet.</p>}
            {letters.map(l => (
              <div key={l.id} className="bar-row" style={{ justifyContent: 'space-between' }}>
                <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => openLetter(l)}>
                  <b>{l.name}</b><br /><span className="muted">{formatDate(l.date)}{l.toName ? ` · ${l.toName}` : ''}</span>
                </span>
                <button className="action-btn delete" onClick={() => removeLetter(l)}>🗑️</button>
              </div>
            ))}
          </div>
      </div>
    </div>
  );
}
