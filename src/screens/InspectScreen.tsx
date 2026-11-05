import { useState, useMemo } from 'react';
import type { UserContext } from '../config';
import { evaluateRisk } from '../lib/riskRules';
import { parseUpiPayload } from '../lib/upiParser';
import { SCENARIOS, scenarioById, ENGINE_OPTIONS } from '../lib/scenarios';
import { BaselineView } from '../components/BaselineView';
import { PaymentCard } from '../components/PaymentCard';
import { VerdictPanel } from '../components/VerdictPanel';
import { verdictLabel } from '../components/VerdictBadge';
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

interface SyntheticPreset {
  label: string;
  tag: 'safe' | 'check' | 'risky';
  payload: string;
  context: UserContext;
  description: string;
}

const EXTRA_PRESETS: SyntheticPreset[] = [
  {
    label: 'UPI Collect Request (Attack)',
    tag: 'risky',
    payload: 'upi://collect?pa=scammer@testbank&pn=PrizeCollector&am=5000.00&tn=Collect%20request',
    context: 'general',
    description: 'Unsupported collect scheme attempting to debit money from user.',
  },
  {
    label: 'Negative Amount (Malformed)',
    tag: 'risky',
    payload: 'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=-150.00&cu=INR&tn=Lunch',
    context: 'student',
    description: 'Negative transaction amount triggering parser error.',
  },
  {
    label: 'Fine Arts Club (Safe Note)',
    tag: 'safe',
    payload: 'upi://pay?pa=finearts@testbank&pn=Fine%20Arts%20Club&am=200.00&cu=INR&tn=Fine%20Arts%20Club%20fee',
    context: 'student',
    description: 'Verifies that words like "Fine" do not falsely trigger urgency rule.',
  },
];

export function InspectScreen({ initialScenarioId }: InspectScreenProps) {
  const initial = scenarioById(initialScenarioId) ?? SCENARIOS[0];
  const [scenarioId, setScenarioId] = useState(initial?.id ?? '');
  const [payloadText, setPayloadText] = useState(initial?.rawPayload ?? '');
  const [context, setContext] = useState<UserContext>(initial?.context ?? 'general');
  const [tab, setTab] = useState<InspectTab>('qrshield');
  const [savedMessage, setSavedMessage] = useState('');
  const [pasteError, setPasteError] = useState('');

  const selectedScenario = scenarioById(scenarioId);

  // Real-time evaluation: automatically parses and assesses whenever payloadText or context changes
  const liveInspection = useMemo(() => {
    if (!payloadText.trim()) return null;
    const payload = parseUpiPayload(payloadText);
    const assessment = evaluateRisk(payload, ENGINE_OPTIONS, context);
    return { payload, assessment };
  }, [payloadText, context]);

  function chooseScenario(id: string) {
    const scenario = scenarioById(id);
    setScenarioId(scenario?.id ?? '');
    if (scenario) {
      setPayloadText(scenario.rawPayload);
      setContext(scenario.context);
      setSavedMessage('');
      setPasteError('');
    }
  }

  function applyPreset(preset: SyntheticPreset) {
    setScenarioId('');
    setPayloadText(preset.payload);
    setContext(preset.context);
    setSavedMessage('');
    setPasteError('');
  }

  async function handlePasteFromClipboard() {
    try {
      setPasteError('');
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setPayloadText(text.trim());
        setScenarioId('');
        setSavedMessage('');
      } else {
        setPasteError('Clipboard is empty.');
      }
    } catch {
      setPasteError('Clipboard access denied. Please paste directly into the box.');
    }
  }

  function handleClear() {
    setPayloadText('');
    setScenarioId('');
    setSavedMessage('');
    setPasteError('');
  }

  function saveToHistory() {
    if (!liveInspection) return;
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
      engine_verdict: liveInspection.assessment.verdict,
      triggered_rules: liveInspection.assessment.triggeredRules.map(rule => rule.id),
      consent_given: null,
    };
    if (historyStore.append(row)) {
      setSavedMessage('Inspection saved to this browser’s local history.');
    } else {
      setSavedMessage('This inspection could not be saved.');
    }
  }

  return (
    <section className="workspace-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">Payload analysis</p>
          <h1>Inspect a QR payload</h1>
          <p>
            Paste or pick synthetic QR payloads to observe real-time rule triggers, risk badges, and recommendations.
          </p>
        </div>
        {liveInspection && (
          <div className="live-eval-pill" title="Evaluating rules in real-time">
            <span className="live-eval-dot" />
            <span>Live Analysis Active</span>
          </div>
        )}
      </header>

      <div className="inspect-layout">
        {/* Left Input Panel */}
        <section className="panel inspect-controls">
          <h2>Input & Presets</h2>

          {/* Quick-Pick Synthetic Payloads */}
          <div className="quick-picks-section">
            <span className="quick-picks-label">Pick a synthetic test scenario:</span>
            <div className="quick-picks-grid">
              {SCENARIOS.map(sc => {
                const tag = sc.groundTruth === 'safe' ? 'safe-tag' : 'risky-tag';
                const isActive = scenarioId === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    className={`quick-pick-btn ${tag} ${isActive ? 'active' : ''}`}
                    onClick={() => chooseScenario(sc.id)}
                    title={`${sc.id}: ${sc.title} (${sc.context})`}
                  >
                    <span>{sc.id}</span>
                    <span>·</span>
                    <span>{sc.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="quick-picks-section">
            <span className="quick-picks-label">Edge-case synthetic payloads:</span>
            <div className="quick-picks-grid">
              {EXTRA_PRESETS.map((ep, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`quick-pick-btn ${ep.tag === 'safe' ? 'safe-tag' : 'risky-tag'}`}
                  onClick={() => applyPreset(ep)}
                  title={ep.description}
                >
                  <span>{ep.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="field-label" htmlFor="scenario-select">
            Or select scenario by dropdown
          </label>
          <select
            id="scenario-select"
            className="text-input"
            value={scenarioId}
            onChange={event => chooseScenario(event.target.value)}
          >
            <option value="">Custom payload</option>
            {SCENARIOS.map(scenario => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.id} · {scenario.title} ({scenario.groundTruth.toUpperCase()})
              </option>
            ))}
          </select>

          <div className="payload-action-bar">
            <label className="field-label" htmlFor="payload-input">
              QR payload text
            </label>
            <div className="action-button-group">
              <button
                type="button"
                className="action-small-btn"
                onClick={handlePasteFromClipboard}
                title="Paste payload from system clipboard"
              >
                📋 Paste
              </button>
              <button
                type="button"
                className="action-small-btn"
                onClick={handleClear}
                title="Clear current text"
              >
                ✕ Clear
              </button>
            </div>
          </div>

          <textarea
            id="payload-input"
            className="text-input payload-input"
            value={payloadText}
            maxLength={2000}
            placeholder="Paste or type upi://pay?... or web link here for real-time analysis"
            onChange={event => {
              setPayloadText(event.target.value);
              if (event.target.value !== selectedScenario?.rawPayload) setScenarioId('');
              setSavedMessage('');
            }}
          />

          {pasteError && <p className="form-error">{pasteError}</p>}

          <div className="input-meta">
            <span>{payloadText.length} / 2000 characters</span>
            <label htmlFor="context-select">User type (threshold profile)</label>
          </div>

          <select
            id="context-select"
            className="text-input"
            value={context}
            onChange={event => {
              const nextContext = event.target.value as UserContext;
              setContext(nextContext);
              if (selectedScenario && nextContext !== selectedScenario.context) setScenarioId('');
              setSavedMessage('');
            }}
          >
            {contexts.map(item => (
              <option key={item} value={item}>
                {item.replace('_', ' ')}
              </option>
            ))}
          </select>
        </section>

        {/* Right Output Panel */}
        <section className="panel inspection-result">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Real-time inspection</p>
              <h2>Review details & risk badges</h2>
            </div>
          </div>

          <div className="view-tabs" role="tablist" aria-label="Inspection mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'baseline'}
              className={tab === 'baseline' ? 'selected' : ''}
              onClick={() => setTab('baseline')}
            >
              Baseline view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'qrshield'}
              className={tab === 'qrshield' ? 'selected' : ''}
              onClick={() => setTab('qrshield')}
            >
              QRShield view
            </button>
          </div>

          {!liveInspection ? (
            <p className="empty-state">
              Paste a UPI QR payload or pick any synthetic scenario above to view real-time rule triggers, risk badges, and recommendations.
            </p>
          ) : tab === 'baseline' ? (
            <BaselineView payload={liveInspection.payload} />
          ) : (
            <>
              {/* Payment details card */}
              <PaymentCard payload={liveInspection.payload} />

              {/* Real-time Verdict & Recommendations Panel */}
              <VerdictPanel assessment={liveInspection.assessment} />

              {/* Real-time Rule Results Breakdown */}
              <section className="rule-table-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Rule evaluation results</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Triggered: {liveInspection.assessment.triggeredRules.length} of 7 rules
                  </span>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Status</th>
                        <th>Explainable Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 7 }, (_, index) => {
                        const ruleId = index + 1;
                        const rule = liveInspection.assessment.triggeredRules.find(item => item.id === ruleId);
                        return (
                          <tr key={ruleId} className={rule ? 'selected-row' : ''}>
                            <td>
                              <strong>R{ruleId}</strong> · {ruleName(ruleId)}
                            </td>
                            <td>
                              {rule ? (
                                <span className={`rule-status-badge triggered-${rule.severity}`}>
                                  {rule.severity}
                                </span>
                              ) : (
                                <span className="rule-status-badge pass">Pass</span>
                              )}
                            </td>
                            <td>{rule?.reason ?? 'No indicator found for this rule.'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {selectedScenario && (
                <div className="answer-key">
                  <strong>Research answer key</strong>
                  <span>
                    Ground truth: {selectedScenario.groundTruth} · Expected:{' '}
                    {verdictLabel(
                      selectedScenario.id === 'SCEN-09'
                        ? 'Check first'
                        : selectedScenario.knownLimitation
                          ? 'Safe'
                          : selectedScenario.groundTruth === 'safe'
                            ? 'Safe'
                            : 'Risky'
                    )}{' '}
                    {selectedScenario.knownLimitation ? '(known limitation)' : ''}
                  </span>
                </div>
              )}

              {selectedScenario?.knownLimitation && (
                <div className="limitation-alert" role="alert">
                  <strong>Known critical limitation:</strong> An exact copy of a trusted payee UPI ID is rated Safe.
                  Do not treat this result as proof of legitimacy.
                </div>
              )}

              <div className="save-row">
                <button type="button" className="secondary-button" onClick={saveToHistory}>
                  Save to history
                </button>
                {savedMessage && <span role="status">{savedMessage}</span>}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
