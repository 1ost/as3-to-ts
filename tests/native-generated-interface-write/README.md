# Source interface assignments during lexical lowering

Run `npm run tsc`, then `node tests/native-generated-interface-write/run.cjs`.
The default engine is the isolated sibling `LayaAir-op2-interface-write-review`.

The preceding compiler rejects the unchanged Reader assignment with "interface
getter currently requires a property read". `baseline-failure` preserves the
failure report and preceding lexical compiler TS/JS bytes. Lexical lowering now
resolves both getter and setter contracts, including inherited source interfaces,
then checks the requested operation and its exact property provider. Assignment
uses the existing common setter bridge. Getter-only writes, setter-only reads,
compound assignments and accessor calls remain rejected.

All 28 repeated AIR observations match complete generated ES5 and ES2015 sources
in Node and strict-CSP Chromium, with zero generated/provider type diagnostics.
Nine rejection checks cover missing/mismatched providers, forged plans, absent
accessors and unsupported operations. Two actual executable factory mutations
per target coerce the assignment result incorrectly or repeat the receiver;
both Node and Chromium comparisons detect them.

`verify.cjs --check-current` verifies retained original sources, compiler/provider
inputs, generated output, comparisons and mutations. `verify-adjacent.cjs
--check-current` verifies 31 adjacent chained-getter/interface-call observations
on both targets and runtimes, plus their guards and Node mutation comparisons.

The older `native-generated-private-implements` suite is not counted as passing.
On pinned compiler `092001aa0`, its missing-script-provider test is intercepted
by the same interface assignment hold. With this fix it advances to the separate
"interface method currently requires a call" hold when reading a method value.
The runner then rejects that unexpected error. Full method-value qualification
remains separate; the prior suite was already held on the pinned baseline.

This qualification does not establish complete Step emission, full source factory
assembly or OP2 runtime acceptance. Those require the retained application retry.
