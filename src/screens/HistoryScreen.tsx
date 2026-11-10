import { useMemo, useState } from 'react';
import { downloadHistoryCsv } from '../lib/csv';
import { clearHistory, useHistoryRecords } from '../lib/history';
import { verdictLabel } from '../components/VerdictBadge';

export function HistoryScreen() {
  const records = useHistoryRecords();
  const [filter, setFilter] = useState<'all' | 'inspect' | 'session'>('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const filtered = useMemo(() => records.filter(record =>
    (filter === 'all' || record.record_type === filter) &&
    `${record.participant_code} ${record.scenario_id} ${record.decision} ${record.explanation_text}`
      .toLowerCase().includes(search.toLowerCase())
  ), [records, filter, search]);
  const inspectionCount = records.filter(record => record.record_type === 'inspect').length;
  const previousSessionCount = records.filter(record => record.record_type === 'session').length;

  function deleteAll() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    clearHistory();
    setConfirmDelete(false);
    setMessage('Local history deleted from this browser.');
  }

  return (
    <section className="workspace-screen">
      <header className="page-header">
        <div><p className="eyebrow">This browser only</p><h1>History & export</h1><p className="local-data-warning">Local data, not validated results. History may be unavailable if browser storage is blocked.</p></div>
      </header>
      <div className="stat-grid history-stats">
        <article className="stat-card"><span>Total records</span><strong>{records.length}</strong></article>
        <article className="stat-card"><span>QR inspections</span><strong>{inspectionCount}</strong></article>
        <article className="stat-card"><span>Earlier study records</span><strong>{previousSessionCount}</strong></article>
      </div>
      <section className="panel table-panel">
        <div className="history-toolbar">
          <label className="field-label" htmlFor="history-search">Filter records</label>
          <input id="history-search" className="text-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Payload reference, decision..." />
          <label className="field-label" htmlFor="history-mode">Record type</label>
          <select id="history-mode" className="text-input" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
            <option value="all">All records</option><option value="inspect">QR inspections</option><option value="session">Earlier study records</option>
          </select>
          <div className="history-actions">
            <button type="button" className="primary-button" onClick={() => downloadHistoryCsv(records)}>Export CSV</button>
            {!confirmDelete ? (
              <button type="button" className="danger-outline-button" onClick={deleteAll}>Delete all data</button>
            ) : (
              <div className="confirm-delete" role="group" aria-label="Confirm deletion">
                <p>Delete all {records.length} local records? This cannot be undone.</p>
                <button type="button" className="danger-button" onClick={deleteAll}>Confirm delete all data</button>
                <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            )}
          </div>
          {message && <p role="status">{message}</p>}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Time</th><th>Record type</th><th>Payload reference</th><th>Decision</th><th>Verdict</th><th>Seconds</th><th>Explanation</th></tr></thead>
            <tbody>{filtered.map((record, index) => (
              <tr key={`${record.timestamp}-${record.scenario_id}-${index}`}>
                <td>{record.timestamp}</td>
                <td>{record.record_type === 'session' ? 'Earlier study data' : 'QR inspection'}</td>
                <td>{record.scenario_id}</td>
                <td>{record.decision || '—'}</td>
                <td>{record.engine_verdict ? verdictLabel(record.engine_verdict) : '—'}</td>
                <td>{record.time_to_decision_seconds === '' ? '—' : record.time_to_decision_seconds}</td><td>{record.explanation_text || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <p className="empty-state">No local records match this filter.</p>}
        </div>
      </section>
    </section>
  );
}
