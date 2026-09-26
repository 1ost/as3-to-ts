# Exact source-file declaration model

Run `node tests/native-source-unit/run.cjs` after building the compiler.
The model consumes the complete retained Flash First/Second files without
rewriting or splitting source. Their three private descriptors have no public
QName. First.Helper and Second.Helper remain different identities although both
reflect as ::Helper; the child descriptor remains owned by First's file.

Nine rejection checks cover cross-file or forged descriptors, serialized units,
changed bytes, owner mismatches, duplicate locals, forged planner access and
continued rejection by the not-yet-upgraded multiple-declaration emitter path.
ASTs are detached copies: consumer mutation cannot change cached source authority.
Existing single-declaration plans now retain and parse through this model.
Trait, lexical-member and static-reference consumers request detached declaration
ASTs through the same planned source-file capability.

This is build-time identity infrastructure backed by the shared 22-row Flash
fixture, not a replay of those behaviors in native factories. Declaration
planning still holds on multiple declarations until trait/reference consumers,
private script initialization and complete module emission support the model.
No helper is registered as a public class or substituted with an Object type.
