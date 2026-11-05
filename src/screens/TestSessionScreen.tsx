import { useEffect, useRef, useState } from 'react';
import type { ParticipantMode } from '../lib/assessment';
import { ScenarioScreen } from './ScenarioScreen';
import type { ScenarioDetails } from './ScenarioScreen';
import { StartScreen } from './StartScreen';
import { SummaryScreen } from './SummaryScreen';
import { assessmentForMode } from '../lib/assessment';
import { createSessionPlan, followedRecommendation, makeDecisionRecord } from '../lib/session';
import type { Decision, SessionPlan } from '../lib/session';
import { SCENARIOS } from '../lib/scenarios';
import { historyStore } from '../lib/history';
import { parseUpiPayload } from '../lib/upiParser';

type SessionPhase = 'start' | 'trial' | 'interstitial' | 'summary';

function scenarioDetails(scenario: SessionPlan['trialsByMode']['baseline'][number]['scenario']): ScenarioDetails {
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    context: scenario.context,
    payload: parseUpiPayload(scenario.rawPayload),
  };
}

interface TestSessionScreenProps {
  onSessionActiveChange?: (active: boolean) => void;
}

export function TestSessionScreen({ onSessionActiveChange }: TestSessionScreenProps) {
  const [phase, setPhase] = useState<SessionPhase>('start');
  const [participantCode, setParticipantCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [modeOrder, setModeOrder] = useState<ParticipantMode[]>(['baseline', 'qrshield']);
  const [plan, setPlan] = useState<SessionPlan>();
  const [modeIndex, setModeIndex] = useState(0);
  const [trialIndex, setTrialIndex] = useState(0);
  const [trialStartedAt, setTrialStartedAt] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [paymentShown, setPaymentShown] = useState(false);
  const [explanation, setExplanation] = useState('');
  const decisionRecorded = useRef(false);

  const activeMode = plan?.modeOrder[modeIndex];
  const trial = activeMode && plan ? plan.trialsByMode[activeMode][trialIndex] : undefined;
  const assessment = trial?.mode === 'qrshield'
    ? assessmentForMode('qrshield', parseUpiPayload(trial.scenario.rawPayload), trial.scenario.context)
    : undefined;

  useEffect(() => {
    if (phase === 'trial') {
      decisionRecorded.current = false;
      setTrialStartedAt(Date.now());
    }
  }, [phase, modeIndex, trialIndex]);

  function startSession() {
    if (!consent) return;
    const newPlan = createSessionPlan(participantCode, SCENARIOS, modeOrder);
    setPlan(newPlan);
    setModeIndex(0);
    setTrialIndex(0);
    setCompleted(0);
    setPaymentShown(false);
    setExplanation('');
    setPhase('trial');
    onSessionActiveChange?.(true);
  }

  function advance() {
    if (!plan || !activeMode) return;
    setPaymentShown(false);
    setExplanation('');
    if (trialIndex + 1 < plan.trialsByMode[activeMode].length) {
      setTrialIndex(index => index + 1);
      return;
    }
    if (modeIndex + 1 < plan.modeOrder.length) {
      setPhase('interstitial');
      return;
    }
    setPhase('summary');
    onSessionActiveChange?.(false);
  }

  function beginSecondMode() {
    setModeIndex(index => index + 1);
    setTrialIndex(0);
    setPhase('trial');
  }

  function endEarly() {
    setPaymentShown(false);
    setPhase('summary');
    onSessionActiveChange?.(false);
  }

  function recordDecision(decision: Decision) {
    if (!plan || !trial || decisionRecorded.current) return;
    decisionRecorded.current = true;
    const verdict = trial.mode === 'qrshield' ? assessment?.verdict : undefined;
    const record = makeDecisionRecord({
      participantCode: plan.participantCode,
      sessionId: plan.sessionId,
      mode: trial.mode,
      scenario: trial.scenario,
      decision,
      followedRecommendedCheck: followedRecommendation(verdict, decision, trial.mode),
      timeToDecisionSeconds: Math.max(0, (Date.now() - trialStartedAt) / 1000),
      explanationText: explanation,
      engineVerdict: verdict,
      triggeredRules: assessment?.triggeredRules.map(rule => rule.id),
      consentGiven: consent,
    });
    historyStore.append(record);
    setCompleted(count => count + 1);
    if (decision === 'Pay') {
      setPaymentShown(true);
    } else {
      advance();
    }
  }

  if (phase === 'start') {
    return (
      <div className="workspace-screen session-screen">
        <StartScreen
          participantCode={participantCode}
          onParticipantCodeChange={setParticipantCode}
          consent={consent}
          onConsentChange={setConsent}
          modeOrder={modeOrder}
          onModeOrderChange={setModeOrder}
          onStart={startSession}
        />
      </div>
    );
  }

  if (phase === 'interstitial') {
    const nextMode = plan?.modeOrder[modeIndex + 1];
    return (
      <section className="workspace-screen interstitial-screen" aria-labelledby="interstitial-heading">
        <p className="eyebrow">Mode transition</p>
        <h1 id="interstitial-heading">First part complete</h1>
        <p>Take a short pause. Next is {nextMode === 'baseline' ? 'Baseline' : 'QRShield'} mode, with a new random order of the same scenarios.</p>
        <button type="button" className="primary-button" onClick={beginSecondMode}>Continue to {nextMode === 'baseline' ? 'Baseline' : 'QRShield'}</button>
        <button type="button" className="text-button" onClick={endEarly}>End session early</button>
      </section>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="workspace-screen session-summary">
        <SummaryScreen completed={completed} onNewSession={() => {
          setPlan(undefined);
          setPhase('start');
          setPaymentShown(false);
          setCompleted(0);
          setConsent(false);
          setParticipantCode('');
          onSessionActiveChange?.(false);
        }} />
      </div>
    );
  }

  if (!trial || !activeMode) return null;

  return (
    <div className="workspace-screen session-screen">
      <div className="session-progress">
        <span>Trial {completed + (paymentShown ? 0 : 1)} of 20</span>
        <span>{activeMode === 'baseline' ? 'Baseline mode' : 'QRShield mode'}</span>
        <button type="button" className="text-button" onClick={endEarly}>End session early</button>
      </div>
      <ScenarioScreen
        mode={activeMode}
        scenario={scenarioDetails(trial.scenario)}
        assessment={assessment}
        paymentShown={paymentShown}
        onPay={() => recordDecision('Pay')}
        onDontPay={() => recordDecision("Don't pay")}
        onVerifyFirst={() => recordDecision('Verify first')}
        onContinue={advance}
        explanationText={explanation}
        onExplanationChange={setExplanation}
      />
    </div>
  );
}
