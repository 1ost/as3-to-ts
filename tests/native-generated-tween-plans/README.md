# Authenticated Bezier call plans

Run `npm run build`, then `node tests/native-generated-tween-plans/run.cjs` and
`node tests/native-generated-tween-plans/routing-guards.cjs`.

Complete source factories match all 42 retained plain Object Flash trajectories
in Node and Chromium on ES5/ES2015. The retained six cases and every original
packet file are authenticated before use. The source fixture constructs tweens
and callbacks; the observer uses the shared manual render API to compare the
original coordinates, scales, alpha and callback history. This is a compiler
migration fixture, not an unchanged port of the original Flash host.

The options literal evaluates once, after target and duration, before the
compiler adds a source plan. Thirteen factory guards and nine routing guards
cover stale source/hashes/spans, duplicate spans, wrong property orders, missing
plans/providers, unrelated cohort sources, conflicting plan inputs, wrong imports,
parameter shadows, construction, and invalid literal shapes. Removing the
generated attachment makes the runtime reject Bezier. Strict types pass and the
browser runs under CSP without dynamic code compilation.

`tweenSourcePlans` selects exact per-Class inputs for source module factories;
ordinary emission uses `nativeTweenSourcePlans`. Each call requires its exact
source span/hash and a captured initialization order. Only direct imported
TweenMax.to calls with fresh Bezier companion literals are admitted. Numeric
calls retain their prior routing. The provider still validates actual point and
option values; no compiler plan grants extra runtime capabilities.

This does not qualify complete WindowLayer, Sprite scale fidelity or the full
application. Existing imported query and typed-handle regressions also pass.
