## Retrying ancestors now separately qualified

The adjacent source-unit-ancestor-retry fixture extends this boundary using
74 AIR rows. This runner now admits the two ancestor selections formerly rejected;
it retains nine rejection guards and adds two positive planning checks. The
original runtime archive remains historical. Current adjacent evidence is retained
by native-generated-source-unit-ancestor-retry/verify.cjs.

# Inherited public Class and file-private source-unit retry

The maintained TextFlow source combines an inherited public Class with one root
file-private helper. Its Class-script selection was rejected by the planner even
though the source-only ancestry and root-helper protocols were separately supported.

This fixture combines those protocols against 62 repeated AIR observations from
engine tests/nativeFlashOracle/source-unit-derived-retry. Four public Classes use
direct and two-level ordinary source ancestry, inherited and direct interfaces,
constructor arguments, private parent state and inherited methods. Initializers
fail twice in the public Class or helper; lookups select the helper early or late.
Escaped Classes, source globals, functions, arrays and instances remain observable
across successful retry. The existing helper selection/null and failure behavior
is preserved. Old instances and newly constructed instances both retain their
inherited state and nominal memberships.

The planner now admits one root private helper with ordinary source ancestors.
Retrying ancestors, native ancestry, ancestors with private declarations, inherited
helpers in a derived unit, additional helpers and private interfaces remain held.
This does not extend the already qualified root public Class + MouseEvent helper.

Run from the compiler checkout with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE:

```
npm run tsc
node tests/native-generated-source-unit-derived-retry/run.cjs
node tests/native-generated-source-unit-derived-retry/verify.cjs --check-current
```

ES5 and ES2015 each match all 62 AIR rows in Node and strict-CSP Chromium, with
zero type errors, 11 planner guards and 15 domain inheritance/isolation checks.
Four applied mutations are detected in both runtimes: remove early helper lookup,
discard failed globals, corrupt the derived constructor argument, and erase the
Function parameter intrinsic. The unchanged adjacent MouseEvent-helper retry
fixture also passes 62 rows, nine guards and four mutations per target.

runtime.json.gz retains the pre-fix planner rejection, exact source/oracle bytes,
compiler src/lib/utils, engine/type inputs, generated factories, positive/mutated
bundles and both runtime reports. It is focused qualification, not full OP2
factory/type/runtime or account-driven H5 acceptance.
