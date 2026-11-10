# QRShield (Protector)

QRShield reads the contents of a QR code and checks payment details for common risk patterns before a payment is made. It does not determine whether a code is original or fake: a QR payload can be copied, and the app has no authoritative merchant or bank verification source.

Camera scanning and image decoding run offline in the browser. The app does not make payments, contact banks, or send inspection data to a server.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Other commands:

```bash
npm test
npm run build
npm run preview
```

## How it works

1. `src/lib/upiParser.ts` extracts payment details from a `upi://pay` payload and identifies unsupported payloads and web links.
2. `src/lib/riskRules.ts` checks for seven risk patterns: name mismatch, unrecognized UPI handle, configured-payee look-alike, deceptive payment wording, unusual amount, non-UPI or web-link payload, and urgency wording.
3. QRShield shows the details, any indicators found, and a suggested next step.

The handle list in `src/data/knownHandles.json` is only a convenience list and is not an authoritative or current verification source. No merchant payees are preconfigured.

## Important limitations

- **A result is not proof of authenticity.** “No indicators found” means only that these checks did not match; it does not mean the QR code or payee is genuine.
- **A result is not proof of fraud.** “Suspicious” means risk patterns were found; verify the recipient independently.
- **Copied QR codes cannot be identified without a trusted original to compare against.**
- Amount thresholds are placeholders, not evidence-based recommendations.
- No bank, merchant, or payment network is contacted to validate a transaction.
- Camera access and QR decoding run locally in the browser; history remains in this browser and may be cleared or unavailable.

See [Known limitations](docs/LIMITATIONS.md) before relying on any result. Do not use this prototype as the sole basis for making a payment.

## Project layout

```text
src/lib/        parser, risk rules, history, CSV
src/screens/    Dashboard, Inspect, History, Limitations
src/data/       convenience UPI-handle list
src/config.ts   thresholds and settings
tests/          unit and component tests
docs/           LIMITATIONS.md
```

Stack: React 18, TypeScript, Vite 6, Vitest 2.
