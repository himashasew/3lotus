import Letterhead from './Letterhead';
import { money } from '../lib/payroll';
import { amountInWords, formatDate } from '../lib/documents';

export const invoiceTotals = (inv) => {
  const items = inv.items || [];
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const d = Number(inv.discount) || 0;
  const discountAmount = inv.discountType === 'percent' ? (subtotal * d) / 100 : d;
  const taxable = Math.max(0, subtotal - discountAmount);
  const tax = (taxable * (Number(inv.taxPercent) || 0)) / 100;
  const total = taxable + tax;
  const r = (n) => Math.round(n * 100) / 100;
  return { subtotal: r(subtotal), discountAmount: r(discountAmount), tax: r(tax), total: r(total) };
};

export default function InvoiceDocument({ company, invoice, id }) {
  const t = invoiceTotals(invoice);
  const paid = Number(invoice.paidAmount) || 0;
  const balance = Math.max(0, t.total - paid);
  const isPaid = invoice.status === 'paid' || (t.total > 0 && balance <= 0);
  const accent = company.accent || '#c2467a';

  return (
    <Letterhead company={company} id={id}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="doc-title" style={{ color: accent }}>{Number(invoice.taxPercent) > 0 ? 'TAX INVOICE' : 'INVOICE'}</h1>
          <div className="muted">{invoice.number}</div>
        </div>
        {isPaid && <div className="doc-stamp" style={{ color: '#1f9d55', borderColor: '#1f9d55' }}>PAID</div>}
        {invoice.status === 'cancelled' && <div className="doc-stamp" style={{ color: '#b00020', borderColor: '#b00020' }}>CANCELLED</div>}
      </div>

      <div className="doc-meta-grid">
        <div>
          <div className="doc-label">Bill to</div>
          <div className="doc-strong">{invoice.clientName || '—'}</div>
          {invoice.clientContact && <div>{invoice.clientContact}</div>}
          {invoice.clientAddress && <div style={{ whiteSpace: 'pre-line' }}>{invoice.clientAddress}</div>}
          {invoice.clientPhone && <div>Tel: {invoice.clientPhone}</div>}
          {invoice.clientEmail && <div>{invoice.clientEmail}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span className="doc-label">Invoice date </span><span className="doc-strong">{formatDate(invoice.date)}</span></div>
          {invoice.dueDate && <div><span className="doc-label">Due date </span><span className="doc-strong">{formatDate(invoice.dueDate)}</span></div>}
          {invoice.reference && <div><span className="doc-label">Reference </span><span className="doc-strong">{invoice.reference}</span></div>}
        </div>
      </div>

      <table className="doc-table">
        <thead>
          <tr><th style={{ width: 30 }}>#</th><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Amount (Rs.)</th></tr>
        </thead>
        <tbody>
          {(invoice.items || []).map((it, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td style={{ whiteSpace: 'pre-line' }}>{it.description}</td>
              <td className="num">{Number(it.qty) || 0}{it.unit ? ` ${it.unit}` : ''}</td>
              <td className="num">{money(it.price)}</td>
              <td className="num">{money((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="doc-totals">
        <div><span>Subtotal</span><span>{money(t.subtotal)}</span></div>
        {t.discountAmount > 0 && <div><span>Discount{invoice.discountType === 'percent' ? ` (${invoice.discount}%)` : ''}</span><span>− {money(t.discountAmount)}</span></div>}
        {Number(invoice.taxPercent) > 0 && <div><span>VAT / tax ({invoice.taxPercent}%)</span><span>{money(t.tax)}</span></div>}
        <div className="grand" style={{ background: accent }}><span>TOTAL</span><span>Rs. {money(t.total)}</span></div>
        {paid > 0 && <div><span>Paid</span><span>− {money(paid)}</span></div>}
        {paid > 0 && <div className="doc-strong"><span>Balance due</span><span>Rs. {money(balance)}</span></div>}
      </div>
      <div className="doc-words">{amountInWords(t.total)}</div>

      {company.bankDetails && (
        <div className="doc-note"><b>Payment details</b>{'\n'}{company.bankDetails}</div>
      )}
      {invoice.notes && <div className="doc-note"><b>Notes</b>{'\n'}{invoice.notes}</div>}
      {invoice.terms && <div className="doc-note"><b>Terms</b>{'\n'}{invoice.terms}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 60 }}>
        <div style={{ borderTop: '1px solid #444', paddingTop: 4, width: 210, textAlign: 'center', fontSize: 11 }}>Authorized signature</div>
      </div>
    </Letterhead>
  );
}
