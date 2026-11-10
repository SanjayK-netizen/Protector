export const LIMITATIONS = [
  {
    severity: 'critical',
    title: 'Exact copy of a trusted payee ID is rated SAFE (SCEN-10)',
    detail: 'The engine cannot distinguish a genuine QR from an exact copy using the trusted payee’s same UPI ID. Verify the payee independently.',
  },
  { severity: 'high', title: 'Matching scammer name and UPI ID may not be detected', detail: 'A fraudulent account whose displayed name matches its own UPI ID can pass the name check.' },
  { severity: 'medium', title: 'Human testing has not been done', detail: 'T3 remains Not run. No participant outcomes or validation claims are available.' },
  { severity: 'low', title: 'Camera and image QR decoding runs strictly offline', detail: 'Camera video frames and uploaded images are decoded locally in-browser via jsQR with no server validation.' },
  { severity: 'medium', title: 'No real payment verification', detail: 'No banking API, payment rail, or real transaction is contacted.' },
  { severity: 'medium', title: 'Synthetic data only', detail: 'Scenarios and payment details are constructed test data, not live payees.' },
  { severity: 'medium', title: 'Amount limits are unvalidated placeholders', detail: 'Thresholds vary by context but have not been established by user research.' },
  { severity: 'medium', title: 'Evidence so far covers students only', detail: 'Results should not be generalized to employees, merchants, or the public.' },
  { severity: 'medium', title: 'Baseline-first order can bias results', detail: 'Trial order is selectable; counterbalancing and study design require review.' },
  { severity: 'low', title: 'History exists only in this browser', detail: 'Local storage can be cleared or blocked. Export records to retain them.' },
] as const;

export function LimitationsScreen() {
  return (
    <section className="workspace-screen">
      <header className="page-header">
        <div><p className="eyebrow">Read before interpreting results</p><h1>Limitations</h1><p>QRShield is a research prototype and does not guarantee a payment destination is safe.</p></div>
      </header>
      <div className="limitations-list">
        {LIMITATIONS.map((item, index) => (
          <article className={`limitation-card severity-${item.severity}`} key={item.title}>
            <span className="limitation-number">{String(index + 1).padStart(2, '0')}</span>
            <div><span className="severity-label">{index === 0 ? 'CRITICAL · KNOWN LIMITATION' : item.severity.toUpperCase()}</span><h2>{item.title}</h2><p>{item.detail}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}
