import { useRef, useState, useLayoutEffect } from 'react';

const SHEET_WIDTH = 794; // A4 at 96dpi

// A4 sheet that matches the 3 Lotus letterhead: logo top-left, contact block top-right,
// pink + dark double rule at the bottom. Content goes in the body.
// On narrow screens the whole sheet is scaled down to fit (print and PDF always use full size).
export default function Letterhead({ company, id, children }) {
  const accent = company.accent || '#c2467a';
  const dark = company.dark || '#2d2f3d';
  const lines = Array.isArray(company.addressLines) ? company.addressLines : String(company.addressLines || '').split('\n');

  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setZoom(Math.min(1, Math.max(0.3, (el.clientWidth - 2) / SHEET_WIDTH)));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="doc-scale" ref={wrapRef}>
      <div className="doc-fit" data-doc-fit style={{ zoom }}>
        <div className="doc-sheet" id={id}>
          <header className="doc-header">
            <div className="doc-logo-box">
              <img className="doc-logo" src="/logo.png" alt={company.name} crossOrigin="anonymous" />
            </div>
            <div className="doc-contact">
              {lines.filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
              {company.phone && <div>Tel: {company.phone}</div>}
              {company.email && <div>Email: {company.email}</div>}
              {company.taxId && <div>{company.taxId}</div>}
            </div>
          </header>

          <main className="doc-body">{children}</main>

          <footer className="doc-footer">
            <div style={{ height: 2, background: accent }} />
            <div style={{ height: 2, background: dark, marginTop: 3 }} />
          </footer>
        </div>
      </div>
    </div>
  );
}
