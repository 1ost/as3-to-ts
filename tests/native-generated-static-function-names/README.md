# Declared static methods named call, apply and bind

Run `npm run tsc`, then `node tests/native-generated-static-function-names/run.cjs`.
`verify.cjs` checks the retained runtime receipt and original AIR capture.
Both complete subjects are emitted through native module factories. ES5 and
ES2015 match seven AIR observations in Node and Chromium with zero type/browser
errors: direct calls, rest/default arguments, body counts, extracted method
identity, Function.call/apply on the extracted closure, and arity errors before
body entry.

The callable-class scan resolves the receiver through the authenticated source
plan and exempts an explicitly declared public static method. Lowering likewise
requires a projected static method trait. Prototype access remains held. Nine
guards cover forged plans; constructor call/apply/bind/prototype access; local and
field Class shadowing; private and instance methods. The field shadow is rejected
earlier by the generated lexical guard.

This corrects the maintained JsUtil to JSExternal.call false positive. It does
not qualify ExternalInterface behavior or full game startup, or change ordinary
non-generated consumer admission.
