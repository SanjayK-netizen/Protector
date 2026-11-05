import knownHandlesData from '../data/knownHandles.json';
import scenariosData from '../data/scenarios.json';
import { UserContext } from '../config';
import { evaluateRisk, RiskAssessment, Verdict } from './riskRules';
import { parseUpiPayload, ParsedUpiPayload } from './upiParser';

export interface Scenario {
  id: string;
  context: UserContext;
  setting: string;
  title: string;
  description: string;
  rawPayload: string;
  payeeName: string;
  payeeVpa: string;
  amount: number;
  note: string;
  groundTruth: 'safe' | 'risky';
  knownLimitation?: boolean;
}

export interface ScenarioResult {
  scenario: Scenario;
  payload: ParsedUpiPayload;
  assessment: RiskAssessment;
  expectedVerdict: Verdict;
  outcome: 'Match' | 'Known limitation' | 'Mismatch';
}

export const SCENARIOS = scenariosData as Scenario[];

export const ENGINE_OPTIONS = {
  knownHandles: [...knownHandlesData.knownHandles, ...knownHandlesData.publicBankHandles],
  trustedPayees: knownHandlesData.trustedPayees,
  lookalikeMaxDistance: 2,
};

const EXPECTED_VERDICTS: Record<string, Verdict> = {
  'SCEN-01': 'Safe',
  'SCEN-02': 'Safe',
  'SCEN-03': 'Safe',
  'SCEN-04': 'Safe',
  'SCEN-05': 'Risky',
  'SCEN-06': 'Risky',
  'SCEN-07': 'Risky',
  'SCEN-08': 'Risky',
  'SCEN-09': 'Check first',
  'SCEN-10': 'Safe',
};

export function expectedVerdictFor(scenario: Scenario): Verdict {
  return EXPECTED_VERDICTS[scenario.id] ?? 'Risky';
}

export function assessScenario(
  scenario: Scenario,
  assess: typeof evaluateRisk = evaluateRisk
): ScenarioResult {
  const payload = parseUpiPayload(scenario.rawPayload);
  const assessment = assess(payload, ENGINE_OPTIONS, scenario.context);
  const expectedVerdict = expectedVerdictFor(scenario);
  return {
    scenario,
    payload,
    assessment,
    expectedVerdict,
    outcome: scenario.knownLimitation
      ? 'Known limitation'
      : assessment.verdict === expectedVerdict
        ? 'Match'
        : 'Mismatch',
  };
}

export interface EngineSummary {
  scenarioCount: number;
  safeGroundTruthCount: number;
  riskyGroundTruthCount: number;
  riskyFlagged: number;
  inScopeRiskyCount: number;
  inScopeRiskyFlagged: number;
  safeRiskyCount: number;
  safeCheckFirstCount: number;
  ruleCoverage: { ruleId: number; count: number }[];
  results: ScenarioResult[];
}

export function summarizeScenarios(): EngineSummary {
  const results = SCENARIOS.map(scenario => assessScenario(scenario));
  const safeResults = results.filter(result => result.scenario.groundTruth === 'safe');
  const riskyResults = results.filter(result => result.scenario.groundTruth === 'risky');
  const inScopeRisky = riskyResults.filter(result => !result.scenario.knownLimitation);
  return {
    scenarioCount: SCENARIOS.length,
    safeGroundTruthCount: safeResults.length,
    riskyGroundTruthCount: riskyResults.length,
    riskyFlagged: inScopeRisky.filter(result => result.assessment.verdict === 'Risky').length,
    inScopeRiskyCount: inScopeRisky.length,
    inScopeRiskyFlagged: inScopeRisky.filter(result => result.assessment.verdict === 'Risky').length,
    safeRiskyCount: safeResults.filter(result => result.assessment.verdict === 'Risky').length,
    safeCheckFirstCount: safeResults.filter(result => result.assessment.verdict === 'Check first').length,
    ruleCoverage: Array.from({ length: 7 }, (_, index) => ({
      ruleId: index + 1,
      count: results.reduce(
        (total, result) =>
          total + (result.assessment.triggeredRules.some(rule => rule.id === index + 1) ? 1 : 0),
        0
      ),
    })),
    results,
  };
}

export function scenarioById(id: string | null | undefined): Scenario | undefined {
  return SCENARIOS.find(scenario => scenario.id === id);
}
