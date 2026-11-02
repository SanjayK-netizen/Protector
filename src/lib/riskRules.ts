/**
 * QRShield Explainable Risk Rules Engine
 * Implements the 7 explainable risk rules for UPI QR scanning and generates plain-English verdicts.
 * 
 * Rules:
 * 1. Payee name does not match the UPI ID.
 * 2. UPI handle is not in the known-handles list.
 * 3. Look-alike of a trusted payee (small edit distance).
 * 4. "Receive / refund / cashback" wording in note while QR asks to pay.
 * 5. Unusual amount above configured threshold.
 * 6. QR contains a web link instead of a UPI payload, or a shortened URL.
 * 7. Urgency wording in the note.
 * 
 * Verdict logic:
 * - 0 rules: Safe
 * - 1 rule: Check first (unless Rule 4 or 6)
 * - 2+ rules or Rule 4 or Rule 6: Risky
 */

import { ParsedUpiPayload } from './upiParser';
import { AMOUNT_THRESHOLD, LOOKALIKE_MAX_DISTANCE } from '../config';
import defaultKnownHandles from '../data/knownHandles.json';

export type Verdict = 'Safe' | 'Check first' | 'Risky';

export interface TriggeredRule {
  id: number;
  code: string;
  title: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RiskAssessment {
  verdict: Verdict;
  triggeredRules: TriggeredRule[];
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

const DECEPTIVE_KEYWORDS = [
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

const URGENCY_KEYWORDS = [
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

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Determines whether a payee name reasonably corresponds to the UPI username.
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

  // If name has no significant tokens (e.g. 1-2 char abbreviations)
  if (nameTokens.length === 0) {
    return cleanUsername.includes(cleanName.replace(/\s+/g, ''));
  }

  // 1. Direct token match
  for (const nToken of nameTokens) {
    if (userTokens.includes(nToken)) return true;
    if (cleanUsername.includes(nToken)) return true;
  }

  for (const uToken of userTokens) {
    if (cleanName.includes(uToken)) return true;
  }

  // 2. High overall similarity between concatenated strings
  const joinedName = nameTokens.join('');
  if (joinedName.length > 0 && cleanUsername.length > 0) {
    const dist = levenshteinDistance(joinedName, cleanUsername);
    if (dist <= 2) return true;
  }

  return false;
}

/**
 * Evaluates all 7 explainable risk rules for a given parsed QR/UPI payload.
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

  // RULE 6: QR contains a web link instead of a UPI payload, or a shortened URL
  if (!payload.isUpi || payload.isUrl || payload.isShortenedUrl) {
    const reason = payload.isShortenedUrl
      ? `The QR code contains a shortened URL ('${payload.raw}') that hides the real destination.`
      : `The QR code contains an external web link or non-UPI destination ('${payload.raw}') instead of a direct UPI payment.`;

    triggeredRules.push({
      id: 6,
      code: 'NON_UPI_OR_URL',
      title: 'Web Link or Shortened URL',
      reason,
      severity: 'high',
    });
  } else if (payload.url) {
    triggeredRules.push({
      id: 6,
      code: 'NON_UPI_OR_URL',
      title: 'External URL Redirection',
      reason: `The UPI payload includes an embedded external URL ('${payload.url}') which may redirect your payment.`,
      severity: 'high',
    });
  }

  // UPI-specific rules (Rules 1, 2, 3, 4, 5, 7) only apply if payload is a UPI URI
  if (payload.isUpi) {
    // RULE 1: Payee name does not match the UPI ID
    if (payload.pn && payload.username) {
      if (!isNameMatching(payload.pn, payload.username)) {
        triggeredRules.push({
          id: 1,
          code: 'NAME_MISMATCH',
          title: 'Payee Name Mismatch',
          reason: `The payee name ('${payload.pn}') does not match the UPI ID username ('${payload.username}').`,
          severity: 'medium',
        });
      }
    } else if (!payload.pn && payload.username) {
      triggeredRules.push({
        id: 1,
        code: 'NAME_MISMATCH',
        title: 'Payee Name Missing',
        reason: `The QR code specifies UPI ID '${payload.username}' but provides no verifiable payee name.`,
        severity: 'medium',
      });
    }

    // RULE 2: UPI handle is not in the known-handles list
    if (payload.handle) {
      const handleClean = payload.handle.toLowerCase();
      if (!knownHandles.includes(handleClean)) {
        triggeredRules.push({
          id: 2,
          code: 'UNKNOWN_HANDLE',
          title: 'Unrecognized UPI Handle',
          reason: `The UPI handle '@${payload.handle}' is not recognized in the list of verified bank handles.`,
          severity: 'medium',
        });
      }
    } else if (payload.pa) {
      triggeredRules.push({
        id: 2,
        code: 'UNKNOWN_HANDLE',
        title: 'Missing UPI Handle',
        reason: `The payee address '${payload.pa}' does not contain a valid bank handle.`,
        severity: 'medium',
      });
    }

    // RULE 3: Look-alike of a trusted payee (small edit distance)
    if (payload.pa) {
      const currentPa = payload.pa.toLowerCase();
      const currentUsername = payload.username || currentPa.split('@')[0];

      for (const trusted of trustedPayees) {
        const trustedPa = trusted.vpa.toLowerCase();
        const trustedUser = trustedPa.split('@')[0];

        // If it's an exact match, it is the legitimate trusted payee, not an impersonator
        if (currentPa === trustedPa) {
          continue;
        }

        const distFull = levenshteinDistance(currentPa, trustedPa);
        const distUser = levenshteinDistance(currentUsername, trustedUser);

        if (
          (distFull > 0 && distFull <= lookalikeMaxDistance) ||
          (distUser > 0 && distUser <= lookalikeMaxDistance)
        ) {
          triggeredRules.push({
            id: 3,
            code: 'LOOKALIKE_PAYEE',
            title: 'Look-alike Trusted Payee',
            reason: `The address '${payload.pa}' closely resembles trusted campus payee '${trusted.name}' ('${trusted.vpa}'), which may indicate impersonation.`,
            severity: 'medium',
          });
          break; // Avoid duplicate look-alike triggers
        }
      }
    }

    // RULE 4: "Receive / refund / cashback" wording in the note while QR asks user to pay
    const noteText = `${payload.tn || ''} ${payload.pn || ''}`.toLowerCase();
    const matchedDeceptive: string[] = [];
    for (const kw of DECEPTIVE_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(noteText)) {
        matchedDeceptive.push(kw);
      }
    }
    if (matchedDeceptive.length > 0) {
      triggeredRules.push({
        id: 4,
        code: 'DECEPTIVE_DIRECTION',
        title: 'Receive / Cashback Deception',
        reason: `The note mentions '${matchedDeceptive.join(', ')}', implying you will receive money, but scanning this QR code sends money from your account.`,
        severity: 'high',
      });
    }

    // RULE 5: Unusual amount above configured threshold
    if (payload.am !== undefined && payload.am > amountThreshold) {
      triggeredRules.push({
        id: 5,
        code: 'UNUSUAL_AMOUNT',
        title: 'Unusually High Amount',
        reason: `The payment amount of ₹${payload.am.toFixed(2)} exceeds the standard safety limit of ₹${amountThreshold.toFixed(2)}.`,
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
            reason: `The note includes urgency language ('${ukw}') designed to pressure you into paying quickly without checking.`,
            severity: 'medium',
          });
          break;
        }
      }
    }
  }

  // Verdict calculation:
  // 0 rules = Safe
  // 1 rule = Check first (unless Rule 4 or Rule 6 is triggered)
  // 2+ rules OR Rule 4/6 = Risky
  const hasHighRiskRule = triggeredRules.some(r => r.id === 4 || r.id === 6);
  let verdict: Verdict;

  if (triggeredRules.length === 0) {
    verdict = 'Safe';
  } else if (hasHighRiskRule || triggeredRules.length >= 2) {
    verdict = 'Risky';
  } else {
    verdict = 'Check first';
  }

  let recommendedCheck: string;
  if (verdict === 'Safe') {
    recommendedCheck = 'Details match expected campus payment parameters. Confirm the amount on screen before paying.';
  } else if (verdict === 'Check first') {
    recommendedCheck = 'Review the flagged warning with the recipient or merchant before paying.';
  } else {
    recommendedCheck = 'Do not proceed with this payment. High-risk scam indicators detected. Report or reject this request.';
  }

  return {
    verdict,
    triggeredRules,
    reasons: triggeredRules.map(r => r.reason),
    recommendedCheck,
    riskScore: triggeredRules.length,
  };
}
