# Generated Dictionary boundaries and complete ELogger

Run `npm run tsc`, then `node tests/native-generated-dictionary-boundaries/run.cjs`
and the same command with `--combined`. Uses the sibling LayaAir-op2 checkout
(override with LAYA_ENGINE_REPOSITORY).

Authenticates the engine's generated-dictionary-boundaries and
generated-logger-trace AIR packets before emitting all three complete subjects.
ELogger is the unchanged maintained OP2 source, including its print branch.
The separate observer compares 64 AIR state rows and the three-line trace output
in Node and Chromium for ES5 and ES2015, with zero generated/dependency type
diagnostics. Twelve guards cover held trace call shapes, authored shadowing,
other native return types, and held direct Error signatures. Three deliberately
corrupted comparisons must fail. Receipts retain source, output, observer and
provider graph hashes.

Dictionary return conversion uses the existing native reference provider.
Authenticated `this` accessors returning Dictionary use common read/write/delete
and membership operations, retaining object key identity and numeric key aliases.
Only direct trace calls with one statically String expression are admitted;
String concatenation operands are likewise required to be statically String.
Direct builtin Error(message) now constructs the source Error through the same
provider as `new Error(message)` instead of emitting a TypeScript cast.

The authored getLog start-offset behavior and empty result text are preserved.
This does not qualify full EMVC routing, weak-key GC timing, arbitrary computed
receivers, derived Dictionary types, general trace values or trace identity.
Generated arity Error identity is additionally qualified by the source-errors
fixture. This observer rejects non-source exceptions, including arity failures.

The OP2 toolkit test `test_bulk_generated_dictionaries.mjs` independently emits
these complete subjects through the actual bulk worker and reuses this observer.
