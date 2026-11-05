import { describe, expect, it } from 'vitest';
import { createSessionPlan, followedRecommendation, isValidParticipantCode, scoreDecision } from '../src/lib/session';
import { parseHash, formatHash } from '../src/lib/routing';
import { SCENARIOS } from '../src/lib/scenarios';

describe('Session plan and participant code', () => {
  it('creates twenty trials with every scenario once per mode and respects mode order', () => {
    const plan = createSessionPlan('P-01', SCENARIOS, ['qrshield', 'baseline'], () => 0.3, () => 'fixed');
    expect(plan.sessionId).toBe('fixed');
    expect(plan.modeOrder).toEqual(['qrshield', 'baseline']);
    expect(plan.trialsByMode.baseline).toHaveLength(10);
    expect(plan.trialsByMode.qrshield).toHaveLength(10);
    for (const mode of plan.modeOrder) {
      expect(plan.trialsByMode[mode].map(trial => trial.scenario.id).sort())
        .toEqual(SCENARIOS.map(scenario => scenario.id).sort());
    }
    expect([...plan.trialsByMode.baseline, ...plan.trialsByMode.qrshield]).toHaveLength(20);
  });

  it('validates 2–12 alphanumeric or hyphen participant codes', () => {
    expect(isValidParticipantCode('A1')).toBe(true);
    expect(isValidParticipantCode('AB-123')).toBe(true);
    expect(isValidParticipantCode('A')).toBe(false);
    expect(isValidParticipantCode('has space')).toBe(false);
    expect(isValidParticipantCode('abcdefghijklmn')).toBe(false);
    expect(() => createSessionPlan('Full Name', SCENARIOS)).toThrow();
  });
});

describe('Decision scoring and route parsing', () => {
  it('scores safe pay and risky non-pay decisions, and recommendation adherence', () => {
    expect(scoreDecision('safe', 'Pay')).toBe(true);
    expect(scoreDecision('safe', "Don't pay")).toBe(false);
    expect(scoreDecision('risky', "Don't pay")).toBe(true);
    expect(scoreDecision('risky', 'Verify first')).toBe(true);
    expect(scoreDecision('risky', 'Pay')).toBe(false);
    expect(followedRecommendation('Safe', 'Pay', 'qrshield')).toBe(true);
    expect(followedRecommendation('Risky', 'Verify first', 'qrshield')).toBe(true);
    expect(followedRecommendation('Check first', 'Pay', 'qrshield')).toBe(false);
    expect(followedRecommendation(undefined, 'Pay', 'baseline')).toBeNull();
  });

  it('round-trips supported hash routes and defaults unknown routes to dashboard', () => {
    expect(parseHash('#/inspect?scenario=SCEN-05')).toEqual({ page: 'inspect', scenarioId: 'SCEN-05' });
    expect(parseHash(formatHash({ page: 'compare', scenarioId: 'SCEN-10' })))
      .toEqual({ page: 'compare', scenarioId: 'SCEN-10' });
    expect(parseHash('#/unknown')).toEqual({ page: 'dashboard' });
  });
});
