// Attendance statuses and salary calculation (Sri Lanka defaults: EPF 8% / 12%, ETF 3%).

export const STATUSES = {
  PRESENT: { label: 'Present', short: 'P', color: '#2ed573' },
  HALF_DAY: { label: 'Half day', short: 'H', color: '#ffa502' },
  ABSENT: { label: 'Absent', short: 'A', color: '#ff4757' },
  CASUAL_LEAVE: { label: 'Casual leave', short: 'CL', color: '#54a0ff', leave: true },
  ANNUAL_LEAVE: { label: 'Annual leave', short: 'AL', color: '#5f27cd', leave: true },
  MEDICAL_LEAVE: { label: 'Medical leave', short: 'ML', color: '#00d2d3', leave: true },
  UNPAID_LEAVE: { label: 'Unpaid leave', short: 'UL', color: '#8395a7' },
  HOLIDAY: { label: 'Public / company holiday', short: 'PH', color: '#ff9ff3' },
  DAY_OFF: { label: 'Weekly day off', short: 'OFF', color: '#576574' },
};

export const PAY_TYPES = {
  daily: 'Daily wage',
  monthly: 'Monthly salary',
  hourly: 'Hourly (working hours)',
};

export const DEFAULT_RATES = {
  epfEmployee: 8,
  epfEmployer: 12,
  etfEmployer: 3,
  monthDivisor: 30,
  stdHours: 8,
  otMultiplier: 1.5,
};

export const LEAVE_TYPES = ['CASUAL_LEAVE', 'ANNUAL_LEAVE', 'MEDICAL_LEAVE'];

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const money = (n) =>
  (Number(n) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const today = () => new Date().toISOString().slice(0, 10);

export const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/** Count attendance records by status and add up hours for one employee. */
export function summarise(records) {
  const counts = {};
  Object.keys(STATUSES).forEach((k) => { counts[k] = 0; });
  let hours = 0;
  let otHours = 0;
  records.forEach((r) => {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
    hours += Number(r.hours) || 0;
    otHours += Number(r.otHours) || 0;
  });
  return { counts, hours, otHours };
}

/** Leave days taken in a set of records (half days do not count as leave). */
export function leaveTaken(records) {
  const taken = { CASUAL_LEAVE: 0, ANNUAL_LEAVE: 0, MEDICAL_LEAVE: 0, UNPAID_LEAVE: 0 };
  records.forEach((r) => { if (taken[r.status] !== undefined) taken[r.status] += 1; });
  return taken;
}

/** Default hours for a status when a day is marked (hourly staff need hours). */
export function defaultHours(status, stdHours) {
  if (status === 'PRESENT') return stdHours;
  if (status === 'HALF_DAY') return stdHours / 2;
  return 0;
}

/**
 * Work out one employee's pay for a month.
 * emp: employee document; records: that employee's attendance for the month;
 * extras: { bonus, otherEarnings, advance, otherDeductions }; rates: DEFAULT_RATES shape.
 */
export function calcPay(emp, records, extras = {}, rates = DEFAULT_RATES) {
  const r = { ...DEFAULT_RATES, ...rates };
  const std = Number(emp.stdHours) || r.stdHours;
  const otMult = Number(emp.otMultiplier) || r.otMultiplier;
  const rate = Number(emp.salary) || 0;
  const payType = emp.payType || 'monthly';

  const { counts, hours, otHours } = summarise(records);
  const paidLeave = LEAVE_TYPES.reduce((s, k) => s + counts[k], 0);
  const paidHolidays = emp.paidHolidays === false ? 0 : counts.HOLIDAY;

  let basic = 0;
  let payableDays = 0;
  let unpaidDays = 0;
  let hourly = rate;

  if (payType === 'daily') {
    payableDays = counts.PRESENT + 0.5 * counts.HALF_DAY + paidLeave + paidHolidays;
    basic = payableDays * rate;
    hourly = rate / std;
  } else if (payType === 'hourly') {
    basic = hours * rate;
    payableDays = counts.PRESENT + 0.5 * counts.HALF_DAY;
    hourly = rate;
  } else {
    unpaidDays = counts.ABSENT + counts.UNPAID_LEAVE + 0.5 * counts.HALF_DAY;
    payableDays = Math.max(0, r.monthDivisor - unpaidDays);
    basic = Math.max(0, rate - (rate / r.monthDivisor) * unpaidDays);
    hourly = rate / r.monthDivisor / std;
  }

  const otPay = otHours * hourly * otMult;
  const allowance = Number(emp.allowance) || 0;
  const bonus = Number(extras.bonus) || 0;
  const otherEarnings = Number(extras.otherEarnings) || 0;
  const gross = basic + otPay + allowance + bonus + otherEarnings;

  // EPF / ETF are worked out on basic pay + fixed allowance (overtime and bonus excluded).
  const statutoryBase = basic + allowance;
  const epfEmployee = emp.epf ? statutoryBase * (r.epfEmployee / 100) : 0;
  const epfEmployer = emp.epf ? statutoryBase * (r.epfEmployer / 100) : 0;
  const etfEmployer = emp.etf ? statutoryBase * (r.etfEmployer / 100) : 0;

  const advance = Number(extras.advance) || 0;
  const otherDeductions = Number(extras.otherDeductions) || 0;
  const deductions = epfEmployee + advance + otherDeductions;
  const net = gross - deductions;

  return {
    payType,
    rate,
    counts,
    hours: round2(hours),
    otHours: round2(otHours),
    payableDays: round2(payableDays),
    unpaidDays: round2(unpaidDays),
    basic: round2(basic),
    otPay: round2(otPay),
    allowance: round2(allowance),
    bonus: round2(bonus),
    otherEarnings: round2(otherEarnings),
    gross: round2(gross),
    epfEmployee: round2(epfEmployee),
    epfEmployer: round2(epfEmployer),
    etfEmployer: round2(etfEmployer),
    advance: round2(advance),
    otherDeductions: round2(otherDeductions),
    deductions: round2(deductions),
    net: round2(net),
  };
}
