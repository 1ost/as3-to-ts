# Resolve a type name once per declaration search

Two live debugger samples from OP2's 1,227-source manager audit placed execution
inside source-unit name resolution called from declaration `find` and `filter`
predicates. One sample identified RaidManager. Those predicates resolved the
same spelling separately for every candidate. This change resolves once before
each search, preserving the receiver eligibility and nonempty-array conditions,
then performs the original find/filter identity comparison. It adds no lasting
cache, type admission, coercion change or source-specific behavior.

Differential tests run the existing full static-getter and public-compound
fixtures with independently compiled baseline and current libraries. Each run
uses the same test sources, engine and helpers. The capture harness redirects
only compiler-library resolution, counts source type resolutions and captures
factory artifact hashes and rejection messages. Eight emitted factory artifacts
are byte-identical and 28 rejection messages are identical. Static-getter name
resolution calls decrease from 8,994 to 7,758; public-compound calls decrease
from 13,000 to 12,956. These small fixtures do not measure full-client speedup.

The existing runtime suites also pass: 13 AIR static-getter observations and 24
public-compound observations, ES5/ES2015 in Node/Chromium, seven guards per suite
and zero type errors. Public compound includes four applied mutations per target.
The validation archive retains both differential captures and current runtime
reports. Its pin records exact source/test inputs and the baseline library hash.

```powershell
$env:LAYA_ENGINE_REPOSITORY=(Resolve-Path ../LayaAir-op2-boolean-string-review).Path
node node_modules/typescript/lib/tsc.js -p tsconfig.json --pretty false
node tests/native-type-resolution/compare.cjs ../as3-to-ts-op2-callable-analysis-review/lib
node tests/native-type-resolution/verify.cjs
```

The baseline is compiler d4c10497 and the engine is 33f0bd991. Full OP2 provider
selection and a measured full-plan replay remain a separate integration step.
