# Explicit generated Vector conversion

Run npm run tsc, then node tests/native-vector-conversion/run.cjs --combined.
Requires engine 0d85ce640 or a descendant. The complete original Consumer matches
89 AIR observations in ES5 and ES2015 Chromium with Laya initialized. Both the
generated code and provider graph have zero TypeScript diagnostics.

The planner admits a Vector specialization used as a call operand; emission
requires one argument and the exact authenticated source specialization. It uses
the shared as3VectorConvert operation, preserving existing element-Class and
native binding checks. Vector construction retains its distinct length/fixed
argument qualification. Unknown/forged plans, nested Vectors and invalid call
arity remain rejected (four guards). Three native controls cover forged specs,
not consulting JavaScript iterators, and stopping indexed reads on conversion
failure. Three comparison controls reject altered original observations.

Seven primitive/reference element families cover copied Arrays and array-like
objects, sparse slots, one length read, same-Vector identity/fixed state and
primitive rejection. Full source reference-family conversions retain the existing
runtime coercion semantics; the fresh adjacent generated interface Vector suite
passes 33 rows with eleven guards in Node and Chromium. SimpleButton Vectors
retain 40 matching rows. Engine Vector tests pass all 16 cases including 63
retained original observations.

The separate complete inline Consumer source is authenticated and deliberately
asserted to remain held: typed String parameters on anonymous functions require
compiler support. The original 91-row inline packet is retained in the engine.
This unresolved TLF prerequisite is not counted in the 89 passing runtime rows.
Static Vector initializers, complete TLF and full game execution remain open.

runtime.json.gz retains generated/source bytes, compiler/provider hashes and
results. verify.cjs authenticates this retained comparison and the inline hold.
