# Complete EMVC script-domain module

Run npm run tsc, then node tests/native-generated-emvc/run.cjs.
Requires the OP2 emvc-generated AIR evidence packet (root commit 18d144e8)
and the isolated LayaAir-op2 engine.

All 32 maintained EMVC definitions plus the AIR observation-only ViewAccess
subclass are emitted without source edits through the production module factory.
All 26 AIR rows match on ES5/ES2015 in Node/Chromium, under browser CSP forbidding
runtime compilation, with zero generated-source/provider type diagnostics.

The script-global admission change accepts quoted literal String initializers
for private/protected static constants and protected static variables, using the
existing lexical storage provider. Mutable variables never become dependencies
for early constant Array initializers. Executable initializers remain held.

Eleven separate ownership/lifetime checks cover all inherited and sibling Class
identities, singleton reuse/isolation, actual protected String sharing/isolation,
retirement and retained instances. Twelve negative compiler guards reject wider
initializer forms. An applied mutation changes the protected String initializer
in the emitted module: the bundle must build and then fail the sibling-storage
check. Mutation build errors are test failures.

The report hashes compiler sources, source subjects, generated artifacts, type
and bundle inputs, runner, guards and observer. Run-4uQCnJ is the initial passing
receipt; the adjacent GameConfig regression checks the existing literal/Array
admission behavior. No common engine or maintained application source is changed.
This is a prerequisite qualification, not coverage of every EMVC method, the
CfgItem/ContextUtil/DataStoreProxy closure, actual Laya Loader, or full game startup.
