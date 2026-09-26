# Imported tween routing

Run `npm run tsc -- --pretty false` then `node tests/native-imported-tween/run.cjs`.

An explicit `nativeTweenModule` now recognizes the exact imports
`com.greensock.TweenMax` and `com.greensock.TweenLite` when routing direct `to`
calls. Imports retain lexical identity but do not manufacture a native Class.
Parameters and unrelated imports keep their own bindings. Other imported tween
Class expressions fail closed; the option remains opt-in.

These are compiler routing checks, not animation fidelity evidence. The OP2
generated EffectBlurLayer browser comparison uses its retained original Flash
capture to test the integration with the shared FlashTweenRuntime. The older
`native-reflection-query/run.cjs` runner currently stops at its earlier namespace
member redeclaration case before reaching its tween tests; this independent
runner retains those tween checks and extends them for imported bindings.
