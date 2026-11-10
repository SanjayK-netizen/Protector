export const LIMITATIONS = [
  {
    severity: 'critical',
    title: 'QRShield cannot determine whether a code is original or fake',
    detail: 'A copied QR can contain the same payload as an original. Without a trusted original or authoritative merchant verification source, this app cannot distinguish them.',
  },
  {
    severity: 'high',
    title: 'Risk indicators do not prove fraud',
    detail: 'A suspicious result points to patterns that need review. Independently confirm the recipient before deciding whether to pay.',
  },
  {
    severity: 'high',
    title: 'No authoritative account verification',
    detail: 'The app does not contact a bank, merchant, payment network, or trusted registry. A listed UPI handle does not validate the specific account.',
  },
  {
    severity: 'medium',
    title: 'Payee look-alike checks need trusted reference data',
    detail: 'No merchant payees are preconfigured. Look-alike checks only work when a reliable trusted-payee list is supplied.',
  },
  {
    severity: 'medium',
    title: 'Amount thresholds are placeholders',
    detail: 'Thresholds vary by context but have not been established by user research.',
  },
  {
    severity: 'low',
    title: 'QR decoding runs locally',
    detail: 'Camera video frames and uploaded images are decoded in-browser via jsQR. No payment or verification request is sent.',
  },
  {
    severity: 'low',
    title: 'History exists only in this browser',
    detail: 'Local storage can be cleared or blocked. Older research-session records are retained if already saved.',
  },
] as const;

export function LimitationsScreen() {
  return (
    <section className="workspace-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">Read before interpreting results</p>
          <h1>Limitations</h1>
          <p>QRShield reports risk patterns; it does not verify a payment destination.</p>
        </div>
      </header>
      <div className="limitations-list">
        {LIMITATIONS.map((item, index) => (
          <article className={`limitation-card severity-${item.severity}`} key={item.title}>
            <span className="limitation-number">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <span className="severity-label">{item.severity.toUpperCase()}</span>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
