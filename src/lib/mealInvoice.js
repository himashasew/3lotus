// Helpers for the daily meal invoices (e.g. Yokohama): one row per day with Breakfast and OT Meal,
// billed in 10-day periods (1-10, 11-20, 21-month end) that can start on any date.

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const addDaysIso = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return fmt(d); };
export const lastDayOfMonth = (iso) => { const d = parse(iso); return fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

/** End of the 10-day block a date falls in: day<=10 -> 10th, day<=20 -> 20th, else month end. */
export function blockEnd(iso) {
  const day = parse(iso).getDate();
  if (day <= 10) return `${iso.slice(0, 8)}10`;
  if (day <= 20) return `${iso.slice(0, 8)}20`;
  return lastDayOfMonth(iso);
}

/** Start of the 10-day block containing a date. */
export function blockStart(iso) {
  const day = parse(iso).getDate();
  return `${iso.slice(0, 8)}${day <= 10 ? '01' : day <= 20 ? '11' : '21'}`;
}

/** The period that follows a period ending on `endIso`. */
export function nextPeriod(endIso) {
  const start = addDaysIso(endIso, 1);
  return { start, end: blockEnd(start) };
}

/** The three standard periods of the month that `iso` is in. */
export function monthPresets(iso) {
  const ym = iso.slice(0, 8);
  return [
    { label: '1 – 10', start: `${ym}01`, end: `${ym}10` },
    { label: '11 – 20', start: `${ym}11`, end: `${ym}20` },
    { label: `21 – ${parse(lastDayOfMonth(iso)).getDate()}`, start: `${ym}21`, end: lastDayOfMonth(iso) },
  ];
}

/** All dates from start to end inclusive (capped at 62 days so a typo cannot create hundreds of rows). */
export function dateRange(start, end) {
  if (!start || !end || end < start) return [];
  const out = [];
  let cur = start;
  while (cur <= end && out.length < 62) { out.push(cur); cur = addDaysIso(cur, 1); }
  return out;
}

export const blankRow = (date, bRate = '', oRate = '') => ({ date, bQty: '', bRate: String(bRate ?? ''), oQty: '', oRate: String(oRate ?? '') });

/** Rows for a period, keeping anything already entered for the same date. */
export function buildRows(start, end, existing = [], bRate = '', oRate = '') {
  const byDate = new Map(existing.map((r) => [r.date, r]));
  return dateRange(start, end).map((date) => byDate.get(date) || blankRow(date, bRate, oRate));
}

export const rowAmounts = (row) => ({
  b: round2((Number(row.bQty) || 0) * (Number(row.bRate) || 0)),
  o: round2((Number(row.oQty) || 0) * (Number(row.oRate) || 0)),
});

/** Totals down the columns: quantities and amounts for each meal, plus the combined total. */
export function mealTotals(rows = []) {
  let bQty = 0; let oQty = 0; let bAmount = 0; let oAmount = 0;
  rows.forEach((r) => {
    const a = rowAmounts(r);
    bQty += Number(r.bQty) || 0;
    oQty += Number(r.oQty) || 0;
    bAmount += a.b;
    oAmount += a.o;
  });
  return { bQty, oQty, bAmount: round2(bAmount), oAmount: round2(oAmount), total: round2(bAmount + oAmount) };
}

export const periodLabel = (start, end) => {
  if (!start || !end) return '';
  const f = (iso) => parse(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${f(start)} – ${f(end)}`;
};
