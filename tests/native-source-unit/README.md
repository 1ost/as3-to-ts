# Exact source-file declaration model

Run `node tests/native-source-unit/run.cjs` after building the compiler.
The model consumes the complete retained Flash First/Second files without
rewriting or splitting source. Their three private descriptors have no public
QName. First.Helper and Second.Helper remain different identities although both
reflect as ::Helper; the child descriptor remains owned by First's file.

Eight rejection checks cover cross-file or forged descriptors, serialized units,
changed bytes, owner mismatches, duplicate locals, forged planner access.
The multiple-declaration planner now preserves two private bindings for First.
ASTs are detached copies: consumer mutation cannot change cached source authority.
Existing single-declaration plans now retain and parse through this model.
Trait, lexical-member and static-reference consumers request detached declaration
ASTs through the same planned source-file capability.

This is build-time identity infrastructure backed by the shared 24-row Flash
fixture, not a replay of those behaviors in native factories. Declaration
planning admits private headers; native emission remains held until trait
consumers, private script initialization and complete module emission support them.
No helper is registered as a public class or substituted with an Object type.

Run `node tests/native-source-unit/resolve.cjs` for resolution coverage. The
primary class uses package imports; helpers use imports outside the package,
matching the two additional Flash rows. Sixty-three type/base references and two
Vector element sites retain their owning helper descriptor. Four guards reject
forged scopes and unresolved import collisions. The same resolver now serves
existing generated declaration and reference consumers; private identities remain
held at emission until per-declaration binding and script publication are ready.

## Interface source spans

`node tests/native-source-unit/interfaces.cjs` authenticates the engine's
`file-local-interfaces` packet and checks four interface declarations, 77 type
references and four authority guards. Interface names and comma-separated bases
must point to their original tokens, and unmodified declarations must include
the opening `interface` keyword. The test fails on the prior parser, which
recorded the following token's offset and reduced the declaration start to its
body. This covers source identity and offsets, not runtime implementation.
