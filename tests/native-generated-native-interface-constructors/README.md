# Constructor coercion for authenticated native interfaces

Run `npm run tsc`, then
`node tests/native-generated-native-interface-constructors/run.cjs`.
All three complete original subjects are emitted through production class module
factories. Each of ES5 and ES2015 matches 32 original AIR observations in Node and
Chromium, with zero type/browser errors. `verify.cjs` checks the retained receipt.

Constructor parameters now use the same authenticated native interface tokens as
generated fields and ordinary methods. Coverage includes optional and required
IEventDispatcher parameters, optional IDataInput, omitted/null/undefined values,
native/generated implementers, rejected structural impostors and primitives,
pre-body coercion, and event delegation through the native EventDispatcher base.
Six runtime guards reject forged native implementations before entering the body.
Six compiler guards retain exact plans, native-interface flags, reference provider
configuration and null-only optional defaults. No game-specific lowering or native
interface implementation was added. Full DevilFruitManager and game startup remain
separate integration work.
