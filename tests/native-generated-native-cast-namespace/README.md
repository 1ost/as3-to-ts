# Canonical MovieClip casts and namespace namesakes

`InlineGraphicElement` declares an opened-namespace `stop` method and calls
`MovieClip(value).stop()`. Losing the cast receiver identity made the compiler
reject the public call as an unresolved namespace access. Once that guard was
cleared, the fixture exposed that the cast itself was erased as a TypeScript
assertion, losing native coercion errors.

The emitter now authenticates the MovieClip cast target through the existing
reference plan/provider binding and rejects lexical shadows. It preserves the
receiver identity during namespace checks, emits common nominal coercion, and
uses common invocation/source-error helpers for a following named method call.
Receiver coercion precedes argument evaluation; arguments precede lookup and
null-receiver errors. Real opened source namespace methods retain their keys.
Engine runtime source is unchanged.

Oracle commit: `14ea51158c5d761c92375e4465912c832fbe2020` on
`port/op2-native-cast-namespace`. Compiler base:
`0f56f4b9f1630712aa0bab8d7be8130f997e6ae8`.

## Validation

The complete Reader and namespace source match all fifteen repeated AIR rows
on ES5/ES2015 in Chromium with Laya initialized, under `script-src 'self'`.
Cases cover public/namespace dispatch, direct cast identity, null and undefined,
wrong native and ordinary values, error IDs 1009/1034, once-only operands, and
coercion/argument/lookup ordering. Four host checks include domain/instance
isolation, forged native identities without inspecting traps, and retirement.
Eleven rejection guards check plan/provider authority, shadows, arity and
untyped namesake receivers. Three executed factory mutations per target erase
coercion, select a wrong namespace result, or replace the null error; each is
detected by the original observations.

Adjacent generated MovieClip references match 22 AIR rows on both targets in
Chromium/Laya (nine guards, zero types). The older loader is not strict-CSP
proof. Source namespace namesakes match sixteen AIR rows on both targets in
Node and strict-CSP Chromium (seven guards, four host guards, two mutations).
Ordinary consumer mode also matches 22 MovieClip rows on both targets in
Chromium/Laya, with nine guards and zero types. Its additional outputs are
retained in `consumer-runtime.json.gz`; run `verify-consumer.cjs` to verify them
against the shared inputs and oracle in the main archive.
`npm run tsc` and all generated/dependency type checks pass.

Run from the compiler with the pinned engine at sibling `../engine`:

```powershell
npm run tsc
node tests/native-generated-native-cast-namespace/run.cjs
$env:LAYA_ENGINE_REPOSITORY='D:\op2-urlrequest-type-tests-20261004\engine'
$env:OP2_BROWSER_REPOSITORY='C:\Users\admin\Desktop\GITHUB REPO\op2-html5\game-client-laya'
node tests/native-generated-movieclip-references/run.cjs --combined
node tests/native-generated-namespace-namesake/run.cjs
node tests/native-generated-native-cast-namespace/verify.cjs
```

`runtime.json.gz` retains 1,367 exact input/output files (21,119,530 bytes;
SHA-256 `cc076ce1ce7f5a7d6749af8a97cc0002f73e187822396414e1a18ad36f4c6e8c`).
It contains the compiler, generated factories, executed browser bundles and
mutants, source/AIR receipts, all three reports, and original-source replay.
The verifier authenticates those retained bytes without old worktrees;
`--check-current` also requires recorded absolute paths and compares live bytes.
The historical baseline failure uses the six-row `evidence-qualified` cohort;
final parity uses the expanded fifteen-row cohort. The initial failed AIR
harness attempt is retained but supplies no expected observations.

## Original-source replay

The unchanged 1,356-source / 95-script plan now emits InlineGraphicElement
(144,704 characters, SHA-256
`6616e89af57ab3dbf713075c2e059fa93d86443dbba9ce85e938be8ddd9ddb3d`) when
Capabilities is mapped only inside the diagnostic subprocess. `replay.cjs`
retains the actual output and verifies the original source hashes. Without
that temporary mapping the missing Capabilities identity still holds.

No production provider or main dependency pin was promoted. Capabilities
members/version gates, complete factory/type/startup integration, and actual
H5/account behavior remain open. This is not whole-client runtime acceptance.
