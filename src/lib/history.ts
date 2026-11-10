import { useSyncExternalStore } from 'react';
import type { UserContext } from '../config';
import type { Verdict } from './riskRules';

type ParticipantMode = 'baseline' | 'qrshield';
type Decision = 'Pay' | "Don't pay" | 'Verify first';

export const HISTORY_KEY = 'qrshield.phase3.history.v1';
export const HISTORY_LIMIT = 5000;

export interface HistoryRecord {
  participant_code: string;
  mode: ParticipantMode;
  scenario_id: string;
  ground_truth: 'safe' | 'risky' | '';
  decision: Decision | '';
  decision_correct: boolean | '';
  followed_recommended_check: boolean | null;
  time_to_decision_seconds: number | '';
  explanation_text: string;
  record_type: 'session' | 'inspect';
  session_id: string;
  timestamp: string;
  context: UserContext | '';
  engine_verdict: Verdict | '';
  triggered_rules: number[];
  consent_given: boolean | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Listener = () => void;
type HistoryStore = ReturnType<typeof createHistoryStore>;

const VALID_MODES = new Set(['baseline', 'qrshield']);
const VALID_DECISIONS = new Set(['Pay', "Don't pay", 'Verify first']);
const VALID_CONTEXTS = new Set(['student', 'employee', 'shop_customer', 'merchant', 'general']);
const VALID_VERDICTS = new Set(['Safe', 'Check first', 'Risky']);
const EMPTY_HISTORY: HistoryRecord[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateHistoryRecord(value: unknown): HistoryRecord | undefined {
  if (!isRecord(value)) return undefined;
  const {
    participant_code,
    mode,
    scenario_id,
    ground_truth,
    decision,
    decision_correct,
    followed_recommended_check,
    time_to_decision_seconds,
    explanation_text,
    record_type,
    session_id,
    timestamp,
    context,
    engine_verdict,
    triggered_rules,
    consent_given,
  } = value;
  if (
    typeof participant_code !== 'string' ||
    !VALID_MODES.has(String(mode)) ||
    typeof scenario_id !== 'string' ||
    !['safe', 'risky', ''].includes(String(ground_truth)) ||
    !(typeof decision === 'string' && (VALID_DECISIONS.has(decision) || decision === '')) ||
    !(typeof decision_correct === 'boolean' || decision_correct === '') ||
    !(typeof followed_recommended_check === 'boolean' || followed_recommended_check === null) ||
    !(
      time_to_decision_seconds === '' ||
      (typeof time_to_decision_seconds === 'number' &&
        Number.isFinite(time_to_decision_seconds) &&
        time_to_decision_seconds >= 0)
    ) ||
    typeof explanation_text !== 'string' ||
    !(record_type === 'session' || record_type === 'inspect') ||
    typeof session_id !== 'string' ||
    typeof timestamp !== 'string' ||
    !(typeof context === 'string' && (VALID_CONTEXTS.has(context) || context === '')) ||
    !(typeof engine_verdict === 'string' && (VALID_VERDICTS.has(engine_verdict) || engine_verdict === '')) ||
    !Array.isArray(triggered_rules) ||
    !triggered_rules.every(rule => Number.isInteger(rule) && rule >= 1 && rule <= 7) ||
    !(typeof consent_given === 'boolean' || consent_given === null)
  ) {
    return undefined;
  }
  return {
    participant_code,
    mode: mode as ParticipantMode,
    scenario_id,
    ground_truth: ground_truth as HistoryRecord['ground_truth'],
    decision: decision as HistoryRecord['decision'],
    decision_correct: decision_correct as HistoryRecord['decision_correct'],
    followed_recommended_check,
    time_to_decision_seconds: time_to_decision_seconds as HistoryRecord['time_to_decision_seconds'],
    explanation_text,
    record_type,
    session_id,
    timestamp,
    context: context as HistoryRecord['context'],
    engine_verdict: engine_verdict as HistoryRecord['engine_verdict'],
    triggered_rules: triggered_rules.map(Number),
    consent_given,
  };
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function createHistoryStore(
  storage?: StorageLike,
  key = HISTORY_KEY
) {
  const listeners = new Set<Listener>();
  const memoryRecords: HistoryRecord[] = [];
  let snapshot: HistoryRecord[] = [];
  let loaded = false;
  let storageAvailable = storage !== undefined;

  function notify() {
    listeners.forEach(listener => listener());
  }

  function write(records: HistoryRecord[]) {
    if (!storageAvailable || !storage) return;
    try {
      storage.setItem(key, JSON.stringify(records));
    } catch {
      storageAvailable = false;
    }
  }

  function load(): HistoryRecord[] {
    if (loaded) return snapshot;
    loaded = true;
    if (storageAvailable && storage) {
      try {
        const raw = storage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          snapshot = parsed
            .map(validateHistoryRecord)
            .filter((record): record is HistoryRecord => record !== undefined)
            .slice(-HISTORY_LIMIT);
          memoryRecords.push(...snapshot);
          if (snapshot.length !== parsed.length) write(snapshot);
          return snapshot;
        }
      } catch {
        storageAvailable = false;
      }
    }
    snapshot = [...memoryRecords];
    return snapshot;
  }

  return {
    getSnapshot: () => load(),
    getServerSnapshot: (): HistoryRecord[] => EMPTY_HISTORY,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    append(record: HistoryRecord): boolean {
      const valid = validateHistoryRecord(record);
      if (!valid) return false;
      const records = [...load(), valid].slice(-HISTORY_LIMIT);
      snapshot = records;
      memoryRecords.splice(0, memoryRecords.length, ...records);
      write(records);
      notify();
      return true;
    },
    clear(): void {
      snapshot = [];
      memoryRecords.length = 0;
      loaded = true;
      if (storageAvailable && storage) {
        try {
          storage.removeItem(key);
        } catch {
          storageAvailable = false;
        }
      }
      notify();
    },
  };
}

export const historyStore = createHistoryStore(browserStorage());

export function useHistoryRecords(store: HistoryStore = historyStore): HistoryRecord[] {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}

export function saveHistoryRecord(record: HistoryRecord): boolean {
  return historyStore.append(record);
}

export function getHistoryRecords(): HistoryRecord[] {
  return historyStore.getSnapshot();
}

export function clearHistory(): void {
  historyStore.clear();
}
