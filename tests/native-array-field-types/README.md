# Authenticated Array field reference binding

This suite compiles an unchanged original Object-root class with public instance
and static Array fields through the metadata-aware lazy Class emitter. It uses
the actual common engine at commit 9fd3c0ab0480e09907da5974c484a1db3875570e.
Fourteen original Flash observations, captured twice, cover defaults, identity,
undefined/null, wrong object/number/array-like/Vector inputs, skipped valueOf,
independent instance storage, and original assignment RHS.

The driver invokes common property operations against the emitted class. It is
not a claim that arbitrary source assignments or whole TweenPlugin are compiled.
Reference field metadata now contains the genuine builtin Array constructor,
captured outside authored modules by callableClassIntrinsics. An authored local
name cannot replace that binding. Authenticated self-reference binding remains
unchanged; foreign source reference classes remain separately gated.

Build the compiler with `node node_modules/typescript/bin/tsc`, set
LAYA_ENGINE_REPOSITORY to the common engine checkout, PLAYWRIGHT_MODULE to an
installed Playwright package, and PYTHON to the Python executable. Then run
`node tests/native-array-field-types/run.cjs`.

The suite rebuilds metadata from retained XML after authenticating source/SWF
receipts. It checks actual provider declarations and generated TS, executes ES5
and ES2015 output in Node and Chromium, and rejects source/type metadata changes.
It makes no rest/arguments, lexical/accessor, foreign type, or full timing claim.
COMPILER_UNDER_TEST optionally selects a separate compiler checkout for baseline
comparison; its source and compiled lib must agree.
