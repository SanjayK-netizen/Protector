import { PaymentCard } from './PaymentCard';
import type { ParsedUpiPayload } from '../lib/upiParser';

interface BaselineViewProps {
  payload: ParsedUpiPayload;
}

export function BaselineView({ payload }: BaselineViewProps) {
  return (
    <section className="baseline-view" aria-label="Baseline view">
      <h2>Baseline view</h2>
      <PaymentCard payload={payload} />
    </section>
  );
}
