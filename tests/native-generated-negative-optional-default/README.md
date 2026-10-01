# Negative optional literal spans

Legacy unary default INIT spans may be empty. Recover the end through operand
descendants before applying the existing literal and integer-range validation.
This fixes generated method and selected super default validation; arbitrary
expressions, legacy octal, fractional integers and out-of-range values stay held.

Two unchanged complete source Classes from engine 8c12e2e19 focused AIR evidence
produce twelve matching observations on ES5/ES2015 in Node and Chromium with self
script CSP. Seven rejection guards, an applied old-span compiler control, and
strict type checks pass. Original broader arguments.length and Array override
probes remain separately held; this fixture does not qualify those capabilities.

Run node tests/native-generated-negative-optional-default/run.cjs. Verify retained
source, compiler, generated, provider and runner hashes with
node tests/native-generated-negative-optional-default/verify-runtime.cjs --check-current.

Adjacent regressions: optional-super run-Y1RhL2 (13 rows) and optional-overrides
run-9OkTD4 (11 rows), both targets and realms, zero type errors. Startup remains
unqualified.
