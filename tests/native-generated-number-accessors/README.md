# Complete source Number accessor halves

The OP2 factory stopped in ScrollPane while projecting ScrollBar.width: its
parent supplies a Number getter/setter pair, while ScrollBar overrides only the
getter and swaps super.width/super.height. Previously the shared compiler and
runtime limited public Number half contracts to x/y.

General source Number accessor halves and direct-super calls now use the
existing independently owned accessor protocol. Native Sprite and MovieClip
name restrictions remain in place. Number is the only newly admitted type;
this does not expand public int/uint or arbitrary native accessor support.

The unchanged compiler at 4e9e4d3 rejects the new width fixture in both targets;
baseline.json records its exact compiled input hashes and errors. Eight complete
original AIR source classes now compile through the native factory. All 36 AIR
observations match ES5/ES2015 in Node and CSP Chromium, with twelve compiler
guards, two applied invalid-contract controls per target, and zero types.
The original AIR packet and native registrar qualification are in the isolated
engine tests/nativeGeneratedNumberAccessors, not reconstructed game behavior.

Set LAYA_ENGINE_REPOSITORY to ../LayaAir-op2-number-accessor-review, build with
node node_modules/typescript/bin/tsc --pretty false, then run:

    node tests/native-generated-number-accessors/run.cjs
    node tests/native-generated-number-accessors/verify.cjs --check-current
    node tests/native-generated-number-accessors/verify-regressions.cjs --check-current

String accessors (23 AIR rows), independently typed halves (41), and native
Sprite positions (21) remain covered by their existing complete-source suites.
The Sprite runner now accepts LAYA_ENGINE_REPOSITORY so regressions use the exact
candidate runtime; its default and test subjects/assertions are unchanged.
Historical engineCommit in the distinct-types report labels the original AIR
packet. Actual runtime/compiler dependencies are authenticated from input hashes.

This is shared provider qualification, not OP2 integration. Existing consumer
pins still select engine 33f0bd991 and compiler d4c10497. Refresh provider proofs
and replay complete ScrollPane before claiming its hold cleared. Full-client
startup, types and authenticated game acceptance remain open; font rendering is
not part of this change.
