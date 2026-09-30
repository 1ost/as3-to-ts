# Mixed new and overridden accessor halves

This test compiles all six original fixture Classes and their IValue interface
from engine commit b6d09f583 (the complete immutable hash is in compile.cjs).
The shared registrar prerequisite retains two identical AIR captures with 17
observations. Native loading sessions execute the complete generated Class
bodies, constructors, interface implementation and super calls. The host observer
replaces only AIR capture and E4X reflection plumbing.

All 17 observations match ES5 and ES2015 in Node and Chromium under a self-only
script CSP. Type checking reports zero errors. Twelve rejection checks retain
plan identity, half override/final rules, type identity and duplicate rejection.
Two applied mutations of emitted interface accessor contracts separately remove
the existing getter's override flag and add an override flag to the new setter;
both fail registration in both runtimes at the expected half-authority check.

The compiler now pairs qualified getter/setter declarations with independent
override flags, validates each inherited half, and emits authenticated interface
contracts. Public interface super calls select the original ancestor's exact
accessor half. Unqualified Class-reference signatures and mixed final flags
retain their existing holds. Native Sprite/MouseEvent admission is unchanged.

```powershell
node node_modules/typescript/bin/tsc --pretty false
node tests/native-generated-accessor-halves/run.cjs
node tests/native-generated-accessor-halves/verify-runtime.cjs --check-current
```

Fresh independent-type (41 rows) and namespace (46 rows) compiler regressions
also pass on both targets and runtimes. This fixture does not qualify complete
TextFlow/FlowElement behavior, full client startup or live game navigation.
