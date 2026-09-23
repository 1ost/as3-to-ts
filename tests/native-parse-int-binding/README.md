# Direct source parseInt binding

Run `npm run tsc`, then `node tests/native-parse-int-binding/run.cjs`.
An explicit nativeGlobalModules.parseInt binding maps unshadowed direct calls
with zero to two arguments to the common AS3ParseInt sourceParseInt export.
Imports, source methods and lexical parameters retain their own bindings.
Function extraction, apply, construction and extra direct arguments remain held.

The runner authenticates the common provider's repeated 6,924-row Flash corpus
and exercises all 6,923 zero-to-two-argument cases through emitted Reader methods
on ES5/ES2015 in Node/Chromium. Results compare exact binary64 bits and conversion
hook logs. The one extra-argument apply case remains provider-only evidence.
Seven compiler controls check identity/construction/arity holds and shadowing;
the actual generated/provider graph must type-check without diagnostics.
