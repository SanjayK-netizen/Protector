import knownHandlesData from '../data/knownHandles.json';
import type { UserContext } from '../config';
import { LOOKALIKE_MAX_DISTANCE } from '../config';
import { evaluateRisk } from './riskRules';
import type { RiskAssessment } from './riskRules';
import type { ParsedUpiPayload } from './upiParser';

export type ParticipantMode = 'baseline' | 'qrshield';

const EVALUATOR_OPTIONS = {
  knownHandles: [...knownHandlesData.knownHandles, ...knownHandlesData.publicBankHandles],
  trustedPayees: knownHandlesData.trustedPayees,
  lookalikeMaxDistance: LOOKALIKE_MAX_DISTANCE,
};

export function assessmentForMode(
  mode: ParticipantMode,
  payload: ParsedUpiPayload,
  context: UserContext,
  assess: typeof evaluateRisk = evaluateRisk
): RiskAssessment | undefined {
  if (mode === 'baseline') return undefined;
  return assess(payload, EVALUATOR_OPTIONS, context);
}
