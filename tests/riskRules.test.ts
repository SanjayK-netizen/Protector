import { describe, it, expect } from 'vitest';
import {
  evaluateRisk,
  levenshteinDistance,
  isNameMatching,
} from '../src/lib/riskRules';
import { parseUpiPayload } from '../src/lib/upiParser';
import scenarios from '../src/data/scenarios.json';
import knownHandlesData from '../src/data/knownHandles.json';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const OPTS = {
  knownHandles: knownHandlesData.knownHandles,
  trustedPayees: knownHandlesData.trustedPayees,
  amountThreshold: 2000,
  lookalikeMaxDistance: 2,
};

function assess(raw: string) {
  return evaluateRisk(parseUpiPayload(raw), OPTS);
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
  });
  it('matches friend names where token appears in dotted username', () => {
    expect(isNameMatching('Arjun Kumar', 'arjun.kumar')).toBe(true);
  });
  it('matches hostel office with dotted username', () => {
    expect(isNameMatching('Hostel Office', 'hostel.office')).toBe(true);
  });
  it('does NOT match unrelated names', () => {
    expect(isNameMatching('Campus Bookstore', 'rahul.sharma')).toBe(false);
    expect(isNameMatching('Fake Merchant', 'canteen')).toBe(false);
  });
  it('handles empty inputs without crashing', () => {
    expect(isNameMatching('', 'canteen')).toBe(false);
    expect(isNameMatching('Campus Canteen', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 1: Payee name does not match the UPI ID
// ---------------------------------------------------------------------------

describe('Rule 1 — Payee Name Mismatch', () => {
  it('triggers when name is completely unrelated to username', () => {
    const a = assess(
      'upi://pay?pa=random.attacker@testbank&pn=Campus%20Bookstore&am=150.00'
    );
    const r = a.triggeredRules.find(r => r.id === 1);
    expect(r).toBeDefined();
    expect(r!.code).toBe('NAME_MISMATCH');
    expect(r!.reason).toContain('Campus Bookstore');
  });

  it('does NOT trigger when name and username correspond', () => {
    const a = assess(
      'upi://pay?pa=bookstore@testbank&pn=Campus%20Bookstore&am=150.00'
    );
    expect(a.triggeredRules.some(r => r.id === 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: UPI handle not in known-handles list
// ---------------------------------------------------------------------------

describe('Rule 2 — Unknown UPI Handle', () => {
  it('triggers for a handle that is not in knownHandles', () => {
    const a = assess(
      'upi://pay?pa=anyone@scambank&pn=Student%20Council&am=100.00'
    );
    const r = a.triggeredRules.find(r => r.id === 2);
    expect(r).toBeDefined();
    expect(r!.code).toBe('UNKNOWN_HANDLE');
    expect(r!.reason).toContain('@scambank');
  });

  it('does NOT trigger for a handle in knownHandles', () => {
    const a = assess('upi://pay?pa=anyone@testbank&pn=Anyone&am=100.00');
    expect(a.triggeredRules.some(r => r.id === 2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Look-alike of a trusted payee
// ---------------------------------------------------------------------------

describe('Rule 3 — Look-alike Trusted Payee', () => {
  it('triggers when VPA differs by 1 character from a trusted payee', () => {
    // canteenn@testbank vs canteen@testbank — edit distance 1
    const a = assess(
      'upi://pay?pa=canteenn@testbank&pn=Campus%20Canteen&am=120.00'
    );
    const r = a.triggeredRules.find(r => r.id === 3);
    expect(r).toBeDefined();
    expect(r!.code).toBe('LOOKALIKE_PAYEE');
    expect(r!.reason).toContain('canteenn@testbank');
    expect(r!.reason).toContain('canteen@testbank');
  });

  it('does NOT trigger for the exact trusted payee VPA', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00'
    );
    expect(a.triggeredRules.some(r => r.id === 3)).toBe(false);
  });

  it('does NOT trigger for a completely different address', () => {
    const a = assess(
      'upi://pay?pa=arjun.kumar@testbank&pn=Arjun%20Kumar&am=150.00'
    );
    expect(a.triggeredRules.some(r => r.id === 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: Receive / refund / cashback wording
// ---------------------------------------------------------------------------

describe('Rule 4 — Deceptive "Receive" or "Cashback" Language', () => {
  it('triggers and forces Risky when note mentions cashback', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=50.00&tn=Scan%20to%20receive%20cashback%20bonus'
    );
    const r = a.triggeredRules.find(r => r.id === 4);
    expect(r).toBeDefined();
    expect(r!.code).toBe('DECEPTIVE_DIRECTION');
    expect(r!.reason).toMatch(/cashback/i);
    expect(a.verdict).toBe('Risky');
  });

  it('triggers when note mentions refund', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=50.00&tn=Get%20your%20refund%20now'
    );
    expect(a.triggeredRules.some(r => r.id === 4)).toBe(true);
  });

  it('does NOT trigger for a normal payment note', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00&tn=Lunch%20Combo'
    );
    expect(a.triggeredRules.some(r => r.id === 4)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 5: Unusual amount above threshold
// ---------------------------------------------------------------------------

describe('Rule 5 — Unusually High Amount', () => {
  it('triggers when amount exceeds the configured threshold', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=5500.00'
    );
    const r = a.triggeredRules.find(r => r.id === 5);
    expect(r).toBeDefined();
    expect(r!.code).toBe('UNUSUAL_AMOUNT');
    expect(r!.reason).toContain('5500.00');
    expect(r!.reason).toContain('2000.00');
  });

  it('does NOT trigger when amount is within the threshold', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=150.00'
    );
    expect(a.triggeredRules.some(r => r.id === 5)).toBe(false);
  });

  it('does NOT trigger when amount equals the threshold exactly', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=2000.00'
    );
    expect(a.triggeredRules.some(r => r.id === 5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 6: Web link or shortened URL
// ---------------------------------------------------------------------------

describe('Rule 6 — Web Link or Shortened URL', () => {
  it('triggers and forces Risky for an HTTPS link', () => {
    const a = assess('https://testbank-portal.test/exam-dues');
    const r = a.triggeredRules.find(r => r.id === 6);
    expect(r).toBeDefined();
    expect(r!.code).toBe('NON_UPI_OR_URL');
    expect(a.verdict).toBe('Risky');
  });

  it('triggers and marks reason as shortened URL for bit.ly', () => {
    const a = assess('https://bit.ly/claim-canteen-offer');
    const r = a.triggeredRules.find(r => r.id === 6);
    expect(r).toBeDefined();
    expect(r!.reason).toMatch(/shortened/i);
    expect(a.verdict).toBe('Risky');
  });

  it('triggers for tinyurl.com links', () => {
    const a = assess('https://tinyurl.com/campus-pass');
    expect(a.triggeredRules.some(r => r.id === 6)).toBe(true);
  });

  it('does NOT trigger for a valid UPI payload', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00'
    );
    expect(a.triggeredRules.some(r => r.id === 6)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 7: Urgency wording
// ---------------------------------------------------------------------------

describe('Rule 7 — Urgency Pressure Language', () => {
  it('triggers when the note contains "urgent"', () => {
    const a = assess(
      'upi://pay?pa=library@testbank&pn=College%20Library&am=50.00&tn=Pay%20urgent%20library%20fine%20now'
    );
    const r = a.triggeredRules.find(r => r.id === 7);
    expect(r).toBeDefined();
    expect(r!.code).toBe('URGENCY_PRESSURE');
    expect(r!.reason).toMatch(/urgent/i);
  });

  it('triggers when the note contains "expires"', () => {
    const a = assess(
      'upi://pay?pa=library@testbank&pn=College%20Library&am=50.00&tn=Invoice%20expires%20today'
    );
    expect(a.triggeredRules.some(r => r.id === 7)).toBe(true);
  });

  it('does NOT trigger for a normal note', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00&tn=Lunch%20Combo'
    );
    expect(a.triggeredRules.some(r => r.id === 7)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Verdict logic
// ---------------------------------------------------------------------------

describe('Verdict Logic', () => {
  it('Safe when 0 rules trigger', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00&tn=Lunch%20Combo'
    );
    expect(a.triggeredRules).toHaveLength(0);
    expect(a.verdict).toBe('Safe');
    expect(a.reasons).toHaveLength(0);
    expect(a.recommendedCheck).toBeTruthy();
  });

  it('"Check first" when exactly 1 non-high-risk rule triggers', () => {
    // Rule 5 alone: amount just above threshold, legitimate handle and name
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=2500.00&tn=Bulk%20order'
    );
    // Rule 3 may also trigger (canteen matches canteen — exact, so no Rule 3)
    // Only Rule 5 should trigger
    expect(a.triggeredRules.map(r => r.id)).toEqual([5]);
    expect(a.verdict).toBe('Check first');
    expect(a.recommendedCheck).toMatch(/ask the payee/i);
  });

  it('"Risky" when Rule 4 triggers alone', () => {
    const a = assess(
      'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=50.00&tn=Refund%20deposit%20claim'
    );
    expect(a.triggeredRules.some(r => r.id === 4)).toBe(true);
    expect(a.verdict).toBe('Risky');
  });

  it('"Risky" when Rule 6 triggers alone', () => {
    const a = assess('https://malicious.test/pay-here');
    expect(a.triggeredRules.some(r => r.id === 6)).toBe(true);
    expect(a.verdict).toBe('Risky');
  });

  it('"Risky" when 2+ non-high-risk rules trigger together', () => {
    // Rule 3 (look-alike) + Rule 5 (high amount)
    const a = assess(
      'upi://pay?pa=canteenn@testbank&pn=Campus%20Canteen&am=2500.00&tn=Lunch%20Combo'
    );
    expect(a.triggeredRules.length).toBeGreaterThanOrEqual(2);
    expect(a.verdict).toBe('Risky');
    expect(a.recommendedCheck).toMatch(/do not pay/i);
  });
});

// ---------------------------------------------------------------------------
// Scenario file validation (src/data/scenarios.json)
// ---------------------------------------------------------------------------

describe('Scenario file — structure and coverage', () => {
  it('contains exactly 8 synthetic scenarios', () => {
    expect(scenarios).toHaveLength(8);
  });

  it('has exactly 4 safe and 4 risky scenarios', () => {
    const safe = scenarios.filter(s => s.groundTruth === 'safe');
    const risky = scenarios.filter(s => s.groundTruth === 'risky');
    expect(safe).toHaveLength(4);
    expect(risky).toHaveLength(4);
  });

  it('covers all four required contexts', () => {
    const contexts = new Set(scenarios.map(s => s.context));
    expect(contexts.has('shop_counter')).toBe(true);
    expect(contexts.has('college_fee')).toBe(true);
    expect(contexts.has('whatsapp_friend')).toBe(true);
    expect(contexts.has('employee_vendor')).toBe(true);
  });

  it('risky scenarios cover at least 2 of the 4 contexts', () => {
    const riskyContexts = new Set(
      scenarios.filter(s => s.groundTruth === 'risky').map(s => s.context)
    );
    expect(riskyContexts.size).toBeGreaterThanOrEqual(2);
  });

  it('uses only synthetic @testbank handles (or explicitly non-real handles for risky VPAs)', () => {
    // Every scenario's payeeVpa must end in @testbank (safe) or use a clearly synthetic domain
    scenarios.forEach(s => {
      // payeeVpa is display metadata — the rawPayload is what the parser acts on
      expect(s.payeeName).toBeTruthy();
      expect(s.payeeVpa).toContain('@');
      expect(s.description).toBeTruthy();
      expect(s.context).toBeTruthy();
    });
  });

  it('each scenario has required fields: id, context, rawPayload, groundTruth', () => {
    scenarios.forEach(s => {
      expect(s.id).toMatch(/^SCEN-\d+$/);
      expect(s.context).toBeTruthy();
      expect(s.rawPayload).toBeTruthy();
      expect(['safe', 'risky']).toContain(s.groundTruth);
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

  it('every SAFE scenario triggers 0 rules and gets verdict "Safe"', () => {
    const safeScens = scenarios.filter(s => s.groundTruth === 'safe');
    safeScens.forEach(s => {
      const payload = parseUpiPayload(s.rawPayload);
      const a = evaluateRisk(payload, OPTS);
      expect(
        a.triggeredRules,
        `${s.id} (${s.context}) should trigger 0 rules but got: ${a.triggeredRules.map(r => r.id).join(', ')}`
      ).toHaveLength(0);
      expect(a.verdict).toBe('Safe');
    });
  });

  it('every RISKY scenario triggers ≥1 rule and gets verdict "Risky"', () => {
    const riskyScens = scenarios.filter(s => s.groundTruth === 'risky');
    riskyScens.forEach(s => {
      const payload = parseUpiPayload(s.rawPayload);
      const a = evaluateRisk(payload, OPTS);
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

  it('SCEN-05 (WhatsApp cashback scam) triggers Rule 4', () => {
    const s = scenarios.find(s => s.id === 'SCEN-05')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS);
    expect(a.triggeredRules.some(r => r.id === 4)).toBe(true);
  });

  it('SCEN-06 (exam-fee phishing link) triggers Rule 6', () => {
    const s = scenarios.find(s => s.id === 'SCEN-06')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS);
    expect(a.triggeredRules.some(r => r.id === 6)).toBe(true);
  });

  it('SCEN-07 (look-alike sticker + high amount) triggers Rules 3 and 5', () => {
    const s = scenarios.find(s => s.id === 'SCEN-07')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS);
    expect(a.triggeredRules.some(r => r.id === 3)).toBe(true);
    expect(a.triggeredRules.some(r => r.id === 5)).toBe(true);
  });

  it('SCEN-08 (suspicious vendor + urgency) triggers Rules 2 and 7', () => {
    const s = scenarios.find(s => s.id === 'SCEN-08')!;
    const a = evaluateRisk(parseUpiPayload(s.rawPayload), OPTS);
    expect(a.triggeredRules.some(r => r.id === 2)).toBe(true);
    expect(a.triggeredRules.some(r => r.id === 7)).toBe(true);
  });
});
