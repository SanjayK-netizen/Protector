# QRShield (Protector)

A pre-payment safety check for QR / UPI payment requests. It reads the text inside a QR code, applies seven explainable rules, and shows a plain-language verdict **before** the user pays: **Safe**, **Check first** or **Risky**.

> **Synthetic data only.** Every payee, UPI ID and payment in this repository is made up for testing. The app never makes a real payment, never contacts a bank, and has no network calls or analytics. Camera scanning and image uploads are processed entirely offline in the browser.

> **Research prototype, not a safety guarantee.** A "Safe" verdict does not prove a payee is genuine. See [Known limitations](#known-limitations).

Built for the School of Innovation (SoI) Innovation Project, Cyber Security vertical.

## Status

| Item | State |
| --- | --- |
| Seven-rule engine and UPI parser | Built, tested |
| 10 synthetic test scenarios (5 safe, 5 risky) | Built |
| Dashboard, Inspect, Compare, Test session, History and Limitations screens | Built |
| Baseline vs QRShield modes | Built |
| Local test history and CSV export | Built |
| Automated tests | **93 passed** (9 test files) |
| Production build | Passes |
| Human testing with participants | **Not done** |
| Live camera scanning | **Built** (offline jsQR decoding with camera stream & image upload fallback) |
| Real payment verification | **Not built** |

## Run it

Requires Node.js 18 or newer.

```bash
git clone https://github.com/SanjayK-netizen/Protector.git
cd Protector
npm install
npm run dev        # opens a local dev server (Vite)
```

Other commands:

```bash
npm test           # run the automated tests (expect: 9 files, 93 tests passed)
npm run build      # type-check and build to dist/
npm run preview    # serve the built app locally
```

## How it works

1. `src/lib/upiParser.ts` parses a `upi://pay` link into payee name, UPI ID, amount and note. Web links, shortened links and invalid text are flagged.
2. `src/lib/riskRules.ts` applies the seven rules, using the user's context (student, employee, shop customer, merchant or general).
3. The app shows the verdict and the plain-language reasons for it.

### The seven rules

1. Payee name does not match the UPI ID.
2. Unknown UPI handle.
3. UPI ID is a look-alike of a trusted payee (edit distance of 2 or less).
4. Receive, refund or cashback wording in the note (note only).
5. Unusual amount for the user's context.
6. Web link, shortened link or invalid QR.
7. Urgency wording (whole words only).

**Verdict:** no rule triggered is Safe. One rule is Check first, unless it is rule 4 or 6. Two or more rules, or rule 4 or 6, is Risky.

### Placeholder amount limits (rule 5)

Student ₹2,000 · Employee ₹10,000 · Shop customer ₹5,000 · Merchant ₹25,000 · General ₹5,000. These are **unvalidated assumptions** set in `src/config.ts`, not findings from user research.

## Baseline and QRShield modes

- **Baseline:** shows the payee, UPI ID, amount and note only, with no verdict and no reasons. This mimics a normal payment screen and **never calls the rule engine**; a test enforces this.
- **QRShield:** shows the verdict and reasons from the engine.

The Test session screen runs the 10 scenarios in both modes and saves results to local browser history. History can be exported as CSV. History stays in this browser only and may be lost if storage is cleared or blocked.

## Engine-level results (synthetic scenarios, not human testing)

- 10 scenarios: 5 safe and 5 risky.
- 4 of 5 risky scenarios flagged. The one miss is SCEN-10, the known exact-copy case below. All 4 in-scope risky scenarios were flagged.
- No Risky verdict on the 5 safe scenarios; 1 Check first (SCEN-09, a merchant payment of ₹26,000 above the ₹25,000 placeholder limit).
- Rule 2 (unknown handle) is covered by unit tests but is not triggered by any of the 10 scenarios.

These show how the rules behave on payloads we wrote ourselves. They do **not** show that people notice, understand or act on the warning.

## Known limitations

Full list in [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md). The main ones:

1. **Critical: an exact copy of a trusted payee's UPI ID is rated Safe (SCEN-10).** A swapped QR that carries the same trusted address looks identical to the real one. Verify the payee independently.
2. A scammer whose payee name matches their own UPI ID may not be detected.
3. No human testing has been done. The human-response test (T3) is **not run**.
4. No real payment verification (no banking API, payment rail, or live confirmation is contacted). Scanned camera frames and images are decoded strictly offline in the browser.
5. Amount limits are placeholders. Evidence so far covers students only.
6. Baseline-first order can bias results; the test session lets you choose the mode order.

## Project layout

```
src/lib/        parser, rules, assessment, session, history, CSV
src/screens/    Dashboard, Inspect, Compare, Test session, History, Limitations, ...
src/data/       synthetic scenarios and test handles
src/config.ts   thresholds and settings
tests/          Vitest tests (rules, parser, baseline boundary, CSV, history, screens)
docs/           LIMITATIONS.md
```

Stack: React 18, TypeScript, Vite 6, Vitest 2.

## Safe use

Use only the built-in synthetic scenarios or made-up QR text. Do not enter real UPI IDs, phone numbers or bank details, and do not use this app to decide a real payment.
