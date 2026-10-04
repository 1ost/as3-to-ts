# Generated Dictionary reference operations

`nativeDictionaryReferenceModule` admits method-body `is Dictionary` and
`as Dictionary` with exact generated/reference plans and matching provider/import
bindings. The shared type helpers evaluate the value once and use Dictionary's
private nominal identity. Shadowed/qualified operands and class-body initializers
remain rejected; no JavaScript structural assertion replaces the source cast.

The shared engine's `AS3CanonicalDictionaryReference` registers the existing
Dictionary constructor/private instance proof for generated method signatures.
Use this provider in the declaration plan and imports as well as the option.
No Dictionary storage, source ancestry or property dispatch changes are needed.

Run `node tests/native-generated-dictionary-reference/run.cjs` with
`LAYA_ENGINE_REPOSITORY` pointing to the matching engine checkout. The complete
Reader source is compiled from the retained AIR capture. Fifteen observations
cover identity, null/undefined and incompatible values, absence of coercion
hooks, exactly-once operand calls and Dictionary property reads. They match on
ES5/ES2015 in Node and strict-CSP Chromium, with zero type diagnostics. Eight
emission guards and two host-forgery guards remain active. An applied Node
mutation that makes casts return null breaks the identity observations on both
targets. The source corpus itself is not altered for the passing run.

`node tests/native-generated-dictionary-reference/verify.cjs --check-current`
authenticates the retained runtime packet, source/compiler/provider bytes and
both AIR captures. Source reference-coercion regression coverage also passes
24 AIR observations and 25 guards on both targets/runtimes; the existing engine
Dictionary Class package matches its 18 selected rows and 30 guards.

This does not qualify full HashMap, serialization, derived Dictionary types,
class initializer casts or the OP2 client.
