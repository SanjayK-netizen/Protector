import { describe, it, expect } from 'vitest';
import { evaluateRisk, levenshteinDistance, isNameMatching } from '../src/lib/riskRules';
import { parseUpiPayload } from '../src/lib/upiParser';
import scenarios from '../src/data/scenarios.json';
import knownHandlesData from '../src/data/knownHandles.json';

describe('Explainable Risk Rules Engine (riskRules)', () => {
  const defaultOpts = {
    knownHandles: knownHandlesData.knownHandles,
    trustedPayees: knownHandlesData.trustedPayees,
    amountThreshold: 2000,
    lookalikeMaxDistance: 2,
  };

  describe('Rule 1: Payee Name vs UPI ID Mismatch', () => {
    it('triggers Rule 1 when payee name is completely unrelated to the UPI username', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=random.attacker@testbank&pn=Campus%20Bookstore&am=150.00&cu=INR'
      );
      const assessment = evaluateRisk(payload, defaultOpts);

      const rule1 = assessment.triggeredRules.find(r => r.id === 1);
      expect(rule1).toBeDefined();
      expect(rule1?.code).toBe('NAME_MISMATCH');
      expect(rule1?.reason).toContain('Campus Bookstore');
      expect(rule1?.reason).toContain('random.attacker');
    });

    it('does not trigger Rule 1 when name and username correspond', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=bookstore@testbank&pn=Campus%20Bookstore&am=150.00&cu=INR'
      );
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.some(r => r.id === 1)).toBe(false);
    });
  });

  describe('Rule 2: Unknown UPI Handle', () => {
    it('triggers Rule 2 when UPI handle is not in knownHandles', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=student@unknownscambank&pn=Student%20Council&am=100.00'
      );
      const assessment = evaluateRisk(payload, defaultOpts);

      const rule2 = assessment.triggeredRules.find(r => r.id === 2);
      expect(rule2).toBeDefined();
      expect(rule2?.code).toBe('UNKNOWN_HANDLE');
      expect(rule2?.reason).toContain('@unknownscambank');
    });

    it('does not trigger Rule 2 for verified handles in knownHandles', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=student@testbank&pn=Student%20Council&am=100.00'
      );
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.some(r => r.id === 2)).toBe(false);
    });
  });

  describe('Rule 3: Look-alike of Trusted Payee', () => {
    it('triggers Rule 3 when UPI address has small edit distance from a trusted payee', () => {
      // trusted is "canteen@testbank", attacker uses "canteenn@testbank" (edit distance 1)
      const payload = parseUpiPayload(
        'upi://pay?pa=canteenn@testbank&pn=Campus%20Canteen&am=120.00'
      );
      const assessment = evaluateRisk(payload, defaultOpts);

      const rule3 = assessment.triggeredRules.find(r => r.id === 3);
      expect(rule3).toBeDefined();
      expect(rule3?.code).toBe('LOOKALIKE_PAYEE');
      expect(rule3?.reason).toContain('canteenn@testbank');
      expect(rule3?.reason).toContain('canteen@testbank');
    });

    it('does not trigger Rule 3 for the legitimate trusted payee (exact match)', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00'
      );
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.some(r => r.id === 3)).toBe(false);
    });
  });

  describe('Rule 4: Receive / Refund / Cashback Wording', () => {
    it('triggers Rule 4 and forces Risky verdict when note mentions cashback or refund', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=fest@testbank&pn=Fest%20Admin&am=300.00&tn=Scan%20to%20receive%20cashback%20bonus'
      );
      const assessment = evaluateRisk(payload, defaultOpts);

      const rule4 = assessment.triggeredRules.find(r => r.id === 4);
      expect(rule4).toBeDefined();
      expect(rule4?.code).toBe('DECEPTIVE_DIRECTION');
      expect(assessment.verdict).toBe('Risky');
      expect(rule4?.reason).toContain('cashback');
    });
  });

  describe('Rule 5: Unusual Amount Above Threshold', () => {
    it('triggers Rule 5 when amount exceeds configured threshold', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=5500.00'
      );
      const assessment = evaluateRisk(payload, { ...defaultOpts, amountThreshold: 2000 });

      const rule5 = assessment.triggeredRules.find(r => r.id === 5);
      expect(rule5).toBeDefined();
      expect(rule5?.code).toBe('UNUSUAL_AMOUNT');
      expect(rule5?.reason).toContain('5500.00');
    });

    it('does not trigger Rule 5 when amount is within threshold', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=150.00'
      );
      const assessment = evaluateRisk(payload, { ...defaultOpts, amountThreshold: 2000 });
      expect(assessment.triggeredRules.some(r => r.id === 5)).toBe(false);
    });
  });

  describe('Rule 6: Web Link or Shortened URL', () => {
    it('triggers Rule 6 and forces Risky verdict on external web URLs', () => {
      const payload = parseUpiPayload('https://testbank-portal.test/exam-login');
      const assessment = evaluateRisk(payload, defaultOpts);

      const rule6 = assessment.triggeredRules.find(r => r.id === 6);
      expect(rule6).toBeDefined();
      expect(rule6?.code).toBe('NON_UPI_OR_URL');
      expect(assessment.verdict).toBe('Risky');
    });

    it('triggers Rule 6 and forces Risky verdict on shortened URLs', () => {
      const payload = parseUpiPayload('https://bit.ly/claim-canteen-discount');
      const assessment = evaluateRisk(payload, defaultOpts);

      const rule6 = assessment.triggeredRules.find(r => r.id === 6);
      expect(rule6).toBeDefined();
      expect(rule6?.reason).toContain('shortened URL');
      expect(assessment.verdict).toBe('Risky');
    });
  });

  describe('Rule 7: Urgency Wording in Note', () => {
    it('triggers Rule 7 when urgency keywords appear in transaction note', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=library@testbank&pn=College%20Library&am=50.00&tn=Pay%20urgent%20penalty%20now'
      );
      const assessment = evaluateRisk(payload, defaultOpts);

      const rule7 = assessment.triggeredRules.find(r => r.id === 7);
      expect(rule7).toBeDefined();
      expect(rule7?.code).toBe('URGENCY_PRESSURE');
      expect(rule7?.reason).toContain('urgent');
    });
  });

  describe('Verdict Determination Logic', () => {
    it('returns "Safe" when 0 rules trigger', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00&tn=Lunch%20Combo'
      );
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.length).toBe(0);
      expect(assessment.verdict).toBe('Safe');
      expect(assessment.reasons.length).toBe(0);
      expect(assessment.recommendedCheck).toContain('Details match expected');
    });

    it('returns "Check first" when exactly 1 non-high-risk rule triggers', () => {
      // Rule 5 alone (unusual amount: 2500 > 2000, but legit payee and handle)
      const payload = parseUpiPayload(
        'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=2500.00&tn=Lunch%20Combo'
      );
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.length).toBe(1);
      expect(assessment.triggeredRules[0].id).toBe(5);
      expect(assessment.verdict).toBe('Check first');
      expect(assessment.recommendedCheck).toContain('Review the flagged warning');
    });

    it('returns "Risky" when multiple rules trigger', () => {
      // Triggers Rule 1 (name mismatch) + Rule 5 (high amount)
      const payload = parseUpiPayload(
        'upi://pay?pa=stranger@testbank&pn=Campus%20Canteen&am=4500.00&tn=Event%20Fee'
      );
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.length).toBeGreaterThanOrEqual(2);
      expect(assessment.verdict).toBe('Risky');
    });

    it('returns "Risky" when Rule 4 triggers alone', () => {
      const payload = parseUpiPayload(
        'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=50.00&tn=Refund%20deposit'
      );
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.some(r => r.id === 4)).toBe(true);
      expect(assessment.verdict).toBe('Risky');
    });

    it('returns "Risky" when Rule 6 triggers alone', () => {
      const payload = parseUpiPayload('https://bit.ly/student-meal-card');
      const assessment = evaluateRisk(payload, defaultOpts);
      expect(assessment.triggeredRules.some(r => r.id === 6)).toBe(true);
      expect(assessment.verdict).toBe('Risky');
    });
  });

  describe('Scenarios Verification (src/data/scenarios.json)', () => {
    it('contains exactly 6 synthetic scenarios (3 safe, 3 risky)', () => {
      expect(scenarios).toHaveLength(6);

      const safeScenarios = scenarios.filter(s => s.groundTruth === 'safe');
      const riskyScenarios = scenarios.filter(s => s.groundTruth === 'risky');

      expect(safeScenarios).toHaveLength(3);
      expect(riskyScenarios).toHaveLength(3);
    });

    it('uses only synthetic data with @testbank handles', () => {
      scenarios.forEach(scen => {
        expect(scen.payeeVpa).toContain('@testbank');
        expect(scen.payeeName).toBeDefined();
        expect(scen.description).toBeDefined();
      });
    });

    it('ensures every safe scenario triggers NO rules and results in "Safe"', () => {
      const safeScenarios = scenarios.filter(s => s.groundTruth === 'safe');
      safeScenarios.forEach(scen => {
        const payload = parseUpiPayload(scen.rawPayload);
        const assessment = evaluateRisk(payload, defaultOpts);

        expect(assessment.triggeredRules).toHaveLength(0);
        expect(assessment.verdict).toBe('Safe');
      });
    });

    it('ensures every risky scenario triggers AT LEAST ONE rule', () => {
      const riskyScenarios = scenarios.filter(s => s.groundTruth === 'risky');
      riskyScenarios.forEach(scen => {
        const payload = parseUpiPayload(scen.rawPayload);
        const assessment = evaluateRisk(payload, defaultOpts);

        expect(assessment.triggeredRules.length).toBeGreaterThanOrEqual(1);
        expect(assessment.reasons.length).toBeGreaterThanOrEqual(1);
        expect(assessment.verdict).not.toBe('Safe');
      });
    });
  });

  describe('Utility Functions', () => {
    it('levenshteinDistance computes correct distance', () => {
      expect(levenshteinDistance('canteen', 'canteen')).toBe(0);
      expect(levenshteinDistance('canteen', 'canteenn')).toBe(1);
      expect(levenshteinDistance('canten', 'canteen')).toBe(1);
      expect(levenshteinDistance('canteen', 'library')).toBe(7);
    });

    it('isNameMatching matches related tokens correctly', () => {
      expect(isNameMatching('Campus Canteen', 'canteen')).toBe(true);
      expect(isNameMatching('College Library', 'library')).toBe(true);
      expect(isNameMatching('Campus Bookstore', 'rahul.sharma')).toBe(false);
    });
  });
});
