# Generated display-reference accessor halves

GuideStepClick's Sprite and DisplayObject getter overrides hold under compiler
6ff44ae. This fixture emits four complete original AIR classes through the
production factory. Source interface/scalar admission is extended only to plan
bindings for the two native display reference types. Direct super accessor
lowering admits those same types. Exact type, override, final and parent-half
checks remain in place; the engine authenticates the actual native constructors.

The baseline compiler rejects the complete fixture in both ES5/ES2015 at Child's
getter override plus new setter; baseline.json retains the rejection and commit.
The fixed pair matches all 27 original AIR observations in Node and CSP Chromium
for both targets. Six compiler guards, six runtime guards, two applied contract
mutations per target and strict type checks pass. Evidence/source and the common
runtime observer are in the engine's tests/nativeGeneratedDisplayAccessors.

From the compiler root, with LAYA_ENGINE_REPOSITORY set to the isolated
LayaAir-op2-display-accessor-review checkout:

    node node_modules/typescript/bin/tsc
    node tests/native-generated-display-accessors/run.cjs
    node tests/native-generated-display-accessors/verify.cjs --check-current
    node tests/native-generated-display-accessors/verify-regressions.cjs --check-current

Regressions retain Number accessors (36 AIR rows), String accessors (23) and
native Sprite position overrides (21), both targets, zero types and existing
rejection/mutation checks. Reports preserve exact compiler/runtime/type hashes.
The NoRender host proves reference behavior only. OP2 provider refresh, maintained
GuideStepClick replay, subsequent factory closure, full H5 and account acceptance
remain separate work. Font rendering is excluded.
