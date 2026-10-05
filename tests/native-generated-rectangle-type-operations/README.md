# Generated Rectangle type operations

The original FlowLeafElement source uses `values[index] as Rectangle` after its
FontDescription local is resolved. Rectangle already had a closed allocation
identity and explicit provider binding, but native reference analysis rejected
this operation. The compiler now admits `as` and `is` through that existing
binding and emits common AS3Type helpers with one operand evaluation.

Two AIR captures contain 49 identical rows for direct and indexed casts/tests,
null/undefined, authentic rectangles, wrong native types, structural objects,
conversion hooks, primitives, Class and prototype objects. The unchanged Subject
is generated for ES5 and ES2015 and loaded through real source-class sessions.
Both targets match all rows in Node and CSP-constrained Chromium, with zero type
diagnostics. Four host guards reject prototype clones, proxies and structural
forgeries without executing proxy traps. Ten compiler guards retain explicit
module/provider authority, reject shadowed targets and hold class initializers.
Three applied mutations per target detect erased casts, forced membership and
duplicate index evaluation.

Set LAYA_ENGINE_REPOSITORY to the isolated engine checkout. Run `npm run tsc`,
then `node tests/native-generated-rectangle-type-operations/run.cjs`. Results go
to a fresh ignored .cache directory. Retain once using `verify.cjs --retain
<report.json>`; `verify.cjs --check-current` checks exact current retained inputs.
The archive includes AIR evidence, compiler/engine/type inputs, emitted factories,
all executable bundles and results. Existing rectangle return and constructor
regressions also pass: 86 and 29 rows respectively on both targets.

This does not qualify dynamic Class-valued targets, generated Rectangle subclasses,
class initializer type operations, complete original TLF execution or H5 startup.
