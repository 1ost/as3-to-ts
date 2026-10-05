# Native accessibility class-script retries

When a direct AccessibilityImplementation subclass fails during static
initialization, each attempt must retain its own Class, script global, closures
and arrays. Failed Class values remain constructible, with independent native
state and working overrides. The compiler now admits this direct native base
under its exact provider contract. Source descendants and package-internal retry
declarations keep their existing guards.

The engine also needs the native signature correction in 8708ca00e: explicitly
record `rest:false` for fixed accessibility callbacks. Missing this normalized
field rejects valid overrides, including the pre-existing non-retry accessibility
fixture. Engine 969cd4985 includes the new twenty-row AIR oracle.

The original Trace/Retry AS3 declarations are emitted as complete factories for
ES5 and ES2015. Both match twenty unchanged AIR rows in Node and strict-CSP
Chromium. Generated sources and dependencies type-check with zero diagnostics.
Nine rejection guards and ten independent domain checks pass per target.
Two mutations are detected per target: removing class-script retry semantics,
and deleting the native callback's no-rest flag.

Adjacent validation passes on both targets: ordinary generated accessibility
(12 rows, 7 rejection guards, 16 runtime guards, 4 domain checks), and dispatcher
script retries (19 rows, 5 rejection guards, 9 domain checks, 1 mutation).

```powershell
$env:LAYA_ENGINE_REPOSITORY='<qualified-engine-checkout>'
$env:PLAYWRIGHT_MODULE='<playwright-module-directory>'
node tests/native-generated-accessibility-script-retry/run.cjs
node tests/native-generated-accessibility-script-retry/verify.cjs
```

`--expect-held` on the runner reproduces the pre-fix compiler guard and is only
for the prior compiler implementation. The retained baseline contains that exact
report, runner, observer and every compiler source input. The applied archive
retains all three test runs, AIR fixtures, generated artifacts, type-check and
bundle inputs. `verify.cjs --check-current` additionally checks live input bytes.

`qualified.json.gz`: 1,080 files, 7,639,104 bytes, SHA-256
`4c03f64c19546fb7f6789cb02c62a52cbdddaa3b139e2f2b66e0428641d57d80`.
Retain a new archive with `--retain <retry-report> <accessibility-report>
<dispatcher-report>` only when no archive exists; existing evidence is immutable.

This fixture does not qualify complete TextAccImpl/TLF integration, additional
native bases, accessibility platform event delivery or real H5 account acceptance.
