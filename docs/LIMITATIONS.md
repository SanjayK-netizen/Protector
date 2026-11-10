# QRShield limitations

QRShield applies offline heuristics to QR payload text. It cannot verify the identity of a payee or determine whether a code is the original.

1. **No authoritative identity or QR verification.** The app does not contact a bank, merchant, payment network, or trusted registry. A copied QR code can carry the same payload as an original.
2. **No result proves a code genuine or fake.** “No indicators found” means the configured checks did not match. “Suspicious” means risk patterns were found, not that fraud is confirmed.
3. **Handle lists may be incomplete or outdated.** A listed UPI handle does not validate the specific account or payee.
4. **No merchant payees are preconfigured.** Look-alike checks only work when a trusted-payee list is supplied by a reliable source.
5. **A matching displayed name and UPI ID can still be deceptive.** The app cannot determine who controls an account.
6. **Amount limits are placeholders.** They have not been established by user research.
7. **No human testing has been done.** The app has not been validated as effective at preventing harmful payments.
8. **Camera QR decoding runs locally via jsQR.** No banking API, payment rail, or live payment verification is integrated.
9. **History exists only in this browser.** Local storage can be cleared or blocked; exported records may contain old research-session data.

Do not treat QRShield as the sole basis for making a payment. Confirm the recipient and amount independently using a trusted channel.
