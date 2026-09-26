# Generated protected direct-super calls

Run `npm run tsc -- --pretty false` then
`node tests/native-generated-protected-super/run.cjs` from the compiler root.
The isolated engine defaults to `../LayaAir-op2` and can be selected explicitly
with `LAYA_ENGINE_REPOSITORY`.

Sixteen authenticated AIR observations pass through production parent/child
factories in Node and Chromium CSP, for ES5 and ES2015, with zero type errors.
The compiler uses the existing shared lexical super capability on the current
instance. The selected parent supplies coercion and defaults; ordinary protected
calls continue to dispatch virtually. No public prototype alias is fabricated.

Three domain/lifetime checks cover parent reuse, sibling identity and retained
callbacks. Six compiler guards retain unsupported arity, rest, static caller,
method-value and private-parent boundaries. Two mutations first build and then
fail: switching super access to virtual recurses, and removing parent selection
violates the shared parent identity check. Initial run `run-2QDrQN` passes;
`run-HimgqP` adds the six explicit guards. Existing public optional-super remains
green (`run-PwPhky`, thirteen AIR observations in both targets/runtimes).

This is source-language evidence, not full game/account validation.
