import { useMemo } from 'react';
import type { HistoryRecord } from '../lib/history';
import { summarizeScenarios } from '../lib/scenarios';
import { formatHash } from '../lib/routing';
import { VerdictBadge } from '../components/VerdictBadge';
import { verdictLabel } from '../components/VerdictBadge';

interface DashboardScreenProps {
  history: HistoryRecord[];
}

function ruleDescription(ruleId: number): string {
  const names = [
    'Payee name mismatch',
    'Unrecognized handle',
    'Trusted payee look-alike',
    'Deceptive direction wording',
    'Unusual amount',
    'Non-UPI / web link',
    'Urgency wording',
  ];
  return names[ruleId - 1];
}

export function DashboardScreen({ history }: DashboardScreenProps) {
  const summary = useMemo(() => summarizeScenarios(), []);
  const safeResults = summary.results.filter(result => result.scenario.groundTruth === 'safe');
  const inScopeRisky = summary.results.filter(
    result => result.scenario.groundTruth === 'risky' && !result.scenario.knownLimitation
  );
  const outcomeLabel = (outcome: string) => outcome === 'Match'
    ? 'Matches expected'
    : outcome === 'Known limitation' ? 'Known limitation' : 'Differs from expected';

  return (
    <section className="workspace-screen dashboard-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">QRShield · Phase 3</p>
          <h1>Research dashboard</h1>
          <p>Deterministic checks on synthetic QR and UPI payloads.</p>
        </div>
        <span className="offline-pill">Offline prototype</span>
      </header>

      <div className="stat-grid" aria-label="Scenario summary">
        <article className="stat-card"><span>Scenarios</span><strong>{summary.scenarioCount}</strong><small>{summary.safeGroundTruthCount} safe · {summary.riskyGroundTruthCount} risky ground truth</small></article>
        <article className="stat-card"><span>Risky flagged</span><strong>{summary.riskyFlagged} / {summary.riskyGroundTruthCount}</strong><small>{summary.inScopeRiskyFlagged} of {summary.inScopeRiskyCount} in-scope risky scenarios</small></article>
        <article className="stat-card"><span>Safe scenarios</span><strong>{summary.safeRiskyCount} RISKY · {summary.safeCheckFirstCount} CHECK FIRST</strong><small>Engine outcomes on safe ground truth</small></article>
        <article className="stat-card"><span>Local trials logged</span><strong>{history.filter(row => row.record_type === 'session').length}</strong><small>Local data, not validated results</small></article>
      </div>

      <section className="panel status-panel">
        <div className="panel-heading"><div><p className="eyebrow">Prototype readiness</p><h2>Phase 3 status</h2></div></div>
        <ul className="status-list">
          <li><span className="status-dot complete" /> Seven deterministic rules are implemented and covered by tests.</li>
          <li><span className="status-dot complete" /> Ten synthetic scenarios are evaluated live by the engine.</li>
          <li><span className="status-dot pending" /> Human testing has not been run; T3 remains Not run.</li>
          <li><span className="status-dot pending" /> No live camera scan or real payment verification.</li>
          <li><span className="status-dot complete" /> History is stored locally in this browser when available.</li>
        </ul>
      </section>

      <div className="dashboard-columns">
        <section className="panel coverage-panel">
          <div className="panel-heading"><div><p className="eyebrow">Measured on these 10 scenarios</p><h2>Rule coverage</h2></div></div>
          <div className="coverage-chart" role="list" aria-label="Scenario rule coverage">
            {summary.ruleCoverage.map(rule => (
              <div className="coverage-row" role="listitem" key={rule.ruleId}>
                <span className="coverage-label">R{rule.ruleId} · {ruleDescription(rule.ruleId)}</span>
                <span className="coverage-track"><span style={{ width: `${rule.count * 10}%` }} /></span>
                <strong>{rule.count}</strong>
              </div>
            ))}
          </div>
          <p className="muted-copy">Counts are scenarios triggering each rule; Rule 2 has no coverage in the current data.</p>
        </section>
        <section className="panel metric-panel">
          <div className="panel-heading"><div><p className="eyebrow">Scenario checks</p><h2>Summary</h2></div></div>
          <dl className="metric-list">
            <div><dt>In-scope risky caught</dt><dd>{inScopeRisky.filter(result => result.assessment.verdict === 'Risky').length} / {inScopeRisky.length}</dd></div>
            <div><dt>Safe-rated risky limitation</dt><dd>{summary.results.filter(result => result.scenario.knownLimitation && result.assessment.verdict === 'Safe').length}</dd></div>
            <div><dt>Safe cases rated Risky</dt><dd>{summary.safeRiskyCount}</dd></div>
            <div><dt>Safe cases rated Check first</dt><dd>{summary.safeCheckFirstCount}</dd></div>
            <div><dt>Safe cases rated Safe</dt><dd>{safeResults.filter(result => result.assessment.verdict === 'Safe').length}</dd></div>
          </dl>
        </section>
      </div>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Live evaluation</p><h2>Scenario results</h2></div>
          <span className="muted-copy">Ground truth is for researcher review.</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Scenario</th><th>Ground truth</th><th>Engine verdict</th><th>Expected verdict</th><th>Outcome</th><th /></tr></thead>
            <tbody>
              {summary.results.map(result => (
                <tr key={result.scenario.id}>
                  <td><strong>{result.scenario.id}</strong><span className="cell-secondary">{result.scenario.title}</span></td>
                  <td>{result.scenario.groundTruth}</td>
                  <td><VerdictBadge verdict={result.assessment.verdict} /></td>
                  <td>{verdictLabel(result.expectedVerdict)}</td>
                  <td>{outcomeLabel(result.outcome)}</td>
                  <td><a className="small-link" href={formatHash({ page: 'inspect', scenarioId: result.scenario.id })}>Inspect</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
