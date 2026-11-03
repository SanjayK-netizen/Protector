import type { UserContext } from '../config';
import type { ParticipantMode } from '../App';
import { PaymentCard } from '../components/PaymentCard';
import { VerdictPanel } from '../components/VerdictPanel';
import type { RiskAssessment } from '../lib/riskRules';
import type { ParsedUpiPayload } from '../lib/upiParser';

export interface ScenarioDetails {
  id: string;
  title: string;
  description: string;
  context: UserContext;
  payload: ParsedUpiPayload;
}

interface ScenarioScreenProps {
  mode: ParticipantMode;
  scenario: ScenarioDetails;
  assessment?: RiskAssessment;
  paymentShown: boolean;
  onPay: () => void;
  onDontPay: () => void;
  onVerifyFirst: () => void;
  onContinue: () => void;
}

export function ScenarioScreen({
  mode,
  scenario,
  assessment,
  paymentShown,
  onPay,
  onDontPay,
  onVerifyFirst,
  onContinue,
}: ScenarioScreenProps) {
  const isQrShield = mode === 'qrshield';

  return (
    <section className="screen scenario-screen">
      <div className="scenario-meta">
        <span className={`mode-label ${isQrShield ? 'mode-qrshield' : 'mode-baseline'}`}>
          {isQrShield ? 'QRShield mode' : 'Baseline mode'}
        </span>
        <span className="scenario-context">{scenario.context.replace('_', ' ')}</span>
      </div>
      <header className="scenario-heading">
        <p className="eyebrow">{scenario.id}</p>
        <h1>{scenario.title}</h1>
        <p>{scenario.description}</p>
      </header>

      <PaymentCard payload={scenario.payload} />

      {isQrShield && assessment && <VerdictPanel assessment={assessment} />}

      {isQrShield && (
        <label className="field-label explanation-label" htmlFor="warning-explanation">
          Explain the warning in your own words
          <textarea
            id="warning-explanation"
            className="text-input explanation-input"
            rows={3}
            placeholder="Write what you would check before deciding"
          />
        </label>
      )}

      {paymentShown ? (
        <div className="simulation-confirmation" role="status">
          <p>Simulation: no payment made</p>
          <button className="primary-button" type="button" onClick={onContinue}>
            Continue
          </button>
        </div>
      ) : (
        <div className="decision-actions" aria-label="Choose what you would do">
          <button className="pay-button" type="button" onClick={onPay}>Pay</button>
          <button className="secondary-button" type="button" onClick={onDontPay}>
            Don&apos;t pay
          </button>
          <button className="secondary-button" type="button" onClick={onVerifyFirst}>
            Verify first
          </button>
        </div>
      )}
    </section>
  );
}
