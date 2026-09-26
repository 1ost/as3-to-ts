# Imported tween routing

Run `npm run tsc -- --pretty false` then `node tests/native-imported-tween/run.cjs`.

An explicit `nativeTweenModule` now recognizes the exact imports
`com.greensock.TweenMax` and `com.greensock.TweenLite` when routing direct `to`
calls. It also routes exact imported `TweenMax.getTweensOf(target)` calls with
one argument. Imports retain lexical identity but do not manufacture a native Class.
Parameters and unrelated imports keep their own bindings. Other imported tween
Class expressions fail closed; the option remains opt-in.

Unimported query namesakes, unrelated imports and parameter shadows are not
migrated. TweenLite queries, query method extraction/construction and extra or
missing query arguments remain held. TweenLite `to()` now selects the shared
`toLite()` entry so typed TweenMax storage can reject Lite handles. The existing
bare-name `to()` selection policy is unchanged.

`node tests/native-imported-tween/runtime.cjs` verifies generated ES5/ES2015
consumers with the actual shared FlashTweenRuntime in Node and Chromium. It
authenticates the retained shared runtime evidence manifest and compares two
rows from both original Flash captures: newest-first handle identity and killing
all handles from a snapshot. Seven additional checks cover target expression
evaluation once, identity, target isolation, cancellation, genuine Max handle
coercion, Lite rejection and mixed query order. The consumer and
real dependencies typecheck together at ES2020 before only the consumer is
downlevelled. Set `LAYA_ENGINE_REPOSITORY` for a non-sibling engine checkout.

This fixture deliberately uses wildcard handles. It does not qualify source
TweenMax typed-local coercion, a native TweenMax Class, generated source-class
factories, or complete WindowLayer behavior. Those remain prerequisites.

The routing-only checks do not establish animation fidelity. The OP2
generated EffectBlurLayer browser comparison uses its retained original Flash
capture to test the integration with the shared FlashTweenRuntime. The older
`native-reflection-query/run.cjs` runner currently stops at its earlier namespace
member redeclaration case before reaching its tween tests; this independent
runner retains those tween checks and extends them for imported bindings.
