/**
 * QRShield Configuration
 * Central configuration for risk evaluation thresholds, test handles, and simulation notices.
 */

export type UserContext = 'student' | 'employee' | 'shop_customer' | 'merchant' | 'general';

/**
 * Per-context threshold amounts for Rule 5 (unusual payment amount).
 * Note: these placeholder values are assumptions, to be validated.
 */
export const AMOUNT_THRESHOLD_MAP: Record<UserContext, number> = {
  student: 2000,
  employee: 10000,
  shop_customer: 5000,
  merchant: 25000,
  general: 5000,
};

export const DEFAULT_USER_CONTEXT: UserContext = 'general';

export interface AppConfig {
  /** Default payment amount threshold before triggering Rule 5 */
  amountThreshold: number;
  /** Per-context payment amount thresholds */
  amountThresholdMap: Record<UserContext, number>;
  /** Maximum Levenshtein edit distance to consider a VPA a look-alike (Rule 3) */
  lookalikeMaxDistance: number;
  /** Rule IDs that automatically classify a transaction as Risky */
  highRiskRuleIds: number[];
  /** Optional generic baseline guidance line shown in baseline mode */
  baselineNotice: string;
  /** Mandatory simulation notice banner text */
  simulationBannerText: string;
  /** Default test handle for synthetic data */
  defaultTestHandle: string;
}

export const CONFIG: AppConfig = {
  amountThreshold: AMOUNT_THRESHOLD_MAP.general,
  amountThresholdMap: AMOUNT_THRESHOLD_MAP,
  lookalikeMaxDistance: 2,
  highRiskRuleIds: [4, 6],
  baselineNotice: 'Please review recipient details carefully before authorizing payment.',
  simulationBannerText: 'SIMULATION - NO REAL PAYMENT',
  defaultTestHandle: 'testbank',
};

export const AMOUNT_THRESHOLD = CONFIG.amountThreshold;
export const LOOKALIKE_MAX_DISTANCE = CONFIG.lookalikeMaxDistance;
export const HIGH_RISK_RULE_IDS = CONFIG.highRiskRuleIds;
export const BASELINE_NOTICE = CONFIG.baselineNotice;
export const SIMULATION_BANNER_TEXT = CONFIG.simulationBannerText;
export const DEFAULT_TEST_HANDLE = CONFIG.defaultTestHandle;
