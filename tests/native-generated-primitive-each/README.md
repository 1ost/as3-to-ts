# Predeclared int, uint and Boolean for-each storage

The complete PrimitiveEachProbe source exercises the iterator forms that blocked
OP2 OperationManager (int) and WelfareManager (Boolean). Two identical AIR Desktop
WIN 51,3,4,2 captures establish fifteen observations. `verify.cjs` authenticates
the receipt, source, SWF and both captures. Reproduce with the shared engine's
scripts/nativeFlashOracle.py, AIR SDK 51.3.4, this source directory, entry
PrimitiveEachProbe and a fresh output directory.

The previous compiler rejects predeclared primitive iterator storage. Both the
typed-local validator and enumeration emitter must admit the types; changing
only validation falls through to legacy enumeration and fails the provider
guard. The implementation uses the existing shared cursor and typed assignment
lowering, as inline declarations already do. Application source is unchanged.

Run `node tests/native-generated-primitive-each/run.cjs` with
LAYA_ENGINE_REPOSITORY pointing to the engine pinned in runtime-pin.json.
ES5/ES2015 execute the full generated source-class module in Node and Chromium
with an external-script CSP, matching all fifteen rows with zero type errors.
Six guards cover provider requirements, unresolved types, parameter redeclaration,
Array iterator exclusion and catch shadowing. Three applied mutations remove
int, uint or Boolean assignment coercion and must fail the original comparison.

Observations include wrapping, truncation, primitive truthiness, preserved/default
storage for empty/null/undefined receivers, receiver evaluation once, break,
continue, body exceptions, sparse arrays, Vector values, zero sign and nested
loops. Retain a passing report using `retain.cjs REPORT`; verify its archived
sources, generated artifacts, implementation hashes and comparisons using
`verify-runtime.cjs --check-current`. This does not qualify complete managers or
the full startup flow. Predeclared Array/Function iterator storage remains held.
