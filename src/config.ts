/**
 * QRShield Configuration
 * Central configuration for risk evaluation thresholds, test handles, and simulation notices.
 */

export interface AppConfig {
  /** Maximum normal amount for college student transactions before triggering Rule 5 */
  amountThreshold: number;
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
  amountThreshold: 2000.0,
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
