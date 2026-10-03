# Generated delayed callback parameters

The emitter admits the third callback-parameter argument for an explicitly
imported `com.greensock.TweenMax.delayedCall`, using the common GSAP migration.
It preserves ordinary source argument evaluation, method closure binding and
Array identity. It does not grant TweenMax Class authority or enable the fourth
frame-domain argument. The common runtime also accepts explicit null parameters.

The complete `DelayedParamsSubject.as` runs unchanged with 34 maintained
GreenSock source files in AIR WIN 51,3,4,2. Both captures agree on 14 observations:
left-to-right single evaluation, deferred delivery, retained/mutated parameter
Arrays, two bound receivers, zero delay, cancellation, null/empty/omitted Arrays,
and a static callback with the same Array-literal selection used by OP2 UIUtil.
The driver moves original handles onto a paused SimpleTimeline; the native
observer advances the shared runtime's manual clock at corresponding samples.

ES5/ES2015 generated factories pass in Node and CSP Chromium, with no TypeScript
diagnostics against actual providers. Four applied mutations (zero delay, ignored
cancellation, copied Arrays and erased argument values) each change the trace.
Fifteen guards retain ownership, shadowing, opt-in, extraction, constructor and
unsupported arity boundaries. Explicit fixture Class-script authority supports
its static Array initialization; this is not blanket application admission.

The old compiler's two-argument rejection and the old runtime's null-Array
rejection are retained in `baseline.json` and the two logs. The latter is after
the emitter fix but before the engine change. `source-library.json` authenticates
the maintained dependencies. Original game sources are unchanged.

Run with `LAYA_ENGINE_REPOSITORY=../LayaAir-op2-delayed-params-review`:

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-generated-delayed-params/run.cjs
    node tests/native-generated-delayed-params/verify-runtime.cjs --check-current

The report contains generated artifacts, source/provider hashes and controls.
Fresh two-argument delayed-call, tween-control and tween-handle reports add
9 + 10 + 19 regression observations. Separate fresh ColorTransform (19), private
Vector return (17) and DataEvent (36) reports are retained by the paired engine's
ColorTransform suite. These are focused proofs, not whole-client acceptance.
