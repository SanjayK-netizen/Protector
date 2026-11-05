# QRShield limitations

QRShield is an offline research prototype using synthetic data. It does not guarantee that a payment destination is safe.

1. **Critical — an exact copy of a trusted payee's UPI ID is rated SAFE (SCEN-10).** The engine cannot distinguish an authentic QR code from an exact copy that carries the same trusted address. Verify the payee independently.
2. A scammer whose displayed payee name matches their own UPI ID may not be detected.
3. Human testing has not been done; T3 remains **Not run**.
4. No live camera scanning is available.
5. No real payment verification, banking API, or live payment rail is integrated.
6. Synthetic data only; no live participant records or real payees are included by default.
7. Amount limits are unvalidated placeholders and have not been established by user research.
8. Evidence so far covers students only; findings should not be generalized to employees, merchants, or the public.
9. Baseline-first order can bias results; mode order can be selected in the test session.
10. History lives only in this browser and may be cleared or unavailable when browser storage is blocked.

The prototype has no network submission, analytics, or camera access.
