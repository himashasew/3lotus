// A4 sheet that matches the 3 Lotus letterhead: logo top-left, contact block top-right,
// pink + dark double rule at the bottom. Content goes in the body.
export default function Letterhead({ company, id, children }) {
  const accent = company.accent || '#c2467a';
  const dark = company.dark || '#2d2f3d';
  const lines = Array.isArray(company.addressLines) ? company.addressLines : String(company.addressLines || '').split('\n');

  return (
    <div className="doc-scale">
      <div className="doc-sheet" id={id}>
        <header className="doc-header">
          <img className="doc-logo" src="/logo.png" alt={company.name} crossOrigin="anonymous" />
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
  );
}
