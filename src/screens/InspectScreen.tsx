import { useState } from 'react';
import type { UserContext } from '../config';
import { evaluateRisk } from '../lib/riskRules';
import type { RiskAssessment } from '../lib/riskRules';
import { parseUpiPayload } from '../lib/upiParser';
import type { ParsedUpiPayload } from '../lib/upiParser';
import { SCENARIOS, scenarioById } from '../lib/scenarios';
import { BaselineView } from '../components/BaselineView';
import { PaymentCard } from '../components/PaymentCard';
import { VerdictPanel } from '../components/VerdictPanel';
import { ENGINE_OPTIONS } from '../lib/scenarios';
import { historyStore, HistoryRecord } from '../lib/history';

interface InspectScreenProps {
  initialScenarioId?: string;
}

type InspectTab = 'baseline' | 'qrshield';

const contexts: UserContext[] = ['student', 'employee', 'shop_customer', 'merchant', 'general'];

function ruleName(id: number): string {
  return [
    'Payee name mismatch',
    'Unrecognized UPI handle',
    'Look-alike trusted payee',
    'Deceptive direction wording',
    'Unusual amount',
    'Non-UPI / URL payload',
    'Urgency wording',
  ][id - 1];
}

export function InspectScreen({ initialScenarioId }: InspectScreenProps) {
  const initial = scenarioById(initialScenarioId) ?? SCENARIOS[0];
  const [scenarioId, setScenarioId] = useState(initial?.id ?? '');
  const [payloadText, setPayloadText] = useState(initial?.rawPayload ?? '');
  const [context, setContext] = useState<UserContext>(initial?.context ?? 'general');
  const [tab, setTab] = useState<InspectTab>('qrshield');
  const [inspected, setInspected] = useState<{ payload: ParsedUpiPayload; assessment: RiskAssessment }>();
  const [savedMessage, setSavedMessage] = useState('');
  const selectedScenario = scenarioById(scenarioId);

  function chooseScenario(id: string) {
    const scenario = scenarioById(id);
    setScenarioId(scenario?.id ?? '');
    if (scenario) {
      setPayloadText(scenario.rawPayload);
      setContext(scenario.context);
      setInspected(undefined);
      setSavedMessage('');
    }
  }

  function inspectPayload() {
    const payload = parseUpiPayload(payloadText);
    const assessment = evaluateRisk(payload, ENGINE_OPTIONS, context);
    setInspected({ payload, assessment });
    setTab('qrshield');
    setSavedMessage('');
  }

  function saveToHistory() {
    if (!inspected) return;
    const row: HistoryRecord = {
      participant_code: '',
      mode: 'qrshield',
      scenario_id: selectedScenario?.id ?? 'custom',
      ground_truth: selectedScenario?.groundTruth ?? '',
      decision: '',
      decision_correct: '',
      followed_recommended_check: null,
      time_to_decision_seconds: '',
      explanation_text: '',
      record_type: 'inspect',
      session_id: '',
      timestamp: new Date().toISOString(),
      context,
      engine_verdict: inspected.assessment.verdict,
      triggered_rules: inspected.assessment.triggeredRules.map(rule => rule.id),
    };
    if (historyStore.append(row)) setSavedMessage('Inspection saved to this browser’s local history.');
    else setSavedMessage('This inspection could not be saved.');
  }

  return (
    <section className="workspace-screen">
      <header className="page-header">
        <div><p className="eyebrow">Payload analysis</p><h1>Inspect a QR payload</h1><p>No camera scanning is available. Use synthetic payload text only.</p></div>
      </header>
      <div className="inspect-layout">
        <section className="panel inspect-controls">
          <h2>Input</h2>
          <label className="field-label" htmlFor="scenario-select">Scenario</label>
          <select id="scenario-select" className="text-input" value={scenarioId} onChange={event => chooseScenario(event.target.value)}>
            <option value="">Custom payload</option>
            {SCENARIOS.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.id} · {scenario.title}</option>)}
          </select>
          <label className="field-label" htmlFor="payload-input">QR payload text</label>
          <textarea
            id="payload-input"
            className="text-input payload-input"
            value={payloadText}
            maxLength={2000}
            onChange={event => {
              setPayloadText(event.target.value);
              if (event.target.value !== selectedScenario?.rawPayload) setScenarioId('');
              setInspected(undefined);
            }}
          />
          <div className="input-meta"><span>{payloadText.length} / 2000 characters</span><label htmlFor="context-select">User type</label></div>
          <select id="context-select" className="text-input" value={context} onChange={event => setContext(event.target.value as UserContext)}>
            {contexts.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
          </select>
          <button type="button" className="primary-button" onClick={inspectPayload} disabled={!payloadText.trim()}>
            Inspect payload
          </button>
        </section>

        <section className="panel inspection-result">
          <div className="panel-heading"><div><p className="eyebrow">Inspection result</p><h2>Review details</h2></div></div>
          <div className="view-tabs" role="tablist" aria-label="Inspection mode">
            <button type="button" role="tab" aria-selected={tab === 'baseline'} className={tab === 'baseline' ? 'selected' : ''} onClick={() => setTab('baseline')}>Baseline view</button>
            <button type="button" role="tab" aria-selected={tab === 'qrshield'} className={tab === 'qrshield' ? 'selected' : ''} onClick={() => setTab('qrshield')}>QRShield view</button>
          </div>
          {!inspected ? (
            <p className="empty-state">Choose a scenario or enter payload text, then select Inspect payload.</p>
          ) : tab === 'baseline' ? (
            <BaselineView payload={inspected.payload} />
          ) : (
            <>
              <PaymentCard payload={inspected.payload} />
              <VerdictPanel assessment={inspected.assessment} />
              <section className="rule-table-section">
                <h3>Rule results</h3>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Rule</th><th>Result</th><th>Reason</th></tr></thead>
                    <tbody>
                      {Array.from({ length: 7 }, (_, index) => {
                        const ruleId = index + 1;
                        const rule = inspected.assessment.triggeredRules.find(item => item.id === ruleId);
                        return <tr key={ruleId}><td>R{ruleId} · {ruleName(ruleId)}</td><td>{rule ? rule.severity : 'Not triggered'}</td><td>{rule?.reason ?? 'No indicator found for this rule.'}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              {selectedScenario && (
                <div className="answer-key">
                  <strong>Research answer key</strong>
                  <span>Ground truth: {selectedScenario.groundTruth} · Expected: {selectedScenario.id === 'SCEN-09' ? 'Check first' : selectedScenario.knownLimitation ? 'Safe (known limitation)' : selectedScenario.groundTruth === 'safe' ? 'Safe' : 'Risky'}</span>
                </div>
              )}
              {selectedScenario?.knownLimitation && (
                <div className="limitation-alert" role="alert">
                  <strong>Known critical limitation:</strong> An exact copy of a trusted payee UPI ID is rated Safe. Do not treat this result as proof of legitimacy.
                </div>
              )}
            </>
          )}
          {inspected && (
            <div className="save-row">
              <button type="button" className="secondary-button" onClick={saveToHistory}>Save to history</button>
              {savedMessage && <span role="status">{savedMessage}</span>}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
