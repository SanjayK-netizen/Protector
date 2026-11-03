import { useState } from 'react';
import knownHandlesData from './data/knownHandles.json';
import scenarios from './data/scenarios.json';
import type { UserContext } from './config';
import { evaluateRisk } from './lib/riskRules';
import type { RiskAssessment } from './lib/riskRules';
import { parseUpiPayload } from './lib/upiParser';
import type { ParsedUpiPayload } from './lib/upiParser';
import { SimulationBanner } from './components/SimulationBanner';
import { StartScreen } from './screens/StartScreen';
import { ScenarioScreen } from './screens/ScenarioScreen';
import type { ScenarioDetails } from './screens/ScenarioScreen';
import { SummaryScreen } from './screens/SummaryScreen';

export type ParticipantMode = 'baseline' | 'qrshield';

const EVALUATOR_OPTIONS = {
  knownHandles: [
    ...knownHandlesData.knownHandles,
    ...knownHandlesData.publicBankHandles,
  ],
  trustedPayees: knownHandlesData.trustedPayees,
  lookalikeMaxDistance: 2,
};

const PARTICIPANT_SCENARIOS: ScenarioDetails[] = scenarios.map(scenario => ({
  id: scenario.id,
  title: scenario.title,
  description: scenario.description,
  context: scenario.context as UserContext,
  payload: parseUpiPayload(scenario.rawPayload),
}));

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assessmentForMode(
  mode: ParticipantMode,
  payload: ParsedUpiPayload,
  context: UserContext,
  assess: typeof evaluateRisk = evaluateRisk
): RiskAssessment | undefined {
  if (mode === 'baseline') return undefined;
  return assess(payload, EVALUATOR_OPTIONS, context);
}

export default function App() {
  const [participantCode, setParticipantCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [modeOrder, setModeOrder] = useState<ParticipantMode[]>(['baseline', 'qrshield']);
  const [modes, setModes] = useState<ParticipantMode[]>([]);
  const [scenarioOrders, setScenarioOrders] = useState<Record<ParticipantMode, ScenarioDetails[]>>({
    baseline: [],
    qrshield: [],
  });
  const [modeIndex, setModeIndex] = useState(0);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [paymentShown, setPaymentShown] = useState(false);
  const [started, setStarted] = useState(false);

  const mode = modes[modeIndex];
  const currentScenario = mode ? scenarioOrders[mode][scenarioIndex] : undefined;
  const assessment = currentScenario && mode
    ? assessmentForMode(mode, currentScenario.payload, currentScenario.context)
    : undefined;

  function startStudy() {
    setScenarioOrders({
      baseline: shuffled(PARTICIPANT_SCENARIOS),
      qrshield: shuffled(PARTICIPANT_SCENARIOS),
    });
    setModes(modeOrder);
    setModeIndex(0);
    setScenarioIndex(0);
    setCompleted(0);
    setPaymentShown(false);
    setStarted(true);
  }

  function moveToNextScenario() {
    setPaymentShown(false);
    const activeScenarios = mode ? scenarioOrders[mode] : [];
    if (scenarioIndex + 1 < activeScenarios.length) {
      setScenarioIndex(index => index + 1);
      return;
    }

    if (modeIndex + 1 < modes.length) {
      setModeIndex(index => index + 1);
      setScenarioIndex(0);
      return;
    }

    setStarted(false);
  }

  function handleDecision() {
    setCompleted(count => count + 1);
    moveToNextScenario();
  }

  function handlePay() {
    setCompleted(count => count + 1);
    setPaymentShown(true);
  }

  return (
    <main className="app-shell">
      <SimulationBanner />
      {!started && completed === 0 && (
        <StartScreen
          participantCode={participantCode}
          onParticipantCodeChange={setParticipantCode}
          consent={consent}
          onConsentChange={setConsent}
          modeOrder={modeOrder}
          onModeOrderChange={setModeOrder}
          onStart={startStudy}
        />
      )}
      {started && currentScenario && mode && (
        <ScenarioScreen
          mode={mode}
          scenario={currentScenario}
          assessment={assessment}
          paymentShown={paymentShown}
          onPay={handlePay}
          onDontPay={handleDecision}
          onVerifyFirst={handleDecision}
          onContinue={moveToNextScenario}
        />
      )}
      {!started && completed > 0 && <SummaryScreen completed={completed} />}
    </main>
  );
}
