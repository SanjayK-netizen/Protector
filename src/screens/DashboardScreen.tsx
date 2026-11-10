import type { HistoryRecord } from '../lib/history';
import { formatHash } from '../lib/routing';

interface DashboardScreenProps {
  history: HistoryRecord[];
}

export function DashboardScreen({ history }: DashboardScreenProps) {
  const inspectionCount = history.filter(record => record.record_type === 'inspect').length;

  return (
    <section className="workspace-screen dashboard-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">QRShield · Offline QR checks</p>
          <h1>Check a payment QR</h1>
          <p>Review the payment details and look for common warning signs before you pay.</p>
        </div>
        <span className="offline-pill">Processed on this device</span>
      </header>

      <section className="panel status-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Start here</p>
            <h2>Scan or paste a QR payload</h2>
          </div>
        </div>
        <p>
          QRShield checks the decoded payment information for risk patterns. It cannot confirm
          that a QR code is original or prove that a recipient is genuine.
        </p>
        <a className="primary-button" href={formatHash({ page: 'inspect' })}>Inspect a QR code</a>
      </section>

      <div className="stat-grid" aria-label="Local inspection summary">
        <article className="stat-card">
          <span>Inspections saved</span>
          <strong>{inspectionCount}</strong>
          <small>Stored in this browser only</small>
        </article>
        <article className="stat-card">
          <span>Payment verification</span>
          <strong>Not available</strong>
          <small>No bank or merchant connection</small>
        </article>
      </div>

      <section className="panel status-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Important</p>
            <h2>A clean check is not proof of authenticity</h2>
          </div>
        </div>
        <p>
          A copied QR code can contain the same details as an original. Independently confirm the
          recipient and amount with the merchant before approving a payment.
        </p>
      </section>
    </section>
  );
}
