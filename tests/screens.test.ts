import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppNavigation } from '../src/components/AppNavigation';
import { DashboardScreen } from '../src/screens/DashboardScreen';
import { HistoryScreen } from '../src/screens/HistoryScreen';
import { InspectScreen } from '../src/screens/InspectScreen';
import { LimitationsScreen } from '../src/screens/LimitationsScreen';
import { VerdictPanel } from '../src/components/VerdictPanel';
import { evaluateRisk } from '../src/lib/riskRules';
import { parseUpiPayload } from '../src/lib/upiParser';

describe('QRShield screens', () => {
  it('renders the active app screens', () => {
    const elements = [
      createElement(AppNavigation, { route: { page: 'dashboard' } }),
      createElement(DashboardScreen, { history: [] }),
      createElement(InspectScreen),
      createElement(HistoryScreen),
      createElement(LimitationsScreen),
    ];
    for (const element of elements) {
      expect(() => renderToStaticMarkup(element)).not.toThrow();
    }
  });

  it('does not expose the removed synthetic scenario or study-session flows', () => {
    const nav = renderToStaticMarkup(createElement(AppNavigation, { route: { page: 'dashboard' } }));
    const dashboard = renderToStaticMarkup(createElement(DashboardScreen, { history: [] }));
    const inspect = renderToStaticMarkup(createElement(InspectScreen));

    expect(nav).not.toContain('Test session');
    expect(nav).not.toContain('Compare modes');
    expect(dashboard).not.toContain('Scenario');
    expect(inspect).not.toContain('synthetic');
    expect(inspect).not.toContain('Pick a scenario');
  });

  it('labels clean results as unverified and explains the authenticity limit', () => {
    const assessment = evaluateRisk(
      parseUpiPayload('upi://pay?pa=merchant@oksbi&pn=Merchant&am=50'),
      {},
      'general'
    );
    const markup = renderToStaticMarkup(createElement(VerdictPanel, { assessment }));

    expect(markup).toContain('NO INDICATORS FOUND');
    expect(markup).not.toContain('SAFE');
    expect(markup).toContain('cannot confirm that a QR code is original');
  });
});
