# Computed namespace Boolean constants

TLF Configuration initializes namespace Boolean constants using calls and a
chained indexed read. These previously stopped at the computed-constant guard.
The compiler now admits these Boolean expression families only for explicitly
selected class scripts. The common engine publishes a false slot, runs its
one-shot initializer in source order, coerces the result and locks the constant.
Reference constants retain their null default and existing behavior.

Engine runtime and oracle commit: `89614513f17ecb4427dbaec32872fa389658f610`.
Compiler baseline: `e3795184a53c21fde574d07cdd173c18b67d34f6`.

Ten repeated AIR observations match generated ES5 and ES2015 factories in Node
and strict-CSP Chromium. Six rejection guards, seven domain/descriptor checks,
and three actual factory mutations per target pass. Mutations change ordering,
omit initialization or force the wrong value; each is detected in both realms.
Generated and dependency type checks have zero errors. The adjacent reference
constant suite matches 22 AIR observations on both targets/realms with eight
guards and zero type errors. That older adjacent runner uses a dynamic loader;
its comparator controls are not generated-code mutation or strict-CSP proof.

Run from the compiler checkout with the engine sibling at `../engine`:

```powershell
npm run tsc
node tests/native-generated-namespace-boolean-constants/run.cjs
$env:LAYA_ENGINE_REPOSITORY = 'D:\op2-urlrequest-type-tests-20261004\engine'
node tests/native-generated-reference-constants/run.cjs
node tests/native-generated-namespace-boolean-constants/replay.cjs
node tests/native-generated-namespace-boolean-constants/verify.cjs
```

The hash-pinned archive retains source/oracle evidence, compiler/runtime/type
inputs, complete generated factories, bundles, mutations and observations.
The pre-fix failure records its earlier source cohort and compiler hashes;
it is not an executable historical compiler snapshot. `--check-current` also
compares retained files with their original absolute paths.

The complete original Configuration declaration now emits in the preserved
1,356-source context after adding Configuration to the 95 existing class scripts
and supplying the diagnostic Capabilities provider. The same declaration with
the explicitly reviewed native TLF feature adaptation is replayed separately.
Without the provider the unresolved Capabilities guard remains. These are
declaration-emission diagnostics, not whole-factory type/runtime qualification.
Production providers, native TLF feature wiring and real H5 acceptance remain open.
