# Native reference parameters in anonymous void callbacks

Requires matching nativeDisplayObjectReferenceModule/nativeRectangleReferenceModule,
authenticated declaration/reference plans and ordinary method callback scope.
The compiler uses common AS3 arity and native reference coercion before the body.
Optional, rest, initializer callbacks and non-void native callback returns remain held;
existing source Class callback restrictions are unchanged.

AIR fixture: engine tests/nativeFlashOracle/anonymous-native-parameters at
f5550daab69a5256093f32ab030e10c858d4cf22. All 23 AIR observations match ES5 and
ES2015 in Node and strict-CSP Chromium, with zero generated/dependency type errors,
11 compiler guards and six prototype/proxy/copy rejection checks. Mutations that
remove parameter coercion, remove arity checks, and discard captured Rectangle
state are detected in both runtimes. Sprite/Shape construction uses the common
engine with test-only no-render factories; this does not prove rendering.

The adjacent retained String/rest suite still passes 19 observations, nine guards,
and three mutations per target/runtime. replay-adjacent.cjs explicitly repins that
historical runner without changing its AS3 evidence or checks.

Set LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE, then run:
- node tests/native-generated-anonymous-native-parameters/run.cjs
- node tests/native-generated-anonymous-native-parameters/replay-adjacent.cjs
- node tests/native-generated-anonymous-native-parameters/verify.cjs --check-current

The archive retains original emission failure run-p0HcnT, exact pre-fix emitter and
lexical sources/builds, primary run-xzsMC4 and adjacent run-HnuyP0, AIR artifacts,
compiler/runtime inputs, generated factories, bundles, type diagnostics and mutations.

Archive: 15128050 bytes, SHA-256 4f2baa813db6e63976c87c308d1c2c598d06740b6420fc45c4e4a5ce27bbba6c.
Whole-client factory validation and real H5 account acceptance remain open.
