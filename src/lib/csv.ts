import type { HistoryRecord } from './history';

export const CSV_COLUMNS = [
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
] as const;

function neutralizeFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function quoteCsv(value: unknown): string {
  const text = neutralizeFormula(value === null || value === undefined ? '' : String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

export function historyToCsv(records: readonly HistoryRecord[]): string {
  const rows = records.map(record => {
    const values: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      participant_code: record.participant_code,
      mode: record.mode,
      scenario_id: record.scenario_id,
      ground_truth: record.ground_truth,
      decision: record.decision,
      decision_correct: record.decision_correct,
      followed_recommended_check: record.followed_recommended_check,
      time_to_decision_seconds: record.time_to_decision_seconds,
      explanation_text: record.explanation_text,
      record_type: record.record_type,
      session_id: record.session_id,
      timestamp: record.timestamp,
      context: record.context,
      engine_verdict: record.engine_verdict,
      triggered_rules: record.triggered_rules.join('|'),
    };
    return CSV_COLUMNS.map(column => quoteCsv(values[column])).join(',');
  });
  return `\uFEFF${CSV_COLUMNS.join(',')}\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`;
}

export function downloadHistoryCsv(
  records: readonly HistoryRecord[],
  download: (contents: string, filename: string, mimeType: string) => void = browserDownload
): void {
  download(historyToCsv(records), 'qrshield-history.csv', 'text/csv;charset=utf-8');
}

function browserDownload(contents: string, filename: string, mimeType: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
