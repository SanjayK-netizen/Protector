import { useSyncExternalStore } from 'react';
import { parseHash, getHashSnapshot, getServerHashSnapshot, subscribeToHash } from './lib/routing';
import { useHistoryRecords } from './lib/history';
import { SimulationBanner } from './components/SimulationBanner';
import { AppNavigation } from './components/AppNavigation';
import { DashboardScreen } from './screens/DashboardScreen';
import { InspectScreen } from './screens/InspectScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { LimitationsScreen } from './screens/LimitationsScreen';

export default function App() {
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot, getServerHashSnapshot);
  const route = parseHash(hash);
  const history = useHistoryRecords();
  return (
    <div className="app-shell">
      <SimulationBanner />
      <div className="application-layout">
        <AppNavigation route={route} />
        <main className="main-content" id="main-content">
          {route.page === 'dashboard' && <DashboardScreen history={history} />}
          {route.page === 'inspect' && <InspectScreen />}
          {route.page === 'history' && <HistoryScreen />}
          {route.page === 'limitations' && <LimitationsScreen />}
        </main>
      </div>
    </div>
  );
}
