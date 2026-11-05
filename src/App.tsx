import { useSyncExternalStore } from 'react';
import { useState } from 'react';
import { assessmentForMode } from './lib/assessment';
import type { ParticipantMode as Mode } from './lib/assessment';
import { parseHash, getHashSnapshot, getServerHashSnapshot, subscribeToHash } from './lib/routing';
import { useHistoryRecords } from './lib/history';
import { SimulationBanner } from './components/SimulationBanner';
import { AppNavigation } from './components/AppNavigation';
import { DashboardScreen } from './screens/DashboardScreen';
import { InspectScreen } from './screens/InspectScreen';
import { CompareScreen } from './screens/CompareScreen';
import { TestSessionScreen } from './screens/TestSessionScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { LimitationsScreen } from './screens/LimitationsScreen';

export type ParticipantMode = Mode;
export { assessmentForMode };

export default function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot, getServerHashSnapshot);
  const route = parseHash(hash);
  const history = useHistoryRecords();
  return (
    <div className="app-shell">
      <SimulationBanner />
      <div className="application-layout">
        {!sessionActive && <AppNavigation route={route} />}
        <main className="main-content" id="main-content">
          {route.page === 'dashboard' && <DashboardScreen history={history} />}
          {route.page === 'inspect' && <InspectScreen key={route.scenarioId ?? 'custom'} initialScenarioId={route.scenarioId} />}
          {route.page === 'compare' && <CompareScreen key={route.scenarioId ?? 'default'} initialScenarioId={route.scenarioId} />}
          {route.page === 'session' && <TestSessionScreen onSessionActiveChange={setSessionActive} />}
          {route.page === 'history' && <HistoryScreen />}
          {route.page === 'limitations' && <LimitationsScreen />}
        </main>
      </div>
    </div>
  );
}
