# Derived Class script initialization retries

Run `node tests/native-generated-derived-script-retry/run.cjs` after `npm run tsc`.
The four unchanged sources come from OP2's authenticated derived-script-retry AIR
packet (evidence commit 8df14f0f), including complete maintained EMVC Proxy and
IProxy. All sixteen AIR rows pass through the production module factory on
ES5/ES2015 in Node/Chromium, with zero provider/output type errors and browser
CSP forbidding runtime compilation.

The explicit classScriptSources selection may now include a child of a planned
source root Class whose initialization does not use this retry selection. The
existing emitter still rejects unqualified initializers in the parent. Failed
child Class/global/closure identities remain distinct between attempts, while
old instances retain declaration type, parent/interface membership, constructor
argument storage and inherited method behavior. The later successful Class
object differs from the failed object without changing the source type identity.

Nine domain checks cover separate and inherited Class/interface identities.
Seven rejection cases retain unqualified parent retries, missing parent globals,
interface selection, internal aliases, native parents, multiple ancestry levels
and missing explicit initializer authority. Applied mutations switch to the old
script provider and corrupt the parent constructor argument; both are detected.

This does not qualify parent initializer failure, native parent lifecycle,
multi-level retries, cycles, ZIP namespaces or full store/archive execution.
