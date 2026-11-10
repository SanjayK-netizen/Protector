import { useMemo, useState } from 'react';
import type { UserContext } from '../config';
import { evaluateRisk } from '../lib/riskRules';
import { parseUpiPayload } from '../lib/upiParser';
import { PaymentCard } from '../components/PaymentCard';
import { VerdictPanel } from '../components/VerdictPanel';
import { historyStore, type HistoryRecord } from '../lib/history';
import { CameraScanner } from '../components/CameraScanner';

const contexts: UserContext[] = ['student', 'employee', 'shop_customer', 'merchant', 'general'];

function ruleName(id: number): string {
  return [
    'Payee name mismatch',
    'Unrecognized UPI handle',
    'Look-alike of a configured payee',
    'Deceptive direction wording',
    'Unusual amount',
    'Non-UPI / URL payload',
    'Urgency wording',
  ][id - 1];
}

export function InspectScreen() {
  const [payloadText, setPayloadText] = useState('');
  const [context, setContext] = useState<UserContext>('general');
  const [savedMessage, setSavedMessage] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraScannedSuccess, setCameraScannedSuccess] = useState(false);

  const liveInspection = useMemo(() => {
    if (!payloadText.trim()) return null;
    const payload = parseUpiPayload(payloadText);
    return { payload, assessment: evaluateRisk(payload, {}, context) };
  }, [payloadText, context]);

  async function handlePasteFromClipboard() {
    try {
      setPasteError('');
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setPayloadText(text.trim());
        setSavedMessage('');
        setCameraScannedSuccess(false);
      } else {
        setPasteError('Clipboard is empty.');
      }
    } catch {
      setPasteError('Clipboard access denied. Please paste directly into the box.');
    }
  }

  function handleClear() {
    setPayloadText('');
    setSavedMessage('');
    setPasteError('');
    setCameraScannedSuccess(false);
  }

  function handleCameraScan(scannedData: string) {
    setPayloadText(scannedData);
    setSavedMessage('');
    setPasteError('');
    setCameraScannedSuccess(true);
  }

  function saveToHistory() {
    if (!liveInspection) return;
    const row: HistoryRecord = {
      participant_code: '',
      mode: 'qrshield',
      scenario_id: 'custom',
      ground_truth: '',
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
          <p className="eyebrow">Offline payload analysis</p>
          <h1>Inspect a QR payload</h1>
          <p>Scan a QR code or paste its contents to check for common risk indicators.</p>
        </div>
        {liveInspection && (
          <div className="live-eval-pill" title="Evaluating risk rules in this browser">
            <span className="live-eval-dot" />
            <span>Live analysis active</span>
          </div>
        )}
      </header>

      <CameraScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleCameraScan}
      />

      <div className="inspect-layout">
        <section className="panel inspect-controls">
          <div className="camera-action-card">
            <div className="camera-action-info">
              <h3>Scan a QR code</h3>
              <p>Camera decoding happens locally in this browser.</p>
            </div>
            <button
              type="button"
              className="primary-button camera-scan-btn"
              onClick={() => setIsScannerOpen(true)}
            >
              Open camera
            </button>
          </div>

          {cameraScannedSuccess && (
            <div className="camera-scanned-banner" role="status">
              QR code scanned successfully.
            </div>
          )}

          <h2>Payment QR contents</h2>
          <div className="payload-action-bar">
            <label className="field-label" htmlFor="payload-input">QR payload text</label>
            <div className="action-button-group">
              <button type="button" className="action-small-btn" onClick={handlePasteFromClipboard}>
                Paste
              </button>
              <button type="button" className="action-small-btn" onClick={handleClear}>
                Clear
              </button>
            </div>
          </div>
          <textarea
            id="payload-input"
            className="text-input payload-input"
            value={payloadText}
            maxLength={2000}
            placeholder="Scan, paste, or type the contents of a QR code"
            onChange={event => {
              setPayloadText(event.target.value);
              setSavedMessage('');
              setCameraScannedSuccess(false);
            }}
          />
          {pasteError && <p className="form-error" role="alert">{pasteError}</p>}

          <div className="input-meta">
            <span>{payloadText.length} / 2000 characters</span>
            <label htmlFor="context-select">Context for amount guidance</label>
          </div>
          <select
            id="context-select"
            className="text-input"
            value={context}
            onChange={event => {
              setContext(event.target.value as UserContext);
              setSavedMessage('');
            }}
          >
            {contexts.map(item => (
              <option key={item} value={item}>{item.replace('_', ' ')}</option>
            ))}
          </select>
        </section>

        <section className="panel inspection-result">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Risk indicator check</p>
              <h2>Review the payment details</h2>
            </div>
          </div>
          {!liveInspection ? (
            <p className="empty-state">Scan a QR code or enter its payload to see payment details and risk indicators.</p>
          ) : (
            <>
              <PaymentCard payload={liveInspection.payload} />
              <VerdictPanel assessment={liveInspection.assessment} />
              <section className="rule-table-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Risk indicator details</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Found: {liveInspection.assessment.triggeredRules.length} of 7
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Check</th><th>Status</th><th>Details</th></tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 7 }, (_, index) => {
                        const ruleId = index + 1;
                        const rule = liveInspection.assessment.triggeredRules.find(item => item.id === ruleId);
                        return (
                          <tr key={ruleId} className={rule ? 'selected-row' : ''}>
                            <td><strong>R{ruleId}</strong> · {ruleName(ruleId)}</td>
                            <td>
                              <span className={`rule-status-badge ${rule ? `triggered-${rule.severity}` : 'pass'}`}>
                                {rule ? 'Review' : 'No indicator'}
                              </span>
                            </td>
                            <td>{rule?.reason ?? 'No indicator found for this check.'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
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
