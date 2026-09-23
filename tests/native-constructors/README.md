# Constructor and native class binding regressions

Run `npm run tsc`, then `npm run test:native-constructors`.
The emitted AS3 fixtures and compiler-distributed decorators execute under both
ES5 and ES2015 output targets. Tests cover implicit Object construction,
explicit base arguments and evaluation order, constructor-time method closure
capture, inherited methods and overrides, symbol methods, `super.method()`
dispatch, static descriptors/state, native `new.target`, and `instanceof`.

Only a zero-argument `super()` in a proven constructor without an explicit
`extends` clause is omitted. Nonempty implicit-Object super arguments fail
explicitly instead of discarding their evaluation. Explicit superclass calls
remain in their original order, including calls after preceding statements.

`classBound` now forwards native construction with `Reflect.construct` and
preserves the existing ES5 base-constructor apply path. `bound` supplies lazy
method closures so extraction during a constructor works before construction
finishes. The selected declared methods are also bound eagerly after a
successful construction. Normal construction therefore retains own bound
methods without executing a method body during binding. Symbol properties,
static descriptors, inheritance, and native-class construction use the same
shared utility code; there are no game-specific runtime substitutes.

For a separate real-source check, run:

```powershell
node tests/native-constructors/RecoveredTlfIntegration.js <OP2-checkout> <LayaAir-checkout>
```

This validates the retained recovery hashes and runs the complete recovered
ImportExportConfiguration and FlowElementInfo, the maintained `tlf_internal`
declaration, and the actual Laya `getQualifiedClassName` implementation. It does
not alter AS3, strip decorators/imports, supply mock dependencies, or write any
OP2 files. Source recovery, broader TLF features, the production module loader,
and in-game validation remain separate obligations.
