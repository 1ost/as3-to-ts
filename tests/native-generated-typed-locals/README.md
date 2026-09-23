# Generated declaration typed locals

Run `npm run test:native-generated-typed-locals` against the isolated common Laya engine.
The test authenticates the existing native-typed-locals receipt and both matching
AIR captures, then emits the entire unchanged original TypedLocals.as class through
the source-generated registrar. All 47 ordered AIR rows are compared in Node and
Chromium for ES5 and ES2015, both alone and with the reference/numeric parameter
passes used by bulk emission. Real provider and generated source types are checked.
The retained JavaScript observer changes only construction to native `new C()`;
its cases and common provider calls remain unchanged. No generated class body or
AIR expected row is rewritten. Four comparison negative controls and fourteen
unsupported/configuration guards run in each mode.

The opt-in `nativeTypedLocals` option now supports generated ordinary methods and
constructors. It reuses NativeTypedLocals for function-entry defaults, conversion,
raw assignment results, update overflow and compound evaluation order. Supply the
existing coercion/String/addition modules and `nativeTypedLocalReferenceModule`
pointing to common AS3Type for Array reference coercion. Exact authenticated source
method spans join the planning and emitter ASTs. Legacy AST identity is unchanged.
Object-typed public property accesses remain distinct from a same-spelled private
class member, as demonstrated by retained AIR case43.

Foreign reference locals, typed accessors, vectors, typed constants, enumeration,
nested functions, and ambiguous lexical shadowing remain held. Passing this fixture
does not establish the full data dependency chain, general Class construction,
source object literal metadata, or real game readiness.

Validation note (2026-09-22): generated Event and reference-constructor suites also passed. The legacy archived-engine typed-local replay was attempted twice, including a serial retry with a 1536 MB Node heap; both stopped with Array buffer allocation failed. No legacy full replay pass is claimed.
