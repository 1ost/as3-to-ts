# Typed numeric Vector indexing

Authenticated generated Vector locals and parameters now route simple indexed
reads/writes through common providers. Number/int/uint keys use numeric helpers;
wildcard, Object and String keys use named-property dispatch. The local source
plan resolves captures and rejects shadowed storage. Argument evaluation retains
the receiver and key before the RHS, and helpers return the original RHS.

All 20 AIR observations from engine 2696b8f12063b6d85699534123fe6cf8e5c63fcb match
in Node and Chromium CSP for ES5/ES2015 with zero type errors. NaN/infinities,
integer parameter coercion, wildcard/string and literal keys, captured/shadowed
locals, append/gaps and null/bounds RHS ordering are covered. Applied controls
restore legacy raw indexing and substitute named lookup for numeric access;
both diverge. Three guards reject copied plans, compound indexed assignment
and index expressions without qualified static types.

Run `npm run tsc`, then `node tests/native-generated-vector-numeric-index/run.cjs`
with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE pointing to the existing engine
and browser installations. The portable `verify.cjs` packet includes source,
AIR captures, compiler/provider inputs, generated and executed bundles, mutated
emitter sources and reference-enumeration/Proxy regressions. `--check-current`
also checks retained workspace inputs. No assets or application account are used.

The lowering is bounded to authenticated local/parameter Vector receivers,
including captures, and supported simple key types/literals. Arbitrary member
receivers, computed expression types, compound/update/delete operations and
non-Class Vector literal planning remain separate work. The last full-factory
inventory of 73 diagnostics predates this change and has not been rerun.
Focused checks do not establish whole-client or H5 acceptance.
