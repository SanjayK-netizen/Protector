/**
 * QRShield Explainable Risk Rules Engine
 *
 * DOCUMENTED LIMITATIONS:
 * 1. The engine cannot detect an exact copy of a trusted payee's UPI ID
 *    (e.g., a tampered QR code that points to a legitimate payee or an attacker who
 *    successfully registered a previously trusted VPA).
 * 2. The engine cannot detect a scammer whose payee name matches their own UPI ID
 *    (e.g., an attacker who registers their own name matching their VPA and requests payment).
 *
 * Seven deterministic, explainable rules for UPI/QR payload analysis.
 * Each rule returns a plain-English reason a non-technical person can understand.
 *
 * Rules:
 * 1. Payee name does not match the UPI ID.
 * 2. UPI handle is not in the known-handles list.
 * 3. Look-alike of a trusted payee (small edit distance).
 * 4. "Receive / refund / cashback" wording in the note while the QR asks the user to pay.
 * 5. Unusual amount above configured threshold.
 * 6. QR contains a web link instead of a UPI payload, a shortened URL, or unsupported payload.
 * 7. Urgency wording in the note.
 *
 * Verdict:
 * 0 rules            => Safe
 * 1 rule (not 4 or 6)=> Check first
 * 2+ rules, or 4 / 6 => Risky
 *
 * Always returns the list of triggered reasons, never only a score.
 */

import { ParsedUpiPayload } from './upiParser';
import {
  AMOUNT_THRESHOLD_MAP,
  LOOKALIKE_MAX_DISTANCE,
  UserContext,
  DEFAULT_USER_CONTEXT,
} from '../config';
import defaultKnownHandles from '../data/knownHandles.json';

export type Verdict = 'Safe' | 'Check first' | 'Risky';
export type { UserContext };

export interface TriggeredRule {
  id: number;
  code: string;
  title: string;
  /** Plain-English explanation suitable for a non-technical user. */
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RiskAssessment {
  verdict: Verdict;
  triggeredRules: TriggeredRule[];
  /** Shorthand list of reasons (mirrors triggeredRules[].reason). */
  reasons: string[];
  recommendedCheck: string;
  riskScore: number;
  userContext: UserContext;
}

export interface TrustedPayee {
  name: string;
  vpa: string;
  category?: string;
}

export interface RuleEvaluatorOptions {
  knownHandles?: string[];
  trustedPayees?: TrustedPayee[];
  amountThreshold?: number;
  lookalikeMaxDistance?: number;
  context?: UserContext;
}

// ---------------------------------------------------------------------------
// Keyword lists
// ---------------------------------------------------------------------------

/**
 * Strong "you receive money" keywords for Rule 4.
 * Note: Checked against transaction note only (not payee name).
 * Neutral words like 'deposit', 'credit', 'claim', 'bonus', 'won' are excluded.
 */
const DECEPTIVE_KEYWORDS: string[] = [
  'receive',
  'refund',
  'cashback',
  'cash-back',
  'reward',
  'rewards',
  'prize',
  'winner',
];

/**
 * High-pressure urgency phrases for Rule 7.
 * Checked as whole words or phrases with word boundaries.
 */
const URGENCY_KEYWORDS: string[] = [
  'urgent',
  'urgently',
  'immediate',
  'immediately',
  'hurry',
  'expire',
  'expires',
  'expiring',
  '10 min',
  '5 min',
  'due now',
  'last chance',
  'penalty',
  'late fine',
  'suspended',
  'blocked',
  'freeze',
  'action required',
  'act fast',
];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Classic Levenshtein edit distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Returns true when the payee name plausibly corresponds to the UPI username.
 * Uses token-matching first; falls back to whole-string edit distance.
 */
export function isNameMatching(name: string, username: string): boolean {
  if (!name || !username) return false;

  const cleanName = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');

  const nameTokens = cleanName.split(/\s+/).filter(t => t.length >= 3);
  const userTokens = username
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3);

  if (nameTokens.length === 0) {
    return cleanUsername.includes(cleanName.replace(/\s+/g, ''));
  }

  for (const nToken of nameTokens) {
    if (userTokens.includes(nToken)) return true;
    if (cleanUsername.includes(nToken)) return true;
  }

  for (const uToken of userTokens) {
    if (cleanName.includes(uToken)) return true;
  }

  const joinedName = nameTokens.join('');
  if (joinedName.length > 0 && cleanUsername.length > 0) {
    if (levenshteinDistance(joinedName, cleanUsername) <= 2) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Rule evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates all 7 explainable risk rules against a parsed QR/UPI payload.
 * Accepts an optional user context ('student' | 'employee' | 'shop_customer' | 'merchant' | 'general').
 * Never throws; always returns a typed assessment.
 */
export function evaluateRisk(
  payload: ParsedUpiPayload,
  options: RuleEvaluatorOptions = {},
  context: UserContext = options.context ?? DEFAULT_USER_CONTEXT
): RiskAssessment {
  const combinedDefaultHandles = [
    ...defaultKnownHandles.knownHandles,
    ...((defaultKnownHandles as { publicBankHandles?: string[] }).publicBankHandles ?? []),
  ];

  const knownHandles = (options.knownHandles ?? combinedDefaultHandles).map(h =>
    h.toLowerCase().replace(/^@/, '')
  );
  const trustedPayees = options.trustedPayees ?? defaultKnownHandles.trustedPayees;
  const amountThreshold =
    options.amountThreshold ?? (AMOUNT_THRESHOLD_MAP[context] || AMOUNT_THRESHOLD_MAP.general);
  const lookalikeMaxDistance = options.lookalikeMaxDistance ?? LOOKALIKE_MAX_DISTANCE;

  const triggeredRules: TriggeredRule[] = [];

  // ------------------------------------------------------------------
  // RULE 6: Web link, shortened URL, or invalid/unsupported non-UPI payload
  // Checked first because non-UPI payloads skip UPI-specific rules.
  // ------------------------------------------------------------------
  if (!payload.isUpi || payload.isUrl || payload.isShortenedUrl) {
    let reason: string;
    if (payload.error && !payload.isUrl && !payload.isShortenedUrl) {
      reason = payload.error;
    } else if (payload.isShortenedUrl) {
      reason = `The QR contains a shortened URL ('${payload.raw}') that hides the real destination — do not follow it.`;
    } else if (payload.isUrl) {
      reason = `The QR contains a web link ('${payload.raw}') instead of a direct UPI payment address.`;
    } else {
      reason = 'This QR code is not a valid UPI payment code.';
    }

    triggeredRules.push({
      id: 6,
      code: 'NON_UPI_OR_URL',
      title: payload.isUrl || payload.isShortenedUrl
        ? 'Web Link or Shortened URL'
        : 'Invalid QR Payload',
      reason,
      severity: 'high',
    });
  } else if (payload.url) {
    // UPI payload with an embedded url= parameter
    triggeredRules.push({
      id: 6,
      code: 'NON_UPI_OR_URL',
      title: 'Embedded External URL',
      reason: `The UPI payload embeds an external URL ('${payload.url}') that may redirect your payment unexpectedly.`,
      severity: 'high',
    });
  }

  // ------------------------------------------------------------------
  // UPI-specific rules (1, 2, 3, 4, 5, 7) — only when isUpi is true
  // ------------------------------------------------------------------
  if (payload.isUpi) {
    // Parser error on UPI payload (e.g. invalid or negative amount)
    if (payload.error) {
      triggeredRules.push({
        id: 5,
        code: 'INVALID_AMOUNT',
        title: 'Invalid amount',
        reason: payload.error,
        severity: 'high',
      });
    }

    // RULE 1: Payee name does not match the UPI ID
    if (payload.pn && payload.username) {
      if (!isNameMatching(payload.pn, payload.username)) {
        triggeredRules.push({
          id: 1,
          code: 'NAME_MISMATCH',
          title: 'Payee Name Does Not Match UPI ID',
          reason: `The name shown ('${payload.pn}') does not match the UPI ID username ('${payload.username}'). These should correspond to the same person or organization.`,
          severity: 'medium',
        });
      }
    } else if (!payload.pn && payload.username) {
      triggeredRules.push({
        id: 1,
        code: 'NAME_MISMATCH',
        title: 'Payee Name Missing',
        reason: `The QR code includes a UPI ID ('${payload.username}') but no payee name — you cannot verify who you are paying.`,
        severity: 'medium',
      });
    }

    // RULE 2: UPI handle not in known-handles list
    if (payload.handle) {
      if (!knownHandles.includes(payload.handle.toLowerCase())) {
        triggeredRules.push({
          id: 2,
          code: 'UNKNOWN_HANDLE',
          title: 'Unrecognized UPI Bank Handle',
          reason: `The UPI handle '@${payload.handle}' is not on the list of recognized bank handles. Verify that this is a real bank before paying.`,
          severity: 'medium',
        });
      }
    } else if (payload.pa) {
      triggeredRules.push({
        id: 2,
        code: 'UNKNOWN_HANDLE',
        title: 'No Bank Handle in UPI Address',
        reason: `The payment address '${payload.pa}' does not include a valid bank handle (the part after @).`,
        severity: 'medium',
      });
    }

    // RULE 3: Look-alike of a trusted payee
    if (payload.pa) {
      const currentPa = payload.pa.toLowerCase();
      const currentUser = payload.username ?? currentPa.split('@')[0];

      for (const trusted of trustedPayees) {
        const trustedPa = trusted.vpa.toLowerCase();
        if (currentPa === trustedPa) continue; // exact match — legitimate, skip

        const distFull = levenshteinDistance(currentPa, trustedPa);
        const distUser = levenshteinDistance(currentUser, trustedPa.split('@')[0]);

        if (
          (distFull > 0 && distFull <= lookalikeMaxDistance) ||
          (distUser > 0 && distUser <= lookalikeMaxDistance)
        ) {
          triggeredRules.push({
            id: 3,
            code: 'LOOKALIKE_PAYEE',
            title: 'Address Looks Like a Trusted Payee',
            reason: `'${payload.pa}' is very similar to the verified address '${trusted.vpa}' (${trusted.name}) of a trusted payee. This could be an impersonation attempt.`,
            severity: 'medium',
          });
          break; // one look-alike warning is sufficient
        }
      }
    }

    // RULE 4: "Receive / refund / cashback" wording in the note only
    // Checked strictly against payload.tn (not payload.pn)
    if (payload.tn) {
      const matchedDeceptive: string[] = [];
      for (const kw of DECEPTIVE_KEYWORDS) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(payload.tn)) {
          matchedDeceptive.push(kw);
        }
      }
      if (matchedDeceptive.length > 0) {
        triggeredRules.push({
          id: 4,
          code: 'DECEPTIVE_DIRECTION',
          title: 'Misleading "Receive" or "Cashback" Language',
          reason: `The note says '${matchedDeceptive.join(', ')}', which sounds like money coming to you — but scanning this QR code will send money from your account.`,
          severity: 'high',
        });
      }
    }

    // RULE 5: Unusual amount above threshold (only if amount is valid number)
    if (payload.am !== undefined && !payload.error && payload.am > amountThreshold) {
      triggeredRules.push({
        id: 5,
        code: 'UNUSUAL_AMOUNT',
        title: 'Unusually High Payment Amount',
        reason: `The amount requested (Rs ${payload.am.toFixed(2)}) is above the expected limit of Rs ${amountThreshold.toFixed(2)}. Confirm this is intentional before paying.`,
        severity: 'medium',
      });
    }

    // RULE 7: Urgency wording in the note (whole words or phrases only)
    if (payload.tn) {
      for (const ukw of URGENCY_KEYWORDS) {
        // Match whole word or exact phrase boundary
        const escaped = ukw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(payload.tn)) {
          triggeredRules.push({
            id: 7,
            code: 'URGENCY_PRESSURE',
            title: 'High-Pressure Urgency Language',
            reason: `The note uses urgency language ('${ukw}') to rush you into paying without checking. Scammers commonly do this — take your time.`,
            severity: 'medium',
          });
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Verdict
  // ------------------------------------------------------------------
  const hasHighRiskRule = triggeredRules.some(r => r.id === 4 || r.id === 6 || r.severity === 'high');
  let verdict: Verdict;

  if (triggeredRules.length === 0) {
    verdict = 'Safe';
  } else if (hasHighRiskRule || triggeredRules.length >= 2) {
    verdict = 'Risky';
  } else {
    verdict = 'Check first';
  }

  const recommendedCheck =
    verdict === 'Safe'
      ? 'Details match a trusted payee. Confirm the amount on screen before paying.'
      : verdict === 'Check first'
        ? 'Something looks off. Ask the payee directly before sending money.'
        : 'Do not pay. One or more serious fraud indicators were found. Report or reject this request.';

  return {
    verdict,
    triggeredRules,
    reasons: triggeredRules.map(r => r.reason),
    recommendedCheck,
    riskScore: triggeredRules.length,
    userContext: context,
  };
}
