# Generated native reference locals

Run `npm run test:native-generated-native-locals` after `npm run tsc`.
The engine path defaults to `../LayaAir-op2` and can be set with
`LAYA_ENGINE_REPOSITORY`.

The runner authenticates the engine's `native-reference-locals` AIR packet and
emits its complete source class without modifying the method bodies. A separate
observer compares all 20 AIR rows in Node and Chromium for ES5 and ES2015 output,
both alone and alongside the signature/reference passes. Six compiler rejection
guards, three deliberately changed comparisons and a forged native-prototype
rejection supplement the comparison.

Native local types resolve from the exact declaration plan to its native provider
export. They use the existing common `as3CoerceReference` path. The provider owns
instance proof; this does not authorize unbound native identities or grant native
Class metadata, source subclasses, typed native parameters or typed returns.

Strict checking uses the engine's real shader/spine declarations and preserves
AS3 wildcard catch typing with `useUnknownInCatchVariables:false`. Generated
files must have zero diagnostics. Three existing engine dependency diagnostics
are matched exactly and recorded: ByteArray's missing DecompressionStream host
types (two) and WebGLInternalRT's console module declaration. No fake declarations
or implementation replacements are supplied to hide these errors.
