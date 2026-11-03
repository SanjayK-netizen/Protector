import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { assessmentForMode } from '../src/App';
import { parseUpiPayload } from '../src/lib/upiParser';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaymentCard } from '../src/components/PaymentCard';
import { ScenarioScreen } from '../src/screens/ScenarioScreen';

describe('Baseline mode privacy boundary', () => {
  it('does not call the risk evaluator', () => {
    const evaluator = vi.fn();
    const result = assessmentForMode(
      'baseline',
      parseUpiPayload('upi://pay?pa=shop@testbank&pn=Shop&am=50'),
      'general',
      evaluator
    );

    expect(result).toBeUndefined();
    expect(evaluator).not.toHaveBeenCalled();
  });

  it('does not render a verdict panel', () => {
    const markup = renderToStaticMarkup(
      createElement(ScenarioScreen, {
        mode: 'baseline',
        scenario: {
          id: 'SCEN-01',
          title: 'Sample payment',
          description: 'Review the payment details.',
          context: 'general',
          payload: parseUpiPayload('upi://pay?pa=shop@testbank&pn=Shop&am=50'),
        },
        paymentShown: false,
        onPay: () => undefined,
        onDontPay: () => undefined,
        onVerifyFirst: () => undefined,
        onContinue: () => undefined,
      })
    );

    expect(markup).toContain('Baseline mode');
    expect(markup).not.toContain('QRShield check');
    expect(markup).not.toContain('What we found');
  });

  it('shows web-link payloads without invented payment details', () => {
    const markup = renderToStaticMarkup(
      createElement(PaymentCard, {
        payload: parseUpiPayload('https://sample.invalid/payment'),
      })
    );

    expect(markup).toContain('This QR opens a web link');
    expect(markup).toContain('https://sample.invalid/payment');
    expect(markup).not.toContain('Payee name');
    expect(markup).not.toContain('Amount');
  });
});
