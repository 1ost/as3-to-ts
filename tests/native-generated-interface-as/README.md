# Generated source interface casts

Run `node tests/native-generated-interface-as/run.cjs --combined` with the
sibling LayaAir-op2 checkout. The engine's generated-interface-as verifier
authenticates two identical AIR captures and all nine complete AS3 subjects.
The observer is separate from emitted code.

Twenty-one rows compare on ES5/ES2015 in Node and Chromium, with strict generated
and provider type checks. Coverage includes a diamond of interfaces, inherited
implementations, structural rejection, nullish values, operand counts and throws,
no conversion hooks, and deferred implementing-class initialization. Three
corrupted comparisons must fail. Four compiler guards retain missing-provider,
shadowed target, class-initializer cast and interface-is boundaries.

The fix applies only to a source-resolved identifier with an authenticated
interface declaration token, generated class emission and explicit reference/type
providers. General interface Class values and full application routing remain
outside this qualification. Keep native-generated-source-as as the regression
for operand-before-Class initialization semantics.
