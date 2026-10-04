# Chained source interface getter qualification

The lexical emitter follows authenticated source field/getter return types into
source interfaces and their inherited getter contracts. It emits common public
property reads without selecting the caller's protected namesake. The complete
receiver is retained, preserving getter evaluation order and counts. Native
interface inheritance retains its separate qualification.

Run `npm run tsc`, then `node tests/native-generated-chained-interface/run.cjs`.
The default engine is the sibling `LayaAir-op2-chained-interface-review`; override
with `LAYA_ENGINE_REPOSITORY`. Thirteen observations from two identical AIR runs
match ES5/ES2015 in Node and strict-CSP Chromium. Generated sources and their
dependencies have zero strict TypeScript diagnostics. Five rejection guards
cover writes, calls, missing property authority, private source getters and
missing interface contracts. Wrong-getter and repeated-receiver mutations are
applied and detected on both targets. The fixture fails on the previous compiler
with the exact-source lexical receiver guard.

`node tests/native-generated-chained-interface/verify.cjs` authenticates the
retained archive. Add `--check-current` to compare all retained bytes with disk.
Adjacent chained reference and native interface inheritance suites are exercised
against the same isolated engine. Their default older engine is incompatible
with current lexical storage types; set the engine override explicitly.

This qualifies getter reads only. Interface writes, callable getter values and
construction remain guarded. Complete OP2 BaseCompose emission, the full factory
and actual H5 game acceptance require separate integration evidence.
