# Source interface method references

Run `npm run tsc`, then `node tests/native-generated-interface-method-read/run.cjs`.
The default engine is `../LayaAir-op2-interface-method-read-review`, evidence
commit `1395c7a0f6f42d11965ea0e8ace75814743c1bb2`. Its runtime is unchanged from
the preceding interface-write provider.

The retained compiler baseline rejects `return value.add` with "interface method
currently requires a call". The fix admits reads through the existing public
property bridge only after the original exact reference-plan and property-provider
checks. That bridge supplies the bound method closure. Method writes, compound
assignments and direct construction through the interface member remain rejected.

Seven complete source units, including a file-private implementation and a public
override, reproduce all 28 repeated AIR observations on ES5 and ES2015 in Node
and strict-CSP Chromium. Generated/provider type checking has zero diagnostics.
Eight rejection checks cover providers, forged plans, incompatible interface
signatures and unsupported member operations. Two executable factory mutations
per target incorrectly share a closure across receivers or repeat the chained
getter. Both Node and Chromium detect each mutation.

`verify.cjs --check-current` authenticates the baseline failure, AIR sources,
compiler/provider bytes, generated outputs and runtime comparisons. The observer
uses the existing Function construction helper for `new fn()`; the Class-only
helper is a different contract and is not used for that comparison.

`verify-adjacent.cjs --check-current` authenticates 52 additional observations:
13 chained getter and 18 chained call rows from AIR, plus 21 file-private interface
rows against the retained older browser Flash captures. All run on both targets
in Node and Chromium. The chained-call rejection test now checks compound method
assignment instead of rejecting the newly qualified method read. The private
interface test expects the current exact-provider error for a missing setter
provider. Source fixture bytes remain unchanged.

This fixes the older private-implements regression hold; it does not prove full
OP2 factory assembly, generated application types or real H5 account acceptance.
The independently running interface-write factory keeps its existing pins.
