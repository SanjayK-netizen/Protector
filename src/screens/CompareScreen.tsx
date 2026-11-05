import { useState } from 'react';
import { BaselineView } from '../components/BaselineView';
import { PaymentCard } from '../components/PaymentCard';
import { VerdictPanel } from '../components/VerdictPanel';
import { formatHash } from '../lib/routing';
import { summarizeScenarios } from '../lib/scenarios';
import { parseUpiPayload } from '../lib/upiParser';
import { VerdictBadge } from '../components/VerdictBadge';

interface CompareScreenProps {
  initialScenarioId?: string;
}

export function CompareScreen({ initialScenarioId }: CompareScreenProps) {
  const summary = summarizeScenarios();
  const [selectedId, setSelectedId] = useState(
    summary.results.some(result => result.scenario.id === initialScenarioId)
      ? initialScenarioId!
      : summary.results[0].scenario.id
  );
  const selected = summary.results.find(result => result.scenario.id === selectedId) ?? summary.results[0];

  return (
    <section className="workspace-screen">
      <header className="page-header">
        <div><p className="eyebrow">Mode comparison</p><h1>Baseline vs QRShield</h1><p>The same synthetic payload details are shown in both modes; only QRShield adds rule evaluation.</p></div>
      </header>
      <div className="trial-cards">
        <article className="trial-card"><span>T1 · Risky payments flagged</span><strong>{summary.riskyFlagged} of {summary.riskyGroundTruthCount}</strong><small>In-scope: {summary.inScopeRiskyFlagged} of {summary.inScopeRiskyCount} · Baseline: 0 by design</small></article>
        <article className="trial-card"><span>T2 · Safe payment outcomes</span><strong>{summary.safeRiskyCount} RISKY · {summary.safeCheckFirstCount} CHECK FIRST</strong><small>At most 1 Check first; measured on current scenarios.</small></article>
        <article className="trial-card"><span>T3 · Human response</span><strong>Not run</strong><small>No human testing has been conducted.</small></article>
      </div>
      <section className="panel table-panel">
        <div className="panel-heading"><div><p className="eyebrow">All controlled scenarios</p><h2>What each mode displays</h2></div></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Scenario</th><th>Baseline shows</th><th>QRShield shows</th><th /></tr></thead>
            <tbody>{summary.results.map(result => (
              <tr key={result.scenario.id} className={result.scenario.id === selectedId ? 'selected-row' : ''}>
                <td><strong>{result.scenario.id}</strong><span className="cell-secondary">{result.scenario.title}</span></td>
                <td>Payee details only; no verdict</td>
                <td><VerdictBadge verdict={result.assessment.verdict} /><span className="cell-secondary">{result.assessment.triggeredRules.length} rule(s)</span></td>
                <td><button className="small-link-button" type="button" onClick={() => {
                  setSelectedId(result.scenario.id);
                  window.location.hash = formatHash({ page: 'compare', scenarioId: result.scenario.id });
                }}>Compare</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="comparison-panel-grid" aria-label={`Side-by-side comparison for ${selected.scenario.id}`}>
        <article className="panel comparison-card">
          <div className="panel-heading"><div><p className="eyebrow">Baseline</p><h2>{selected.scenario.id} · {selected.scenario.title}</h2></div></div>
          <BaselineView payload={parseUpiPayload(selected.scenario.rawPayload)} />
          <p className="muted-copy">Payment details only. No risk verdict or warning is shown.</p>
        </article>
        <article className="panel comparison-card">
          <div className="panel-heading"><div><p className="eyebrow">QRShield</p><h2>{selected.scenario.id} · {selected.scenario.title}</h2></div></div>
          <PaymentCard payload={selected.payload} />
          <VerdictPanel assessment={selected.assessment} />
          {selected.scenario.knownLimitation && <div className="limitation-alert"><strong>Known limitation:</strong> Exact trusted-address copies are rated Safe.</div>}
        </article>
      </section>
    </section>
  );
}
