# Native Event Object property paths

Run `npm run tsc` and `node tests/native-event-object-properties/run.cjs` with
LAYA_ENGINE_REPOSITORY pointing at the isolated shared engine (default sibling
LayaAir-op2). Canonical Event property registration and the authenticated
nativeFlashOracle/event-object-properties packet are required.

Production factories for complete Reader/Subject AS3 sources match eleven AIR
observations on ES5 and ES2015, in Node and Chromium with script-src self.
Full engine/generated type graphs are checked. Three compiler guards keep
lookalike Event types, bindings without native-base authority, and unrelated
Event properties outside this Object-getter rule. Runtime guards cover sibling
class identity, retained callbacks and forged Event rejection. Two applied
factory mutations build successfully, then fail null-getter error or argument
side-effect comparisons. Existing native-object-property-paths tests (ordinary
and --order) provide the neighboring regression coverage.

This boundary covers target/currentTarget on exact Event-typed locals and
parameters. Subclass-typed receivers and arbitrary native getter inference are
not granted. Native Event keeps its unknown return types; runtime dispatch uses
the shared source property helpers instead of host any-property access.
