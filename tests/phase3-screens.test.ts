import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppNavigation } from '../src/components/AppNavigation';
import { BaselineView } from '../src/components/BaselineView';
import { CompareScreen } from '../src/screens/CompareScreen';
import { DashboardScreen } from '../src/screens/DashboardScreen';
import { HistoryScreen } from '../src/screens/HistoryScreen';
import { InspectScreen } from '../src/screens/InspectScreen';
import { LimitationsScreen } from '../src/screens/LimitationsScreen';
import { TestSessionScreen } from '../src/screens/TestSessionScreen';
import { parseUpiPayload } from '../src/lib/upiParser';

describe('Phase 3 screen rendering', () => {
  it('renders every screen without errors, including the history external-store server snapshot', () => {
    const elements = [
      createElement(AppNavigation, { route: { page: 'dashboard' } }),
      createElement(DashboardScreen, { history: [] }),
      createElement(InspectScreen, { initialScenarioId: 'SCEN-05' }),
      createElement(CompareScreen, { initialScenarioId: 'SCEN-10' }),
      createElement(TestSessionScreen),
      createElement(HistoryScreen),
      createElement(LimitationsScreen),
      createElement(BaselineView, { payload: parseUpiPayload('upi://pay?pa=shop@testbank&pn=Shop&am=50') }),
    ];
    for (const element of elements) {
      expect(() => renderToStaticMarkup(element)).not.toThrow();
    }
  });
});
