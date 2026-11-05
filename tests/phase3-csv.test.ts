import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, historyToCsv } from '../src/lib/csv';
import { makeDecisionRecord } from '../src/lib/session';
import { SCENARIOS } from '../src/lib/scenarios';

describe('History CSV export', () => {
  it('uses the required column order and UTF-8 BOM with CRLF line endings', () => {
    const csv = historyToCsv([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1).split('\r\n')[0].split(',')).toEqual([...CSV_COLUMNS]);
    expect(csv).toContain('\r\n');
    expect(csv).not.toContain('\n\n');
  });

  it('quotes values, escapes embedded quotes, and neutralizes formula prefixes', () => {
    const record = makeDecisionRecord({
      participantCode: '=1+1',
      sessionId: 'session-1',
      mode: 'qrshield',
      scenario: { ...SCENARIOS[0], title: 'test' },
      decision: 'Pay',
      followedRecommendedCheck: true,
      timeToDecisionSeconds: 1,
      explanationText: '=@SUM("x")',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const csv = historyToCsv([record]);
    expect(csv).toContain("\"'=1+1\"");
    expect(csv).toContain("\"'=@SUM(\"\"x\"\")\"");
  });

  it('leaves verdict, rules, and recommendation fields blank for baseline rows', () => {
    const record = makeDecisionRecord({
      participantCode: 'P01',
      sessionId: 'session-1',
      mode: 'baseline',
      scenario: SCENARIOS[0],
      decision: "Don't pay",
      followedRecommendedCheck: null,
      timeToDecisionSeconds: 2,
      explanationText: 'not stored in baseline',
    });
    const row = historyToCsv([record]).split('\r\n')[1];
    expect(row).toContain('"baseline"');
    const fields = row.split(',');
    expect(fields[6]).toBe('""');
    expect(fields[13]).toBe('""');
    expect(fields[14]).toBe('""');
    expect(record.followed_recommended_check).toBeNull();
    expect(record.engine_verdict).toBe('');
    expect(record.triggered_rules).toEqual([]);
    expect(record.explanation_text).toBe('');
  });
});
