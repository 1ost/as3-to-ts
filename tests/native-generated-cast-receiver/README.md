# Authenticated source Class cast receivers

`Window(item).addToStage()` must use Window's public member when the caller has
a protected namesake. The old compiler stopped with `lexical receiver requires
exact source type`. Allowing that lookup alone exposed a second defect: the
source Class cast was emitted as an erased TypeScript assertion. A wrong value
then evaluated the method arguments and failed with error 1006, instead of
failing the cast with error 1034 before those arguments ran.

The shared fix discovers a public receiver type only from an unshadowed,
one-argument cast to an authenticated, non-reference-only source class. This
does not grant private/protected access. Generated source Class casts with
reference-coercion authority now preserve Class evaluation and perform nominal
coercion through the common engine before the enclosing call proceeds.

Two identical fresh Harman AIR captures establish 14 observations: public
method/field/accessor lookup, write/update, stable bound method closures,
receiver evaluation, virtual dispatch, retained receivers, null/undefined,
and the wrong-cast argument boundary. Both ES5 and ES2015 match in Node and
strict-CSP Chromium with zero type errors. Eight rejection guards run per
target. Applied compiler controls independently remove receiver discovery and
runtime coercion; the former restores the emission failure and the latter
fails the AIR comparison in both runtimes.

Adjacent suites pass another 45 retained Flash observations per target:
chained references 11, descendant private receivers 11, own lexical receivers
9, and source accessors 14. The chained fixture uses its original Pepper
capture; the others retain AIR evidence. These are focused fixtures, not
whole-client factory/type/runtime or H5 account acceptance.

From this compiler checkout, with dependencies installed:

```powershell
node node_modules/typescript/bin/tsc
$env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-scroll-render-review'
node tests/native-generated-cast-receiver/run.cjs
node tests/native-generated-cast-receiver/verify-runtime.cjs --check-current
```

The retained engine is `5590018e540b5214a138005f6de8adb0d14e49a4`. The separate
unchanged baseline compiler is `8f2c555c17c93a87e6fd41ea59d7aaa70ad539c8` in
`../as3-to-ts-op2-source-accessor-review`. Set `CAST_BASELINE_COMPILER` to that
checkout only when running `run.cjs --baseline` or `retain.cjs`; unset it for
positive runs. `retain.cjs` takes five raw output directories in the suite
order above, authenticates input hashes and records the baseline failure.

`runtime.json.gz` retains full reports, generated output, positive and mutated
executable bundles, and compiler/engine dependency hashes. Its verifier can use
archived generated inputs after cache removal and compares external inputs
with `--check-current`. Legacy adjacent report `engineCommit` fields identify
their original evidence; the packet's engine and input manifest identify this
fresh execution. `oracle/receipt.json` authenticates source, SWF, capture,
compiler and player provenance. Global OP2 provider pins remain unchanged.
