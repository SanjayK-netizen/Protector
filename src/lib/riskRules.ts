/**
 * QRShield Explainable Risk Rules Engine
 *
 * Seven deterministic, explainable rules for UPI/QR payload analysis.
 * Each rule returns a plain-English reason a non-technical person can understand.
 *
 * Rules
 * -----
 * 1. Payee name does not match the UPI ID.
 * 2. UPI handle is not in the known-handles list.
 * 3. Look-alike of a trusted payee (small edit distance).
 * 4. "Receive / refund / cashback" wording in the note while QR asks the user to pay.
 * 5. Unusual amount above configured threshold.
 * 6. QR contains a web link instead of a UPI payload, or a shortened URL.
 * 7. Urgency wording in the note.
 *
 * Verdict
 * -------
 * 0 rules            => Safe
 * 1 rule (not 4/6)   => Check first
 * 2+ rules, or 4/6   => Risky
 *
 * Always return the full list of triggered rules — never only a score.
 */

import { ParsedUpiPayload } from './upiParser';
import { AMOUNT_THRESHOLD, LOOKALIKE_MAX_DISTANCE } from '../config';
import defaultKnownHandles from '../data/knownHandles.json';

export type Verdict = 'Safe' | 'Check first' | 'Risky';

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
}

// ---------------------------------------------------------------------------
// Keyword lists
// ---------------------------------------------------------------------------

const DECEPTIVE_KEYWORDS: string[] = [
  'receive',
  'refund',
  'cashback',
  'cash-back',
  'credited',
  'credit',
  'claim',
  'reward',
  'rewards',
  'won',
  'winner',
  'bonus',
  'prize',
  'deposit',
];

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
  'fine',
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
  // Strip separators from username so "canteen" matches "canteen@testbank" already split
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
 * Never throws; always returns an assessment.
 */
export function evaluateRisk(
  payload: ParsedUpiPayload,
  options: RuleEvaluatorOptions = {}
): RiskAssessment {
  const knownHandles = (options.knownHandles ?? defaultKnownHandles.knownHandles).map(h =>
    h.toLowerCase().replace(/^@/, '')
  );
  const trustedPayees = options.trustedPayees ?? defaultKnownHandles.trustedPayees;
  const amountThreshold = options.amountThreshold ?? AMOUNT_THRESHOLD;
  const lookalikeMaxDistance = options.lookalikeMaxDistance ?? LOOKALIKE_MAX_DISTANCE;

  const triggeredRules: TriggeredRule[] = [];

  // ------------------------------------------------------------------
  // RULE 6: Web link or shortened URL instead of a UPI payload
  // Checked first because non-UPI payloads skip all UPI-specific rules.
  // ------------------------------------------------------------------
  if (!payload.isUpi || payload.isUrl || payload.isShortenedUrl) {
    const reason = payload.isShortenedUrl
      ? `The QR contains a shortened URL ('${payload.raw}') that hides the real destination — do not follow it.`
      : `The QR contains a web link ('${payload.raw}') instead of a direct UPI payment address.`;

    triggeredRules.push({
      id: 6,
      code: 'NON_UPI_OR_URL',
      title: 'Web Link or Shortened URL',
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
    // RULE 1: Payee name does not match the UPI ID
    if (payload.pn && payload.username) {
      if (!isNameMatching(payload.pn, payload.username)) {
        triggeredRules.push({
          id: 1,
          code: 'NAME_MISMATCH',
          title: 'Payee Name Does Not Match UPI ID',
          reason: `The name shown ('${payload.pn}') does not match the UPI ID username ('${payload.username}'). These should correspond to the same person or business.`,
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
            reason: `'${payload.pa}' is very similar to the verified address '${trusted.vpa}' (${trusted.name}). This could be an impersonation attempt.`,
            severity: 'medium',
          });
          break; // one look-alike warning is enough
        }
      }
    }

    // RULE 4: "Receive / refund / cashback" wording in the note
    const noteText = `${payload.tn ?? ''} ${payload.pn ?? ''}`.toLowerCase();
    const matchedDeceptive: string[] = [];
    for (const kw of DECEPTIVE_KEYWORDS) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(noteText)) {
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

    // RULE 5: Unusual amount above threshold
    if (payload.am !== undefined && payload.am > amountThreshold) {
      triggeredRules.push({
        id: 5,
        code: 'UNUSUAL_AMOUNT',
        title: 'Unusually High Payment Amount',
        reason: `The amount requested (Rs ${payload.am.toFixed(2)}) is above the expected limit of Rs ${amountThreshold.toFixed(2)}. Confirm this is intentional before paying.`,
        severity: 'medium',
      });
    }

    // RULE 7: Urgency wording in the note
    if (payload.tn) {
      const noteLower = payload.tn.toLowerCase();
      for (const ukw of URGENCY_KEYWORDS) {
        if (noteLower.includes(ukw)) {
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
  const hasHighRiskRule = triggeredRules.some(r => r.id === 4 || r.id === 6);
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
      ? 'No warning signs detected. Confirm the amount on screen before paying.'
      : verdict === 'Check first'
        ? 'Something looks off. Ask the payee directly before sending money.'
        : 'Do not pay. One or more serious fraud indicators were found. Report or reject this request.';

  return {
    verdict,
    triggeredRules,
    reasons: triggeredRules.map(r => r.reason),
    recommendedCheck,
    riskScore: triggeredRules.length,
  };
}
