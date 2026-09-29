# Generated Flash parent removal

`node tests/native-generated-parent-removal/run.mjs` rebuilds the compiler,
emits the complete original `removal.Child`, checks all generated TypeScript,
and runs ES5 and ES2015 factories in Chromium. Twelve rows compare with the
two identical Flash 26 captures in the engine's `generated-parent-removal`
oracle. Source, compiler, provider and output hashes accompany each run.

The compiler routes `parent.removeChild(...)`, `this.parent.removeChild(...)`
and typed generated-receiver parent calls through canonical source property
dispatch. It reads parent once before arguments and invokes after argument
effects. The generated class retains its Flash public surface; no Laya Node
implementation members or OP2 casts are added. Local/lexical parent names are
not granted this route. Missing or unrelated reference plans are rejected.

Coverage includes return identity, detach, guarded detach, null root/parent,
argument effects/throws before null dispatch, reparenting during argument
evaluation, bound source methods and a shadowed Object parameter. Existing
Sprite position tests also pass all 21 rows and their guards/mutations.

`node tests/native-generated-parent-removal/verify.cjs` checks retained results
against the exact implementation and original receipt. This qualification is
limited to parent removal; full AnimateLoader and game behavior need their own
runtime comparisons.
