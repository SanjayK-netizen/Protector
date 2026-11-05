import type { Verdict } from '../lib/riskRules';

interface VerdictBadgeProps {
  verdict: Verdict;
}

export function verdictLabel(verdict: Verdict): string {
  if (verdict === 'Safe') return 'SAFE';
  if (verdict === 'Check first') return 'CHECK FIRST';
  return 'RISKY';
}

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const icon = verdict === 'Safe' ? '✓' : verdict === 'Check first' ? '!' : '×';
  const tone = verdict === 'Safe' ? 'safe' : verdict === 'Check first' ? 'check-first' : 'risky';
  return (
    <span className={`verdict-badge ${tone}`} aria-label={verdictLabel(verdict)}>
      <span className="verdict-icon" aria-hidden="true">{icon}</span>
      <span>{verdictLabel(verdict)}</span>
    </span>
  );
}
