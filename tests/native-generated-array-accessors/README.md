# Complete generated Array accessor Classes

Build with `node node_modules/typescript/bin/tsc --pretty false`, then run
`node tests/native-generated-array-accessors/run.cjs`. Original sources and
captures come from immutable engine commit `beb8d3e6d`; their receipt hashes are
checked before compilation. Set `LAYA_ENGINE_REPOSITORY` to select its checkout.

All three complete original Classes match 22 observations from two identical
AIR captures. ES5 and ES2015 factories run in Node and Chromium with self-only
script CSP and zero type errors. No native protocol subject bodies substitute
for compiled code. Array identities, alias mutation, null/undefined coercion,
invalid values before setter effects, partial overrides, super halves, bound
methods and reflection match. Retained report: `full-GoNXUJ`.

Array accessor definitions carry the captured intrinsic reference, matching the
existing Array storage contract. Source ancestry authorizes each overridden
half independently. Super reads/writes use the selected source parent. Twelve
guards reject forged plans, missing overrides, final ancestors, incompatible
halves, illegal super operations and getter parameters. Two applied mutations
remove the getter and setter override flags separately; both factories fail in
both runtimes. `verify-runtime.cjs --check-current` verifies retained inputs.

Adjacent regressions pass on both targets/runtimes: mixed halves (17 rows,
`full-viMJrc`), protected getters (19 rows, `full-cPWVjO`), and independent
accessor types (41 rows, `full-6sMtxa`). Full OP2 startup remains a separate gate.
