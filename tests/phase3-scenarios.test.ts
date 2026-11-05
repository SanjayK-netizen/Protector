import { describe, expect, it } from 'vitest';
import {
  AMOUNT_THRESHOLD_MAP,
  LOOKALIKE_MAX_DISTANCE,
} from '../src/config';
import { SCENARIOS, summarizeScenarios } from '../src/lib/scenarios';

describe('Phase 3 fixed scenario and engine expectations', () => {
  it('loads the original ten scenarios and returns the specified engine verdicts', () => {
    expect(SCENARIOS).toHaveLength(10);
    const summary = summarizeScenarios();
    expect(summary.results.map(result => result.assessment.verdict)).toEqual([
      'Safe', 'Safe', 'Safe', 'Safe', 'Risky', 'Risky', 'Risky', 'Risky', 'Check first', 'Safe',
    ]);
  });

  it('preserves the configured thresholds and look-alike distance', () => {
    expect(AMOUNT_THRESHOLD_MAP).toEqual({
      student: 2000,
      employee: 10000,
      shop_customer: 5000,
      merchant: 25000,
      general: 5000,
    });
    expect(LOOKALIKE_MAX_DISTANCE).toBe(2);
  });

  it('reports the live scenario summary without treating the exact-copy limitation as in-scope', () => {
    const summary = summarizeScenarios();
    expect(summary.riskyFlagged).toBe(4);
    expect(summary.riskyGroundTruthCount).toBe(5);
    expect(summary.inScopeRiskyFlagged).toBe(4);
    expect(summary.inScopeRiskyCount).toBe(4);
    expect(summary.safeRiskyCount).toBe(0);
    expect(summary.safeCheckFirstCount).toBe(1);
    expect(summary.ruleCoverage.find(rule => rule.ruleId === 2)?.count).toBe(0);
  });

  it('keeps SCEN-10 risky in ground truth, Safe in the engine, and marked as a known limitation', () => {
    const result = summarizeScenarios().results.find(item => item.scenario.id === 'SCEN-10');
    expect(result?.scenario.groundTruth).toBe('risky');
    expect(result?.scenario.knownLimitation).toBe(true);
    expect(result?.assessment.verdict).toBe('Safe');
    expect(result?.outcome).toBe('Known limitation');
  });
});
