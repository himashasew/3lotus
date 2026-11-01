// Alert rules for the notification centre. Pure functions: give them data, get alerts back.
// Each alert has a stable id (so "dismissed" can be remembered), a severity, and a translatable
// title/message (English text is the translation key; vars fill the {{placeholders}}).

const DAY = 86400000;
const startOfDay = (iso) => new Date(iso + 'T00:00:00').getTime();
const fmtQty = (qty, type) => {
  const q = Number(qty) || 0;
  if (type === 'mass') return q >= 1000 ? `${(q / 1000).toFixed(2)} kg` : `${q} g`;
  if (type === 'volume') return q >= 1000 ? `${(q / 1000).toFixed(2)} L` : `${q} ml`;
  return `${q} pcs`;
};
const rs = (n) => (Number(n) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const previousMonth = (todayIso) => {
  const d = new Date(todayIso + 'T00:00:00');
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Products at or below their warning level (and items that have been used up after being stocked). */
export function lowStockAlerts(products = []) {
  return products
    .filter((p) => {
      const qty = Number(p.quantity) || 0;
      const level = Number(p.reorderLevel) || 0;
      const hadStock = qty > 0 || p.hadStock === true;
      return hadStock && level > 0 && qty <= level;
    })
    .sort((a, b) => (Number(a.quantity) || 0) / (Number(a.reorderLevel) || 1) - (Number(b.quantity) || 0) / (Number(b.reorderLevel) || 1))
    .map((p) => {
      const qty = Number(p.quantity) || 0;
      const out = qty <= 0;
      return {
        id: `low-stock:${p.id}`,
        kind: 'alert',
        type: 'stock',
        severity: out ? 'danger' : 'warning',
        title: out ? 'Out of stock: {{name}}' : 'Low stock: {{name}}',
        message: out ? 'Nothing left. Warning level is {{level}}.' : 'Only {{qty}} left (warning level {{level}}).',
        vars: { name: p.name, qty: fmtQty(qty, p.measureType), level: fmtQty(p.reorderLevel, p.measureType) },
        link: '/stock',
      };
    });
}

/** Unpaid invoices that are overdue or fall due in the next 3 days. */
export function invoiceAlerts(invoices = [], todayIso) {
  const now = startOfDay(todayIso);
  const out = [];
  invoices.forEach((i) => {
    if (['paid', 'cancelled', 'draft'].includes(i.status)) return;
    const balance = Math.max(0, (Number(i.total) || 0) - (Number(i.paidAmount) || 0));
    if (balance <= 0 || !i.dueDate) return;
    const diffDays = Math.round((startOfDay(i.dueDate) - now) / DAY);
    if (diffDays < 0) {
      out.push({
        id: `invoice-overdue:${i.id}`, kind: 'alert', type: 'invoice', severity: 'danger', daysLate: -diffDays,
        title: 'Invoice overdue: {{number}}', message: '{{client}} owes Rs. {{amount}} — {{days}} day(s) overdue.',
        vars: { number: i.number, client: i.clientName, amount: rs(balance), days: -diffDays }, link: '/invoices',
      });
    } else if (diffDays <= 3) {
      out.push({
        id: `invoice-due:${i.id}`, kind: 'alert', type: 'invoice', severity: 'warning', daysLate: -diffDays,
        title: 'Invoice due soon: {{number}}', message: '{{client}} — Rs. {{amount}} due on {{date}}.',
        vars: { number: i.number, client: i.clientName, amount: rs(balance), date: i.dueDate }, link: '/invoices',
      });
    }
  });
  return out.sort((a, b) => b.daysLate - a.daysLate);
}

/** Managers: attendance not marked today, and last month's payroll still open. */
export function hrAlerts({ employees = [], attendanceToday = [], payrollPrev = [], todayIso }) {
  const active = employees.filter((e) => (e.status || 'active') === 'active');
  const out = [];
  if (active.length > 0 && attendanceToday.length === 0) {
    out.push({
      id: `attendance:${todayIso}`, kind: 'alert', type: 'attendance', severity: 'info',
      title: 'Attendance not marked today', message: 'Mark today’s attendance for {{count}} active employee(s).',
      vars: { count: active.length }, link: '/attendance',
    });
  }
  const month = previousMonth(todayIso);
  const paid = payrollPrev.filter((p) => p.status === 'paid').length;
  if (active.length > 0 && paid < active.length) {
    out.push({
      id: `payroll:${month}`, kind: 'alert', type: 'payroll', severity: 'warning',
      title: 'Payroll pending for {{month}}', message: '{{paid}} of {{total}} salaries are paid.',
      vars: { month, paid, total: active.length }, link: '/payroll',
    });
  }
  return out;
}

const SEVERITY_RANK = { danger: 0, warning: 1, info: 2 };
export const sortAlerts = (alerts) => [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

/** "3 min ago" style label, using translatable templates. */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return { key: 'Just now', vars: {} };
  if (mins < 60) return { key: '{{n}} min ago', vars: { n: mins } };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { key: '{{n}} h ago', vars: { n: hours } };
  const days = Math.floor(hours / 24);
  if (days < 7) return { key: '{{n}} d ago', vars: { n: days } };
  return { key: 'date', vars: { date: new Date(then).toISOString().slice(0, 10) } };
}
