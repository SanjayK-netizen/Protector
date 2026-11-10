import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, downloadHistoryCsv, historyToCsv } from '../src/lib/csv';
import type { HistoryRecord } from '../src/lib/history';

function makeRecord(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    participant_code: '',
    mode: 'qrshield',
    scenario_id: 'custom',
    ground_truth: '',
    decision: '',
    decision_correct: '',
    followed_recommended_check: null,
    time_to_decision_seconds: '',
    explanation_text: '',
    record_type: 'inspect',
    session_id: '',
    timestamp: '2026-01-01T00:00:00.000Z',
    context: 'general',
    engine_verdict: '',
    triggered_rules: [],
    consent_given: null,
    ...overrides,
  };
}

describe('History CSV export', () => {
  it('uses the required column order and UTF-8 BOM with CRLF line endings', () => {
    const csv = historyToCsv([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1).split('\r\n')[0].split(',')).toEqual([...CSV_COLUMNS]);
    expect(CSV_COLUMNS).toEqual([
      'participant_code',
      'mode',
      'scenario_id',
      'ground_truth',
      'decision',
      'decision_correct',
      'followed_recommended_check',
      'time_to_decision_seconds',
      'explanation_text',
      'record_type',
      'session_id',
      'timestamp',
      'context',
      'engine_verdict',
      'triggered_rules',
      'consent_given',
    ]);
    expect(csv).toContain('\r\n');
    expect(csv).not.toContain('\n\n');
  });

  it('passes a downloadable CSV with the prescribed filename and MIME type to the browser', () => {
    let download: { contents: string; filename: string; mimeType: string } | undefined;
    downloadHistoryCsv([], (contents, filename, mimeType) => {
      download = { contents, filename, mimeType };
    });
    expect(download?.filename).toBe('qrshield-history.csv');
    expect(download?.mimeType).toBe('text/csv;charset=utf-8');
    expect(download?.contents.startsWith('\uFEFFparticipant_code,mode,scenario_id')).toBe(true);
  });

  it('quotes values, escapes embedded quotes, and neutralizes formula prefixes', () => {
    const record = makeRecord({
      participant_code: '=1+1',
      explanation_text: '=@SUM("x")',
    });
    const csv = historyToCsv([record]);
    expect(csv).toContain("\"'=1+1\"");
    expect(csv).toContain("\"'=@SUM(\"\"x\"\")\"");
  });

  it('leaves verdict, rules, and recommendation fields blank for baseline rows', () => {
    const record = makeRecord({
      mode: 'baseline',
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
