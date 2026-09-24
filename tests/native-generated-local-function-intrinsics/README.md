# Generated typed local Function intrinsics

Run `node tests/native-generated-local-function-intrinsics/run.cjs`.
The complete unchanged engine AIR subject is emitted through the production
module factory. Eight rows compare explicit/null/undefined receivers, call/apply,
local replacement during argument evaluation, argument effects before null
errors and invalid apply lists. ES5/ES2015 must pass in Node/Chromium, with zero
output/provider type errors and browser CSP forbidding runtime compilation.

The compiler resolves an actual typed Function local (excluding catch shadows,
nested callable scopes and parameters) and uses the common named-property call
provider. An applied mutation replaces that provider with JavaScript call;
the declaration-global observation must then fail on both emitted targets.
Other local forms are not newly qualified by this test.
