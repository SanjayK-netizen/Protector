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
  const visibleRoute = sessionActive ? { page: 'session' as const } : route;
  const history = useHistoryRecords();
  return (
    <div className="app-shell">
      <SimulationBanner />
      <div className="application-layout">
        {!sessionActive && <AppNavigation route={route} />}
        <main className="main-content" id="main-content">
          {visibleRoute.page === 'dashboard' && <DashboardScreen history={history} />}
          {visibleRoute.page === 'inspect' && <InspectScreen key={visibleRoute.scenarioId ?? 'custom'} initialScenarioId={visibleRoute.scenarioId} />}
          {visibleRoute.page === 'compare' && <CompareScreen key={visibleRoute.scenarioId ?? 'default'} initialScenarioId={visibleRoute.scenarioId} />}
          {visibleRoute.page === 'session' && <TestSessionScreen onSessionActiveChange={setSessionActive} />}
          {visibleRoute.page === 'history' && <HistoryScreen />}
          {visibleRoute.page === 'limitations' && <LimitationsScreen />}
        </main>
      </div>
    </div>
  );
}
