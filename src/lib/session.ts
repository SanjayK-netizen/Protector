import type { ParticipantMode } from '../App';
import type { Scenario } from './scenarios';
import type { Verdict } from './riskRules';
import type { HistoryRecord } from './history';

export type Decision = 'Pay' | "Don't pay" | 'Verify first';
export type TrialPhase = 'trial' | 'interstitial' | 'complete';

export interface PlannedTrial {
  mode: ParticipantMode;
  scenario: Scenario;
}

export interface SessionPlan {
  sessionId: string;
  participantCode: string;
  modeOrder: ParticipantMode[];
  trialsByMode: Record<ParticipantMode, PlannedTrial[]>;
}

export interface SessionRecordInput {
  participantCode: string;
  sessionId: string;
  mode: ParticipantMode;
  scenario: Scenario;
  decision: Decision;
  followedRecommendedCheck: boolean | null;
  timeToDecisionSeconds: number;
  explanationText: string;
  engineVerdict?: Verdict;
  triggeredRules?: number[];
  timestamp?: string;
  consentGiven?: boolean;
}

export function isValidParticipantCode(code: string): boolean {
  return /^[A-Za-z0-9-]{2,12}$/.test(code);
}

export function shuffle<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function createSessionPlan(
  participantCode: string,
  scenarios: readonly Scenario[],
  modeOrder: ParticipantMode[] = ['baseline', 'qrshield'],
  random: () => number = Math.random,
  createId: () => string = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
): SessionPlan {
  if (!isValidParticipantCode(participantCode)) {
    throw new Error('Participant code must be 2–12 letters, numbers, or hyphens.');
  }
  const normalizedOrder: ParticipantMode[] = modeOrder[0] === 'qrshield'
    ? ['qrshield', 'baseline']
    : ['baseline', 'qrshield'];
  return {
    sessionId: createId(),
    participantCode,
    modeOrder: normalizedOrder,
    trialsByMode: {
      baseline: shuffle(scenarios, random).map(scenario => ({ mode: 'baseline', scenario })),
      qrshield: shuffle(scenarios, random).map(scenario => ({ mode: 'qrshield', scenario })),
    },
  };
}

export function scoreDecision(groundTruth: Scenario['groundTruth'], decision: Decision): boolean {
  return groundTruth === 'safe'
    ? decision === 'Pay'
    : decision === "Don't pay" || decision === 'Verify first';
}

export function followedRecommendation(
  verdict: Verdict | undefined,
  decision: Decision,
  mode: ParticipantMode
): boolean | null {
  if (mode === 'baseline' || verdict === undefined) return null;
  return verdict === 'Safe'
    ? decision === 'Pay'
    : decision !== 'Pay';
}

export function makeDecisionRecord(input: SessionRecordInput): HistoryRecord {
  return {
    participant_code: input.participantCode,
    mode: input.mode,
    scenario_id: input.scenario.id,
    ground_truth: input.scenario.groundTruth,
    decision: input.decision,
    decision_correct: scoreDecision(input.scenario.groundTruth, input.decision),
    followed_recommended_check: input.followedRecommendedCheck,
    time_to_decision_seconds: Math.max(0, Math.round(input.timeToDecisionSeconds * 100) / 100),
    explanation_text: input.mode === 'qrshield' ? input.explanationText : '',
    record_type: 'session' as const,
    session_id: input.sessionId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    context: input.scenario.context,
    engine_verdict: input.mode === 'qrshield' ? input.engineVerdict ?? '' : '',
    triggered_rules: input.mode === 'qrshield' ? input.triggeredRules ?? [] : [],
    consent_given: input.consentGiven ?? null,
  };
}
