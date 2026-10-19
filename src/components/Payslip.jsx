import Letterhead from './Letterhead';
import { PAY_TYPES, money } from '../lib/payroll';
import { amountInWords, formatDate } from '../lib/documents';

export default function Payslip({ company, pay, emp, id }) {
  const monthLabel = new Date(pay.month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const earnings = [
    [pay.payType === 'monthly' ? 'Basic salary' : pay.payType === 'daily' ? `Daily wages (${pay.payableDays} days × ${money(pay.rate)})` : `Hourly wages (${pay.hours} hrs × ${money(pay.rate)})`, pay.basic],
    pay.otPay ? [`Overtime (${pay.otHours} hrs)`, pay.otPay] : null,
    pay.allowance ? ['Fixed allowance', pay.allowance] : null,
    pay.bonus ? ['Bonus', pay.bonus] : null,
    pay.otherEarnings ? ['Other earnings', pay.otherEarnings] : null,
  ].filter(Boolean);
  const deductions = [
    pay.epfEmployee ? [`EPF employee (${company.payroll?.epfEmployee ?? 8}%)`, pay.epfEmployee] : null,
    pay.advance ? ['Salary advance / loan recovery', pay.advance] : null,
    pay.otherDeductions ? ['Other deductions', pay.otherDeductions] : null,
  ].filter(Boolean);
  const rows = Math.max(earnings.length, deductions.length, 1);
  const c = pay.counts || {};

  return (
    <Letterhead company={company} id={id}>
      <h1 className="doc-title">PAYSLIP</h1>
      <div className="muted" style={{ marginBottom: 8 }}>Pay period: <b>{monthLabel}</b></div>

      <div className="doc-meta-grid">
        <div>
          <div className="doc-label">Employee</div>
          <div className="doc-strong">{emp.name}</div>
          <div>{emp.designation || ''}{emp.department ? ` · ${emp.department}` : ''}</div>
          {emp.nic && <div>NIC: {emp.nic}</div>}
          {emp.epfNo && <div>EPF No: {emp.epfNo}</div>}
        </div>
        <div>
          <div className="doc-label">Pay details</div>
          <div>{PAY_TYPES[pay.payType]}</div>
          <div>Days: P {c.PRESENT || 0} · Half {c.HALF_DAY || 0} · Absent {c.ABSENT || 0}</div>
          <div>Leave: {(c.CASUAL_LEAVE || 0) + (c.ANNUAL_LEAVE || 0) + (c.MEDICAL_LEAVE || 0)} paid · {c.UNPAID_LEAVE || 0} unpaid · Holidays {c.HOLIDAY || 0}</div>
          {pay.paidDate && <div>Paid on: {formatDate(pay.paidDate)}{pay.paidMethod ? ` (${pay.paidMethod})` : ''}</div>}
        </div>
      </div>

      <table className="doc-table">
        <thead><tr><th>Earnings</th><th className="num">Rs.</th><th>Deductions</th><th className="num">Rs.</th></tr></thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td>{earnings[i]?.[0] || ''}</td><td className="num">{earnings[i] ? money(earnings[i][1]) : ''}</td>
              <td>{deductions[i]?.[0] || ''}</td><td className="num">{deductions[i] ? money(deductions[i][1]) : ''}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700 }}>
            <td>Gross earnings</td><td className="num">{money(pay.gross)}</td>
            <td>Total deductions</td><td className="num">{money(pay.deductions)}</td>
          </tr>
        </tbody>
      </table>

      <div className="doc-totals"><div className="grand"><span>NET PAY</span><span>Rs. {money(pay.net)}</span></div></div>
      <div className="doc-words">{amountInWords(pay.net)}</div>

      {(pay.epfEmployer > 0 || pay.etfEmployer > 0) && (
        <div className="doc-note">
          Employer contributions (not deducted from salary): EPF {money(pay.epfEmployer)} · ETF {money(pay.etfEmployer)}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 70 }}>
        <div style={{ borderTop: '1px solid #444', paddingTop: 4, width: 200, textAlign: 'center', fontSize: 11 }}>Employer signature</div>
        <div style={{ borderTop: '1px solid #444', paddingTop: 4, width: 200, textAlign: 'center', fontSize: 11 }}>Employee signature</div>
      </div>
    </Letterhead>
  );
}
