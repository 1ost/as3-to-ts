# Generated native Shape returns

Explicit canonical DisplayObject reference qualification now admits Shape returns
through the existing nominal display proof and completion-aware return coercion.
The native Shape provider stays explicit; other native families remain guarded.
No runtime implementation change is required.

Twenty AIR observations from the complete ShapeReturns source match generated
ES5/ES2015 in Node and strict-CSP Chromium. Tests cover identity, fresh allocation,
null/undefined, unrelated displays, static and nested calls, bound-call arity,
finally replacement, catch-invalid behavior, getters and no conversion hooks.
Six host checks cover domain isolation, shared native references, retained calls,
and forged/copied/proxied Shapes. Four compiler guards reject missing display
qualification, bare returns, fallthrough and an unqualified unrelated native.
One mutation removes three return-coercion sites and is detected in both runtimes
per target. Type diagnostics are empty.

The adjacent Sprite return fixture also passes its 16 AIR rows, four compiler
and four host guards in both targets/runtimes. Its runner now retains compiler
inputs, guard hashes and mutated bundles and executes the mutation in Chromium.
Both suites use the existing nativeDisplayProjection NoRender state host with
real shared display providers; they do not claim pixel rendering or H5 acceptance.

Run `npm run tsc`, then `node tests/native-generated-shape-return/run.cjs` and
`node tests/native-generated-shape-return/verify.cjs --check-current`.
The runtime checkout defaults to ../LayaAir-op2-blendmode-class-review and the
AIR evidence checkout is ../LayaAir-op2-shape-return-review. The combined archive
retains both complete evidence packets, source/compiler/type/runtime inputs,
positive/mutated output and the pre-fix compiler rejection.
