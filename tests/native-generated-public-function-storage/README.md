# Public Function-valued member calls through lexical storage

The generic lexical emitter now lowers authenticated foreign public field and
accessor dot calls through the shared as3CallNamedProperty helper. It retains
the receiver before evaluating arguments and reads the final member afterward.
This unblocks OP2's `this._data.callback(this._data.parameter)` without changing
AS3 source, adding a local shim or changing engine runtime. Public method calls
and unsupported compound writes retain their separate lowering and guards.

The 17-row AIR oracle is committed in engine
8ae9f5b793d1c56a00a45daf527c68c2f4b70d3f. Source Reader/Holder are emitted as
native factories; the observer mirrors the AIR wrapper using canonical calls
and bound-method extraction. Both ES5/ES2015 targets match in Node and strict-CSP
Chromium, including null/non-callable errors, getter and argument exceptions,
callback/receiver replacement and bound/unbound receivers. Five domain checks,
two rejection guards and generated/observer typechecks pass. An applied lookup-
before-arguments mutation differs on seven rows in both runtimes.

Adjacent source-accessor (14 rows), Object-field call (12), and lexical Function
(38) suites also pass: 64 rows. The older lexical Function runner uses its
existing dynamic loader; only the primary and factory suites claim strict CSP.

Build with `node node_modules/typescript/bin/tsc --pretty false`; run
`node tests/native-generated-public-function-storage/run.cjs`. The default engine
is ../LayaAir-op2-public-function-review; LAYA_ENGINE_REPOSITORY overrides it.
Run the three adjacent suites with that environment variable. retain.cjs takes
the four report paths in the order above and saves exact sources, compiler build,
generated factories, executed positive/mutated bundles, dependencies and oracle
artifacts/tooling. Older adjacent suites retain their existing evidence contracts.

`node tests/native-generated-public-function-storage/verify.cjs --check-current --check-git`
authenticates the archive and current inputs. Git requires exact changed lexical
source bytes and permits only CRLF/LF normalization for unchanged compiler files.
This focused proof does not qualify complete PromptTextPanel, startup or H5.
