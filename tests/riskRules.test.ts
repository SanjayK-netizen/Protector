import { describe, it, expect } from 'vitest';
import {
  evaluateRisk,
  levenshteinDistance,
  isNameMatching,
} from '../src/lib/riskRules';
import { parseUpiPayload } from '../src/lib/upiParser';
import { AMOUNT_THRESHOLD_MAP, UserContext } from '../src/config';
import scenarios from '../src/data/scenarios.json';
import knownHandlesData from '../src/data/knownHandles.json';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const OPTS = {
  knownHandles: [
    ...knownHandlesData.knownHandles,
    ...knownHandlesData.publicBankHandles,
  ],
  trustedPayees: knownHandlesData.trustedPayees,
  lookalikeMaxDistance: 2,
};

function assess(raw: string, context: UserContext = 'general') {
  return evaluateRisk(parseUpiPayload(raw), OPTS, context);
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

describe('Utility: levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('canteen', 'canteen')).toBe(0);
  });
  it('returns 1 for a single insertion', () => {
    expect(levenshteinDistance('canteen', 'canteenn')).toBe(1);
  });
  it('returns 1 for a single deletion', () => {
    expect(levenshteinDistance('canten', 'canteen')).toBe(1);
  });
  it('returns correct distance for completely different strings', () => {
    expect(levenshteinDistance('canteen', 'library')).toBe(7);
  });
  it('handles empty strings', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('', '')).toBe(0);
  });
});

describe('Utility: isNameMatching', () => {
  it('matches when a name token appears in the username', () => {
    expect(isNameMatching('Campus Canteen', 'canteen')).toBe(true);
    expect(isNameMatching('College Library', 'library')).toBe(true);
    expect(isNameMatching('Grocery Store', 'grocery')).toBe(true);
  });
  it('matches friend names where token appears in dotted username', () => {
    expect(isNameMatching('Arjun Kumar', 'arjun.kumar')).toBe(true);
  });
  it('matches workplace accounts with dotted username', () => {
    expect(isNameMatching('Vendor Accounts', 'vendor.accounts')).toBe(true);
    expect(isNameMatching('Office Canteen', 'office.canteen')).toBe(true);
  });
  it('does NOT match unrelated names', () => {
    expect(isNameMatching('Corporate Supplies', 'malicious.actor')).toBe(false);
    expect(isNameMatching('Grocery Store', 'rahul.sharma')).toBe(false);
  });
  it('handles empty inputs without crashing', () => {
    expect(isNameMatching('', 'canteen')).toBe(false);
    expect(isNameMatching('Grocery Store', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 1: Payee name does not match the UPI ID
// ---------------------------------------------------------------------------

describe('Rule 1 — Payee Name Mismatch', () => {
  it('triggers when name is completely unrelated to username', () => {
    const a = assess(
      'upi://pay?pa=random.attacker@testbank&pn=Grocery%20Store&am=150.00'
    );
    const r = a.triggeredRules.find(r => r.id === 1);
    expect(r).toBeDefined();
    expect(r!.code).toBe('NAME_MISMATCH');
    expect(r!.reason).toContain('Grocery Store');
  });

  it('triggers when payee name is missing from payload', () => {
    const a = assess('upi://pay?pa=unknown.vpa@testbank&am=150.00');
    const r = a.triggeredRules.find(r => r.id === 1);
    expect(r).toBeDefined();
    expect(r!.code).toBe('NAME_MISMATCH');
  });

  it('does NOT trigger when name and username correspond', () => {
    const a = assess(
      'upi://pay?pa=grocery@testbank&pn=Grocery%20Store&am=150.00'
    );
    expect(a.triggeredRules.some(r => r.id === 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: UPI handle not in known-handles list
// ---------------------------------------------------------------------------

describe('Rule 2 — Unknown UPI Handle', () => {
  it('triggers for a handle that is not in knownHandles or publicBankHandles', () => {
    const a = assess(
      'upi://pay?pa=scammer@fakebank&pn=Scammer&am=100.00'
    );
    const r = a.triggeredRules.find(r => r.id === 2);
    expect(r).toBeDefined();
    expect(r!.code).toBe('UNKNOWN_HANDLE');
    expect(r!.reason).toContain('@fakebank');
  });

  it('does NOT trigger for standard synthetic handles', () => {
    const a = assess('upi://pay?pa=user@testbank&pn=User&am=50.00');
    expect(a.triggeredRules.some(r => r.id === 2)).toBe(false);

    const b = assess('upi://pay?pa=user@testupi&pn=User&am=50.00');
    expect(b.triggeredRules.some(r => r.id === 2)).toBe(false);
  });

  it('does NOT trigger for public bank handles', () => {
    const publicHandles = ['oksbi', 'okhdfcbank', 'okicici', 'okaxis', 'ybl', 'paytm', 'ibl', 'axl'];
    for (const h of publicHandles) {
      const a = assess(`upi://pay?pa=store@${h}&pn=Store&am=50.00`);
      expect(a.triggeredRules.some(r => r.id === 2)).toBe(false);
    }
  });

  it('triggers when UPI address has no @ symbol', () => {
    const a = assess('upi://pay?pa=justausername&pn=User&am=50.00');
    const r = a.triggeredRules.find(r => r.id === 2);
    expect(r).toBeDefined();
    expect(r!.code).toBe('UNKNOWN_HANDLE');
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Look-alike of a trusted payee
// ---------------------------------------------------------------------------

describe('Rule 3 — Look-alike of a Trusted Payee', () => {
  it('triggers on look-alike address with 1 insertion', () => {
    const a = assess(
      'upi://pay?pa=canteenn@testbank&pn=Campus%20Canteen&am=120.00'
    );
    const r = a.triggeredRules.find(r => r.id === 3);
    expect(r).toBeDefined();
    expect(r!.code).toBe('LOOKALIKE_PAYEE');
    expect(r!.reason).toContain('canteen@testbank');
    expect(r!.reason).toContain('a trusted payee');
  });

  it('triggers on look-alike address for retail trusted payee', () => {
    const a = assess(
      'upi://pay?pa=groceryy@testbank&pn=Grocery%20Store&am=120.00'
    );
    const r = a.triggeredRules.find(r => r.id === 3);
    expect(r).toBeDefined();
    expect(r!.code).toBe('LOOKALIKE_PAYEE');
    expect(r!.reason).toContain('grocery@testbank');
  });

  it('does NOT trigger for exact match of a trusted payee', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00'
    );
    expect(a.triggeredRules.some(r => r.id === 3)).toBe(false);
  });

  it('does NOT trigger for VPAs with edit distance > lookalikeMaxDistance', () => {
    const a = assess(
      'upi://pay?pa=unrelatedperson@testbank&pn=Unrelated%20Person&am=100.00'
    );
    expect(a.triggeredRules.some(r => r.id === 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: Misleading "Receive" / "Cashback" wording in note only
// ---------------------------------------------------------------------------

describe('Rule 4 — Deceptive Direction Language', () => {
  it('triggers for strong "you receive money" keywords in note', () => {
    const keywords = [
      'receive',
      'refund',
      'cashback',
      'cash-back',
      'reward',
      'rewards',
      'prize',
      'winner',
    ];
    for (const kw of keywords) {
      const a = assess(
        `upi://pay?pa=user@testbank&pn=User&am=100.00&tn=Click%20to%20${kw}%20now`
      );
      const r = a.triggeredRules.find(r => r.id === 4);
      expect(r, `Failed for keyword: ${kw}`).toBeDefined();
      expect(r!.code).toBe('DECEPTIVE_DIRECTION');
    }
  });

  it('checks note ONLY, not payee name', () => {
    // Payee name contains "Cashback" but note does not have deceptive words
    const a = assess(
      'upi://pay?pa=cashback@testbank&pn=Cashback%20Store&am=100.00&tn=Shopping%20bill'
    );
    expect(a.triggeredRules.some(r => r.id === 4)).toBe(false);
  });

  it('does NOT trigger for excluded neutral words: deposit, credit, claim, bonus, won', () => {
    const neutralNotes = [
      'Room deposit',
      'Security deposit',
      'Credit card bill',
      'Claim reimbursement',
      'Annual bonus payout',
      'Team won competition',
    ];
    for (const note of neutralNotes) {
      const a = assess(
        `upi://pay?pa=user@testbank&pn=User&am=100.00&tn=${encodeURIComponent(note)}`
      );
      expect(
        a.triggeredRules.some(r => r.id === 4),
        `Rule 4 incorrectly triggered for note: "${note}"`
      ).toBe(false);
      expect(a.verdict).not.toBe('Risky');
    }
  });
});

// ---------------------------------------------------------------------------
// Rule 5: Context-aware amount thresholds
// ---------------------------------------------------------------------------

describe('Rule 5 — Context-Aware Amount Threshold', () => {
  it('has configured threshold assumptions per context', () => {
    expect(AMOUNT_THRESHOLD_MAP.student).toBe(2000);
    expect(AMOUNT_THRESHOLD_MAP.employee).toBe(10000);
    expect(AMOUNT_THRESHOLD_MAP.shop_customer).toBe(5000);
    expect(AMOUNT_THRESHOLD_MAP.merchant).toBe(25000);
    expect(AMOUNT_THRESHOLD_MAP.general).toBe(5000);
  });

  it('flags the same amount for student context but NOT for employee context', () => {
    const raw = 'upi://pay?pa=user@testbank&pn=User&am=3000.00';

    // Student limit is 2000 -> 3000 is above
    const studentAssessment = assess(raw, 'student');
    expect(studentAssessment.triggeredRules.some(r => r.id === 5)).toBe(true);

    // Employee limit is 10000 -> 3000 is below
    const employeeAssessment = assess(raw, 'employee');
    expect(employeeAssessment.triggeredRules.some(r => r.id === 5)).toBe(false);

    // Shop customer limit is 5000 -> 3000 is below
    const customerAssessment = assess(raw, 'shop_customer');
    expect(customerAssessment.triggeredRules.some(r => r.id === 5)).toBe(false);
  });

  it('flags amount for shop_customer context but NOT for merchant context', () => {
    const raw = 'upi://pay?pa=user@testbank&pn=User&am=6000.00';

    // shop_customer limit is 5000 -> 6000 triggers Rule 5
    const customerAssessment = assess(raw, 'shop_customer');
    expect(customerAssessment.triggeredRules.some(r => r.id === 5)).toBe(true);

    // merchant limit is 25000 -> 6000 does NOT trigger Rule 5
    const merchantAssessment = assess(raw, 'merchant');
    expect(merchantAssessment.triggeredRules.some(r => r.id === 5)).toBe(false);
  });

  it('defaults to general context (limit 5000) when omitted', () => {
    const under = assess('upi://pay?pa=user@testbank&pn=User&am=4900.00');
    expect(under.triggeredRules.some(r => r.id === 5)).toBe(false);

    const over = assess('upi://pay?pa=user@testbank&pn=User&am=5500.00');
    expect(over.triggeredRules.some(r => r.id === 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule 6: Web links, shortened URLs, and unsupported payloads
// ---------------------------------------------------------------------------

describe('Rule 6 — Web Links, Shortened URLs & Unsupported Schemes', () => {
  it('triggers for standard web URLs with high severity (Risky)', () => {
    const a = assess('https://testbank-portal.test/pay');
    const r = a.triggeredRules.find(r => r.id === 6);
    expect(r).toBeDefined();
    expect(a.verdict).toBe('Risky');
  });

  it('gives non-URL garbage a plain-English invalid UPI reason', () => {
    const a = assess('not a UPI address or web link');
    const r = a.triggeredRules.find(rule => rule.id === 6);
    expect(r).toBeDefined();
    expect(r!.title).toBe('Invalid QR Payload');
    expect(r!.reason).toBe('This QR code is not a valid UPI payment code.');
    expect(r!.reason).not.toContain('web link');
    expect(a.verdict).toBe('Risky');
  });

  it('triggers for shortened URLs with a specific warning', () => {
    const a = assess('https://bit.ly/pay-fees');
    const r = a.triggeredRules.find(r => r.id === 6);
    expect(r).toBeDefined();
    expect(r!.reason).toContain('shortened URL');
    expect(a.verdict).toBe('Risky');
  });

  it('triggers with clear parser reason for upi://collect requests, NOT web link reason', () => {
    const a = assess('upi://collect?pa=scammer@testbank&am=500.00');
    const r = a.triggeredRules.find(r => r.id === 6);
    expect(r).toBeDefined();
    expect(r!.reason).toContain('collect');
    expect(r!.reason).not.toContain('web link');
    expect(a.verdict).toBe('Risky');
  });

  it('triggers when a UPI payload embeds an external url parameter', () => {
    const a = assess(
      'upi://pay?pa=user@testbank&pn=User&am=100.00&url=https%3A%2F%2Fexternal-phish.test'
    );
    const r = a.triggeredRules.find(r => r.id === 6);
    expect(r).toBeDefined();
    expect(a.verdict).toBe('Risky');
  });
});

// ---------------------------------------------------------------------------
// Rule 7: Urgency wording with whole-word matching
// ---------------------------------------------------------------------------

describe('Rule 7 — Urgency Language (Whole Word / Phrase Matching)', () => {
  it('triggers for whole words like urgent, expires, penalty', () => {
    const a = assess(
      'upi://pay?pa=user@testbank&pn=User&am=100.00&tn=Urgent%20payment%20needed'
    );
    expect(a.triggeredRules.some(r => r.id === 7)).toBe(true);
  });

  it('does NOT trigger on "Fine Arts"', () => {
    const a = assess(
      'upi://pay?pa=user@testbank&pn=User&am=100.00&tn=Fine%20Arts%20Club%20fee'
    );
    expect(
      a.triggeredRules.some(r => r.id === 7),
      '"Fine Arts" should not trigger Rule 7'
    ).toBe(false);
  });

  it('does NOT trigger on "ready in 15 min"', () => {
    const a = assess(
      'upi://pay?pa=user@testbank&pn=User&am=100.00&tn=Order%20ready%20in%2015%20min'
    );
    expect(
      a.triggeredRules.some(r => r.id === 7),
      '"ready in 15 min" should not trigger Rule 7 (5 min keyword)'
    ).toBe(false);
  });

  it('triggers on exact "5 min" urgency phrase', () => {
    const a = assess(
      'upi://pay?pa=user@testbank&pn=User&am=100.00&tn=Offer%20expires%20in%205%20min'
    );
    expect(a.triggeredRules.some(r => r.id === 7)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parser errors in risk engine
// ---------------------------------------------------------------------------

describe('Parser Errors in Risk Engine', () => {
  it('flags negative amount as Risky / Check first, NOT silent Safe', () => {
    const a = assess('upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=-150.00');
    expect(a.verdict).not.toBe('Safe');
    expect(a.triggeredRules.length).toBeGreaterThanOrEqual(1);
    expect(a.triggeredRules.find(rule => rule.code === 'INVALID_AMOUNT')?.title).toBe('Invalid amount');
    expect(a.triggeredRules.some(rule => rule.title === 'Unusually High Payment Amount')).toBe(false);
  });

  it('flags non-numeric invalid amount as not Safe', () => {
    const a = assess('upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=abc');
    expect(a.verdict).not.toBe('Safe');
    expect(a.triggeredRules.length).toBeGreaterThanOrEqual(1);
    expect(a.triggeredRules.find(rule => rule.code === 'INVALID_AMOUNT')?.title).toBe('Invalid amount');
    expect(a.triggeredRules.some(rule => rule.title === 'Unusually High Payment Amount')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Neutral Wording Verification
// ---------------------------------------------------------------------------

describe('Neutral Wording Verification', () => {
  it('safe recommendation uses neutral language', () => {
    const a = assess('upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=50.00');
    expect(a.verdict).toBe('Safe');
    expect(a.recommendedCheck).toBe(
      'Details match a trusted payee. Confirm the amount on screen before paying.'
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario suite integrity
// ---------------------------------------------------------------------------

describe('Scenarios Data Set Integrity (10 Scenarios)', () => {
  it('contains exactly 10 synthetic scenarios', () => {
    expect(scenarios).toHaveLength(10);
  });

  it('has exactly 5 safe and 5 risky scenarios', () => {
    const safe = scenarios.filter(s => s.groundTruth === 'safe');
    const risky = scenarios.filter(s => s.groundTruth === 'risky');
    expect(safe).toHaveLength(5);
    expect(risky).toHaveLength(5);
  });

  it('covers at least 4 different contexts overall', () => {
    const allContexts = new Set(scenarios.map(s => s.context));
    expect(allContexts.size).toBeGreaterThanOrEqual(4);
  });

  it('covers at least 3 different contexts in risky scenarios', () => {
    const riskyContexts = new Set(
      scenarios.filter(s => s.groundTruth === 'risky').map(s => s.context)
    );
    expect(riskyContexts.size).toBeGreaterThanOrEqual(3);
  });

  it('each scenario has required fields: id, context, setting, rawPayload, groundTruth', () => {
    scenarios.forEach(s => {
      expect(s.id).toMatch(/^SCEN-\d+$/);
      expect(s.context).toBeTruthy();
      expect((s as any).setting).toBeTruthy();
      expect(s.rawPayload).toBeTruthy();
      expect(['safe', 'risky']).toContain(s.groundTruth);
    });
  });

  it('rules 1, 3, 4, 5, 6 and 7 appear in engine-detectable risky scenarios', () => {
    const triggeredInRisky = new Set<number>();
    const riskyScens = scenarios.filter(s => s.groundTruth === 'risky' && !s.knownLimitation);

    riskyScens.forEach(s => {
      const payload = parseUpiPayload(s.rawPayload);
      const assessment = evaluateRisk(payload, OPTS, s.context as UserContext);
      assessment.triggeredRules.forEach(r => triggeredInRisky.add(r.id));
    });

    [1, 3, 4, 5, 6, 7].forEach(ruleId => {
      expect(
        triggeredInRisky.has(ruleId),
        `Rule ${ruleId} did not appear in any risky scenario`
      ).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Per-scenario verdict verification (ground truth must match computed verdict)
// ---------------------------------------------------------------------------

describe('Scenario ground-truth vs computed verdict', () => {
  const VERDICT_MAP: Record<string, 'Safe' | 'Risky'> = {
    safe: 'Safe',
    risky: 'Risky',
  };

  it('every ordinary SAFE scenario triggers 0 rules and gets verdict "Safe"', () => {
    const safeScens = scenarios.filter(s => s.groundTruth === 'safe' && s.id !== 'SCEN-09');
    safeScens.forEach(s => {
      const payload = parseUpiPayload(s.rawPayload);
      const a = evaluateRisk(payload, OPTS, s.context as UserContext);
      expect(
        a.triggeredRules,
        `${s.id} (${s.context}) should trigger 0 rules but got: ${a.triggeredRules.map(r => r.id).join(', ')}`
      ).toHaveLength(0);
      expect(a.verdict).toBe('Safe');
    });
  });

  it('every engine-detectable RISKY scenario triggers ≥1 rule and gets verdict "Risky"', () => {
    const riskyScens = scenarios.filter(s => s.groundTruth === 'risky' && !s.knownLimitation);
    riskyScens.forEach(s => {
      const payload = parseUpiPayload(s.rawPayload);
      const a = evaluateRisk(payload, OPTS, s.context as UserContext);
      expect(
        a.triggeredRules.length,
        `${s.id} (${s.context}) should trigger ≥1 rule but triggered none`
      ).toBeGreaterThanOrEqual(1);
      expect(
        a.verdict,
        `${s.id} (${s.context}) expected "Risky" but got "${a.verdict}"`
      ).toBe(VERDICT_MAP[s.groundTruth]);
    });
  });

  it('SCEN-02 (safe room deposit) does not trigger Rule 4', () => {
    const s = scenarios.find(s => s.id === 'SCEN-02')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(a.triggeredRules).toHaveLength(0);
    expect(a.verdict).toBe('Safe');
  });

  it('SCEN-03 (safe near-threshold payment) does not trigger Rule 5', () => {
    const s = scenarios.find(s => s.id === 'SCEN-03')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(a.triggeredRules).toHaveLength(0);
    expect(a.verdict).toBe('Safe');
  });

  it('SCEN-05 (order adjustment) triggers only Rule 4 for mild refund wording', () => {
    const s = scenarios.find(s => s.id === 'SCEN-05')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(s.note).toMatch(/refund/i);
    expect(s.payeeName).not.toMatch(/cashback/i);
    expect(a.triggeredRules.map(r => r.id)).toEqual([4]);
  });

  it('SCEN-06 (phishing link) triggers Rule 6', () => {
    const s = scenarios.find(s => s.id === 'SCEN-06')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(a.triggeredRules.some(r => r.id === 6)).toBe(true);
  });

  it('SCEN-07 (look-alike + high amount) triggers Rules 3 and 5', () => {
    const s = scenarios.find(s => s.id === 'SCEN-07')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(a.triggeredRules.some(r => r.id === 3)).toBe(true);
    expect(a.triggeredRules.some(r => r.id === 5)).toBe(true);
  });

  it('SCEN-08 (look-alike vendor address + urgency + name mismatch) triggers Rules 1, 3, 7', () => {
    const s = scenarios.find(s => s.id === 'SCEN-08')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(a.triggeredRules.some(r => r.id === 1)).toBe(true);
    expect(a.triggeredRules.some(r => r.id === 3)).toBe(true);
    expect(a.triggeredRules.some(r => r.id === 7)).toBe(true);
  });

  it('SCEN-09 returns Check first for exactly one medium amount rule in merchant context', () => {
    const s = scenarios.find(s => s.id === 'SCEN-09')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(s.context).toBe('merchant');
    expect(a.verdict).toBe('Check first');
    expect(a.triggeredRules).toHaveLength(1);
    expect(a.triggeredRules[0].id).toBe(5);
    expect(a.triggeredRules[0].severity).toBe('medium');
  });

  it('SCEN-10 is a known limitation: an exact trusted VPA copy returns Safe', () => {
    const s = scenarios.find(s => s.id === 'SCEN-10')!;
    expect(s.knownLimitation).toBe(true);
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS, s.context as UserContext);
    expect(a.verdict).toBe('Safe');
    expect(a.triggeredRules).toHaveLength(0);
  });
});
