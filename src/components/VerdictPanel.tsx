import type { RiskAssessment } from '../lib/riskRules';
import { VerdictBadge } from './VerdictBadge';

interface VerdictPanelProps {
  assessment: RiskAssessment;
}

function verdictClass(verdict: RiskAssessment['verdict']): string {
  if (verdict === 'Safe') return 'verdict-safe';
  if (verdict === 'Risky') return 'verdict-risky';
  return 'verdict-check';
}

export function VerdictPanel({ assessment }: VerdictPanelProps) {
  return (
    <section
      className={`verdict-panel ${verdictClass(assessment.verdict)}`}
      aria-labelledby="verdict-heading"
      aria-live="polite"
    >
      <h2 id="verdict-heading">
        QRShield check: <VerdictBadge verdict={assessment.verdict} />
      </h2>
      <div className="verdict-reasons">
        <h3>What we found</h3>
        {assessment.triggeredRules.length > 0 ? (
          <ul>
            {assessment.triggeredRules.map((rule, index) => (
              <li key={`${rule.code}-${index}`}>{rule.reason}</li>
            ))}
          </ul>
        ) : (
          <p>No warning indicators were found in this check.</p>
        )}
      </div>
      <p className="recommended-check">
        <strong>Recommended check:</strong> {assessment.recommendedCheck}
      </p>
      <p className="muted-copy">
        This result is a risk-pattern check only. It cannot confirm that a QR code is original or prove that it is fake.
      </p>
    </section>
  );
}
