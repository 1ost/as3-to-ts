# Object accessor qualification

The unmodified compiler at d1fcd69 rejects valid Object-typed accessor halves:
PairChild overrides only the setter of a read/write parent; ReadChild adds a
setter beside an overridden getter; WriteChild adds the corresponding getter.
Both ES5 and ES2015 reproduce all three rejection paths using complete source
classes. ReadGrand also preserves the three-level source ancestry in the plan.

`oracle/` is an exact copy of the original evidence committed at engine
393f9e84f in tests/nativeGeneratedObjectAccessors. Its seven source classes and
28 observations were captured identically twice in AIR 51.3.4. No new original
player run is claimed. The runtime provider remains engine 0d177fba3c.

Build the baseline compiler with `node node_modules/typescript/bin/tsc`, then
run `node tests/native-generated-object-accessors/baseline.cjs` at its specified
baseline commit. `verify-baseline.cjs --check-current` checks retained input
hashes against the current checkout; omit the flag for historical evidence
after implementation changes. The baseline is not generated runtime acceptance.

The current full OP2 factory continues on its unchanged provider worktrees.
This separate regression reproduces a previously demonstrated maintained
AlertChooseItemCell/DynamicCellRenderer failure. No production implementation
change is included in this checkpoint. Font rendering is out of scope.
