import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, db } from '../services/data';
import { PAY_TYPES, money } from '../lib/payroll';

const EMPTY = {
  name: '', nic: '', phone: '', address: '', dob: '', gender: '', emergencyName: '', emergencyPhone: '',
  designation: '', department: '', status: 'active', joinDate: '',
  payType: 'monthly', salary: '', stdHours: '8', otMultiplier: '1.5', allowance: '',
  paidHolidays: true, epf: false, etf: false, epfNo: '', bankName: '', bankAccount: '',
  annualLeave: '14', casualLeave: '7', medicalLeave: '21', notes: '',
};

const rateLabel = (payType) =>
  payType === 'daily' ? 'Daily wage (Rs. per day)' : payType === 'hourly' ? 'Hourly rate (Rs. per hour)' : 'Monthly salary (Rs.)';

export default function Employees() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    const snap = await getDocs(collection(db, 'employees'));
    setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const openAdd = () => { setEditId(null); setForm({ ...EMPTY, joinDate: new Date().toISOString().slice(0, 10) }); setError(''); setShowModal(true); };
  const openEdit = (e) => {
    setEditId(e.id);
    const next = { ...EMPTY };
    Object.keys(EMPTY).forEach(k => { if (e[k] !== undefined && e[k] !== null) next[k] = typeof EMPTY[k] === 'string' ? String(e[k]) : e[k]; });
    setForm(next);
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        salary: Number(form.salary) || 0,
        stdHours: Number(form.stdHours) || 8,
        otMultiplier: Number(form.otMultiplier) || 1.5,
        allowance: Number(form.allowance) || 0,
        annualLeave: Number(form.annualLeave) || 0,
        casualLeave: Number(form.casualLeave) || 0,
        medicalLeave: Number(form.medicalLeave) || 0,
      };
      if (editId) {
        await updateDoc(doc(db, 'employees', editId), data);
      } else {
        await addDoc(collection(db, 'employees'), { ...data, createdAt: new Date().toISOString() });
      }
      setShowModal(false);
      loadEmployees();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'employees', id));
      loadEmployees();
    }
  };

  const filtered = employees.filter(e =>
    (statusFilter === 'all' || (e.status || 'active') === statusFilter) &&
    [e.name, e.nic, e.phone, e.designation].some(v => (v || '').toLowerCase().includes(search.toLowerCase())));

  const active = employees.filter(e => (e.status || 'active') === 'active');

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('employees')}</h1>

      <div className="dashboard-grid">
        <div className="stat-card clients"><div className="stat-info"><h3>Active staff</h3><div className="stat-value">{active.length}</div></div><div className="stat-icon">👥</div></div>
        <div className="stat-card orders"><div className="stat-info"><h3>Daily / Hourly</h3><div className="stat-value">{active.filter(e => e.payType === 'daily' || e.payType === 'hourly').length}</div></div><div className="stat-icon">🗓️</div></div>
        <div className="stat-card revenue"><div className="stat-info"><h3>Monthly salaried</h3><div className="stat-value">{active.filter(e => (e.payType || 'monthly') === 'monthly').length}</div></div><div className="stat-icon">💼</div></div>
      </div>

      <div className="data-section">
        <div className="data-section-header">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder="Search name, NIC, phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <button className="btn-add" onClick={openAdd}>+ {t('addEmployee')}</button>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('employeeName')}</th>
                  <th>{t('phone')}</th>
                  <th>Pay basis</th>
                  <th>Rate (Rs.)</th>
                  <th>EPF / ETF</th>
                  <th>{t('joinDate')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} style={{ opacity: (emp.status || 'active') === 'active' ? 1 : 0.55 }}>
                    <td>
                      <div className="doc-strong">{emp.name}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>{emp.designation || emp.role}{emp.nic ? ` · ${emp.nic}` : ''}</div>
                    </td>
                    <td>{emp.phone}</td>
                    <td><span className="status-badge completed">{PAY_TYPES[emp.payType || 'monthly']}</span></td>
                    <td>{money(emp.salary)}</td>
                    <td>{emp.epf ? 'EPF ' : ''}{emp.etf ? 'ETF' : ''}{!emp.epf && !emp.etf ? <span className="muted">—</span> : null}</td>
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
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>{t('noEmployees')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <h2>{editId ? t('editEmployee') : t('addEmployee')}</h2>
            {error && <div className="msg-error">{error}</div>}
            <form onSubmit={handleSave}>
              <h3 className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', margin: '0.5rem 0' }}>Personal details</h3>
              <div className="grid-2">
                <div className="form-group"><label>{t('employeeName')}</label><input value={form.name} onChange={set('name')} required /></div>
                <div className="form-group"><label>NIC / ID number</label><input value={form.nic} onChange={set('nic')} /></div>
                <div className="form-group"><label>{t('phone')}</label><input value={form.phone} onChange={set('phone')} /></div>
                <div className="form-group"><label>Date of birth</label><input type="date" value={form.dob} onChange={set('dob')} /></div>
                <div className="form-group"><label>Gender</label>
                  <select value={form.gender} onChange={set('gender')}>
                    <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div className="form-group"><label>{t('address')}</label><input value={form.address} onChange={set('address')} /></div>
                <div className="form-group"><label>Emergency contact name</label><input value={form.emergencyName} onChange={set('emergencyName')} /></div>
                <div className="form-group"><label>Emergency contact phone</label><input value={form.emergencyPhone} onChange={set('emergencyPhone')} /></div>
              </div>

              <h3 className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', margin: '0.75rem 0 0.5rem' }}>Job</h3>
              <div className="grid-2">
                <div className="form-group"><label>Designation (e.g. Cook, Waiter)</label><input value={form.designation} onChange={set('designation')} /></div>
                <div className="form-group"><label>Department</label><input value={form.department} onChange={set('department')} placeholder="Kitchen, Service, Delivery…" /></div>
                <div className="form-group"><label>{t('joinDate')}</label><input type="date" value={form.joinDate} onChange={set('joinDate')} /></div>
                <div className="form-group"><label>Status</label>
                  <select value={form.status} onChange={set('status')}>
                    <option value="active">Active</option><option value="inactive">Inactive / left</option>
                  </select>
                </div>
              </div>

              <h3 className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', margin: '0.75rem 0 0.5rem' }}>Pay</h3>
              <div className="grid-2">
                <div className="form-group"><label>Pay basis</label>
                  <select value={form.payType} onChange={set('payType')}>
                    {Object.entries(PAY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>{rateLabel(form.payType)}</label><input type="number" min="0" step="any" value={form.salary} onChange={set('salary')} required /></div>
                <div className="form-group"><label>Fixed monthly allowance (Rs.)</label><input type="number" min="0" step="any" value={form.allowance} onChange={set('allowance')} /></div>
                <div className="form-group"><label>Standard hours per day</label><input type="number" min="1" step="any" value={form.stdHours} onChange={set('stdHours')} /></div>
                <div className="form-group"><label>Overtime multiplier (× hourly rate)</label><input type="number" min="1" step="any" value={form.otMultiplier} onChange={set('otMultiplier')} /></div>
                <div className="form-group"><label>EPF member no.</label><input value={form.epfNo} onChange={set('epfNo')} /></div>
              </div>
              <div className="toolbar">
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}><input type="checkbox" checked={form.epf} onChange={set('epf')} style={{ width: 'auto' }} /> EPF applies</label>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}><input type="checkbox" checked={form.etf} onChange={set('etf')} style={{ width: 'auto' }} /> ETF applies</label>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}><input type="checkbox" checked={form.paidHolidays} onChange={set('paidHolidays')} style={{ width: 'auto' }} /> Public holidays are paid</label>
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Bank name</label><input value={form.bankName} onChange={set('bankName')} /></div>
                <div className="form-group"><label>Bank account no.</label><input value={form.bankAccount} onChange={set('bankAccount')} /></div>
              </div>

              <h3 className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', margin: '0.75rem 0 0.5rem' }}>Yearly leave entitlement (days)</h3>
              <div className="grid-3">
                <div className="form-group"><label>Annual</label><input type="number" min="0" value={form.annualLeave} onChange={set('annualLeave')} /></div>
                <div className="form-group"><label>Casual</label><input type="number" min="0" value={form.casualLeave} onChange={set('casualLeave')} /></div>
                <div className="form-group"><label>Medical</label><input type="number" min="0" value={form.medicalLeave} onChange={set('medicalLeave')} /></div>
              </div>

              <div className="form-group"><label>Notes</label><input value={form.notes} onChange={set('notes')} /></div>

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
