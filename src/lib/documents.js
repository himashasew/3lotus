// Print / PDF helpers for A4 documents (invoices, payslips, letters).

export const COMPANY_DEFAULTS = {
  name: '3 Lotus Family Restaurant',
  addressLines: ['229/3 Mahena Road,', 'Siyabalape,', 'Biyagama'],
  phone: '+94 75 636 1514 / +94 76 890 4113',
  email: '3lotusfoods@gmail.com',
  taxId: '',
  bankDetails: '',
  invoicePrefix: 'INV',
  invoiceNotes: 'Thank you for choosing 3 Lotus Family Restaurant.',
  invoiceTerms: 'Payment is due by the due date shown. Please quote the invoice number when paying.',
  accent: '#c2467a',
  dark: '#2d2f3d',
  payroll: {},
};

/** Print just the element with this id, using the browser's print dialog (can "Save as PDF"). */
export function printElementById(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'print-root';
  wrapper.appendChild(el.cloneNode(true));
  document.body.appendChild(wrapper);
  document.body.classList.add('printing-document');
  const cleanup = () => {
    document.body.classList.remove('printing-document');
    wrapper.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Let the clone paint before the dialog opens.
  setTimeout(() => window.print(), 50);
}

/** Run fn with every fit-to-screen zoom around/inside el reset to 100%, so captures are true A4 size. */
async function atFullSize(el, fn) {
  const fits = new Set(el.querySelectorAll('[data-doc-fit]'));
  const own = el.closest('[data-doc-fit]');
  if (own) fits.add(own);
  const saved = [...fits].map((f) => [f, f.style.zoom]);
  fits.forEach((f) => { f.style.zoom = '1'; });
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    return await fn();
  } finally {
    saved.forEach(([f, z]) => { f.style.zoom = z; });
  }
}

/** Download an element as a multi-page A4 PDF. Libraries load on demand. */
export async function downloadElementAsPdf(id, filename) {
  const el = document.getElementById(id);
  if (!el) return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  await atFullSize(el, () => renderPdf(el, filename, html2canvas, jsPDF));
}

async function renderPdf(el, filename, html2canvas, jsPDF) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  let first = true;

  // One or more .doc-sheet elements; each starts on a new page.
  const sheets = el.classList.contains('doc-sheet') ? [el] : [...el.querySelectorAll('.doc-sheet')];
  for (const sheet of sheets.length ? sheets : [el]) {
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const imgH = (canvas.height * pageW) / canvas.width;
    if (!first) pdf.addPage();
    first = false;

    if (imgH <= pageH + 0.5) {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, imgH);
      continue;
    }
    // Slice a tall sheet into A4 pages.
    const pxPerPage = Math.floor((canvas.width * pageH) / pageW);
    for (let offset = 0, firstSlice = true; offset < canvas.height; offset += pxPerPage) {
      const sliceH = Math.min(pxPerPage, canvas.height - offset);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d').drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (!firstSlice) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, (sliceH * pageW) / canvas.width);
      firstSlice = false;
    }
  }
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n) {
  let s = '';
  if (n >= 100) { s += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100; }
  if (n >= 20) { s += `${TENS[Math.floor(n / 10)]} `; n %= 10; }
  if (n > 0) s += `${ONES[n]} `;
  return s;
}

/** 125500.5 -> "One Hundred Twenty Five Thousand Five Hundred Rupees and Fifty Cents Only" */
export function amountInWords(amount) {
  const total = Math.round((Number(amount) || 0) * 100);
  let rupees = Math.floor(total / 100);
  const cents = total % 100;
  if (rupees === 0 && cents === 0) return 'Zero Rupees Only';
  let words = '';
  const units = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']];
  for (const [value, name] of units) {
    if (rupees >= value) { words += `${below1000(Math.floor(rupees / value))}${name} `; rupees %= value; }
  }
  words += below1000(rupees);
  words = words.trim();
  let out = words ? `${words} Rupees` : '';
  if (cents) out += `${out ? ' and ' : ''}${below1000(cents).trim()} Cents`;
  return `${out} Only`;
}
