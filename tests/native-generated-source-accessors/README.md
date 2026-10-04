# Source declaration accessor halves

QuestTreeCell and QuestTreeRoot override a TreeCellData setter while inheriting
its getter. The prior compiler rejects the complete OP2 cohort with an inherited
collision/partial override hold. A five-class fixture isolates the same operation
and a further getter override. Two identical AIR captures establish 14 observations.

Public source declaration tokens now qualify for accessor-half projection and
direct-super selection. Exact token/name matching and the existing signature,
override and final checks remain required. The paired common engine accepts
authenticated declaration tokens in accessor signatures and selected-parent
merging. No native provider allowlist or private-class scope is broadened.

The complete fixture emits and type-checks in ES5 and ES2015, and matches AIR in
Node and CSP Chromium. Cases cover complementary-half retention, direct-super and
virtual dispatch, null/undefined coercion, unrelated-class/object/primitive
rejection before setter effects, and reflection ownership. Ten compiler guards
per target reject forged plans, mismatched types, missing overrides, final parent
halves and duplicate getters. Two emitted flag mutations per target are applied
and rejected by the runtime in both realms. Adjacent Object and Number suites
pass another 64 AIR rows with their existing guards and mutations.

```powershell
node node_modules/typescript/bin/tsc
node tests/native-generated-source-accessors/run.cjs
node tests/native-generated-source-accessors/verify.cjs --check-current
```

The default runtime is `../LayaAir-op2-source-accessor-review`; an explicit
`LAYA_ENGINE_REPOSITORY` overrides it. Reports retain exact compiler, fixture,
typecheck and runtime input hashes. Their engine HEAD predates the paired engine
commit; the recorded source hashes authenticate the tested changes. See that
engine's `tests/nativeGeneratedSourceAccessors` for the paired verification.

This is a language/runtime regression fixture. Complete OP2 replay, quest Tree
integration and H5/account acceptance remain separate checks. No font changes.
