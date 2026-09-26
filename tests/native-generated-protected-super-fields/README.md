# Protected super numeric fields

Run `node tests/native-generated-protected-super-fields/run.cjs` after building
the compiler. All three complete subjects match twelve repeated AIR rows on
ES5/ES2015 in Node and Chromium with CSP, zero type errors, eight rejection
guards, three domain checks and two mutated-factory rejections. Evidence is in
`../LayaAir-op2/tests/nativeFlashOracle/protected-super-fields`.

The emitter resolves a protected ancestor Number/int/uint variable through the
existing common lexical capability, using the original source receiver. Plain
reads, chained assignment, stored numeric coercion versus assignment result,
pre/post increment/decrement overflow, grandparent storage and bound methods are
covered. Private/static/constant/non-numeric targets, deletion, compound writes
and constructor/static/nested-function access remain outside this admission.
No additional runtime storage or OP2-specific compatibility was introduced.

The OP2 actual worker test is
`as3-to-layaair-porting-kit/tests/test_bulk_generated_protected_super_fields.mjs`.
Factory pass: `run-07oKcD`; worker pass: `run-PIyR1j`.
Protected super methods (16 AIR rows) and protected numeric updates (29 AIR rows)
continue to pass unchanged. Complete BaseButton and game integration remain open.
