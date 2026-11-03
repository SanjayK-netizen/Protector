import type { ParsedUpiPayload } from '../lib/upiParser';

interface PaymentCardProps {
  payload: ParsedUpiPayload;
}

function formatAmount(amount: number | undefined, currency: string | undefined): string {
  if (amount === undefined) return 'Not specified';
  return `${currency || 'INR'} ${amount.toFixed(2)}`;
}

export function PaymentCard({ payload }: PaymentCardProps) {
  if (payload.isUrl) {
    return (
      <section className="payment-card" aria-label="QR link details">
        <p className="link-warning">This QR opens a web link</p>
        <p className="link-text">{payload.raw}</p>
      </section>
    );
  }

  if (!payload.isUpi) {
    return (
      <section className="payment-card" aria-label="QR details">
        <p>This QR is not a supported UPI payment code.</p>
      </section>
    );
  }

  return (
    <section className="payment-card" aria-label="Payment details">
      <h2>Payment details</h2>
      <dl className="payment-details">
        <div>
          <dt>Payee name</dt>
          <dd>{payload.pn || 'Not provided'}</dd>
        </div>
        <div>
          <dt>UPI ID</dt>
          <dd>{payload.pa || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{formatAmount(payload.am, payload.cu)}</dd>
        </div>
        <div>
          <dt>Note</dt>
          <dd>{payload.tn || 'No note'}</dd>
        </div>
      </dl>
    </section>
  );
}
