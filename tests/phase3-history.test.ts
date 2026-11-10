import { describe, expect, it } from 'vitest';
import { createHistoryStore, HISTORY_LIMIT, HistoryRecord, StorageLike } from '../src/lib/history';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function record(index = 1): HistoryRecord {
  return {
    participant_code: `P${index}`,
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
    engine_verdict: 'Safe',
    triggered_rules: [],
    consent_given: null,
  };
}

describe('Local history store', () => {
  it('appends and reloads valid records', () => {
    const storage = new MemoryStorage();
    const first = createHistoryStore(storage);
    expect(first.append(record())).toBe(true);
    const reloaded = createHistoryStore(storage);
    expect(reloaded.getSnapshot()).toHaveLength(1);
    expect(reloaded.getSnapshot()[0].participant_code).toBe('P1');
  });

  it('handles corrupt JSON with an empty in-memory fallback', () => {
    const storage = new MemoryStorage();
    storage.setItem('qrshield.phase3.history.v1', '{bad json');
    const store = createHistoryStore(storage);
    expect(store.getSnapshot()).toEqual([]);
    expect(store.append(record())).toBe(true);
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it('drops malformed entries on load', () => {
    const storage = new MemoryStorage();
    storage.setItem('qrshield.phase3.history.v1', JSON.stringify([record(), { mode: 'wrong' }]));
    const store = createHistoryStore(storage);
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it('clears records from memory and storage', () => {
    const storage = new MemoryStorage();
    const store = createHistoryStore(storage);
    store.append(record());
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
    expect(storage.getItem('qrshield.phase3.history.v1')).toBeNull();
  });

  it('caps the record list to the newest 5000 entries', () => {
    const store = createHistoryStore();
    for (let index = 0; index < HISTORY_LIMIT + 1; index++) {
      store.append(record(index));
    }
    expect(store.getSnapshot()).toHaveLength(HISTORY_LIMIT);
    expect(store.getSnapshot()[0].participant_code).toBe('P1');
  });

  it('falls back to memory when storage reads, writes, or deletes throw', () => {
    const broken: StorageLike = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    const store = createHistoryStore(broken);
    expect(store.getSnapshot()).toEqual([]);
    expect(store.append(record())).toBe(true);
    expect(store.getSnapshot()).toHaveLength(1);
    expect(() => store.clear()).not.toThrow();
    expect(store.getSnapshot()).toEqual([]);
  });
});
