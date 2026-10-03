# Object accessor qualification

The unmodified compiler at d1fcd69 rejects valid Object-typed accessor halves:
PairChild overrides only the setter of a read/write parent; ReadChild adds a
setter beside an overridden getter; WriteChild adds the corresponding getter.
Both ES5 and ES2015 reproduce all three rejection paths using complete source
classes. ReadGrand also preserves the three-level source ancestry in the plan.

`oracle/` is an exact copy of the original evidence committed at engine
393f9e84f in tests/nativeGeneratedObjectAccessors. Its seven source classes and
28 observations were captured identically twice in AIR 51.3.4. No new original
player run is claimed. The baseline runtime provider is engine 0d177fba3c.

Build the baseline compiler with `node node_modules/typescript/bin/tsc`, then
run `node tests/native-generated-object-accessors/baseline.cjs` at its specified
baseline commit. `verify-baseline.cjs --check-current` checks retained input
hashes against the current checkout; omit the flag for historical evidence
after implementation changes. The baseline is not generated runtime acceptance.

The shared compiler now projects Object getter/setter halves using authenticated
source ancestry and captures the selected direct-super accessor. Engine
f46db1d33 registers those contracts and retains the complementary parent half.
Existing override/final/type checks and native Event restrictions remain intact.
Original source classes are unchanged; no OP2 compatibility substitute is used.

The retained generated run matches all 28 original AIR observations in ES5 and
ES2015, in Node and CSP Chromium, with zero type errors. Twelve rejection guards
and two applied runtime controls pass. Adjacent Number/String/DisplayObject/
DataEvent regressions contribute 122 original observations; native Number adds
36 observations, 14 guards and two applied implementation controls. Regression
reports taken before the engine commit preserve that historical HEAD field;
their source hashes match the committed implementation. The Object report uses
the committed engine pin directly.

Set LAYA_ENGINE_REPOSITORY to ../LayaAir-op2-object-accessor-runtime-review and
run `node tests/native-generated-object-accessors/run.cjs`. Use
`verify.cjs --check-current` to authenticate the retained results against current
compiler, fixture, typecheck and runtime inputs. `retain.cjs` accepts the Object,
Number, String, DisplayObject, DataEvent and native Number report paths, in order.

The full OP2 factory continues on its unchanged provider worktrees. This separate
fix addresses the previously demonstrated AlertChooseItemCell/DynamicCellRenderer
gap; maintained application replay at the new pair remains required. Neither
whole-client runtime nor H5 acceptance is claimed. Font rendering is out of scope.
