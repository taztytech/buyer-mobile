# Crashlytics Release Checklist

This checklist codifies the Crashlytics process gate for Tazty Buyer releases.

## Pre-Release (Developer + QA)

- [ ] Crashlytics is enabled and initialized at app start.
- [ ] Crashlytics wrapper is used (no direct SDK calls from UI screens).
- [ ] `userId` is set after login and cleared on logout.
- [ ] Global context is present:
  - [ ] `app_version`
  - [ ] `platform`
  - [ ] `login_state`
  - [ ] `city`/`pincode` when available
- [ ] Revenue-critical screen context is tracked:
  - [ ] `current_screen=checkout`
  - [ ] `current_screen=order_status`
  - [ ] `current_screen=payment` where applicable
- [ ] Payment context is tracked:
  - [ ] `payment_method`
  - [ ] Breadcrumb before payment start
- [ ] Non-fatal capture is wired for:
  - [ ] payment processing failures
  - [ ] API critical endpoint failures
  - [ ] order create/cancel failures
  - [ ] order notification handler failures

## Instrumentation Validation (QA)

- [ ] Force crash once in staging/dev and verify it appears in Firebase Crashlytics.
- [ ] Verify crash has expected context (`app_version`, `platform`, `current_screen`).
- [ ] Simulate non-fatal scenarios and verify they appear in Crashlytics:
  - [ ] payment timeout/failure
  - [ ] API 500 error
  - [ ] invalid response parsing path
  - [ ] network drop during checkout
- [ ] Verify non-fatal issues include relevant attributes:
  - [ ] `source`
  - [ ] `endpoint`/`http_code` for API issues
  - [ ] `payment_method` and `gateway` for payment issues

## 24-Hour Post-Release Monitoring

- [ ] Check crash-free users >= 99%.
- [ ] Check crash-free sessions >= 99.5%.
- [ ] Filter by latest `app_version`.
- [ ] Compare Android vs iOS crash distribution.
- [ ] Review payment/checkout crash and non-fatal trends.
- [ ] Review city-based anomaly spikes.

## Escalation Gate

- If crash-free users < 99%: immediate engineering triage.
- If crash-free users < 97%: evaluate rollback/hotfix.
- Any checkout/payment crash regression: hotfix priority.

## Notes

- Do not log PII (phone, email, full address, exact GPS, payment identifiers).
- Remove/disable explicit crash-test triggers from production-facing UI surfaces.
