# Large declaration cohorts

OP2's 1,353-entry startup audit exposed TS2563 in the generated declarations
module and 1,311 dependent implicit-any diagnostics in that same file. A minimal
1,400-Class cohort reproduces TS2563 plus 1,400 implicit-any callback diagnostics
with baseline compiler `161810596`. Adding annotations would mask only part of
the problem: top-level inherited/local conditionals exhaust control-flow analysis.

For cohorts with at least 512 public Classes, the generator now places those
choices in a small typed helper and evaluates only the selected callback. The
512 threshold leaves room below the observed limit for ancestry and interfaces.
Immediate function expressions still contribute to the outer flow graph and
do not solve this failure. Compact cohorts retain their exact output bytes.

The regression contains 1,400 root/derived source declarations. Current output
has zero TypeScript errors. In both ES5/ES2015, Node and Chromium execute the
actual generated declarations against common engine providers. Six checks cover
lazy inherited selection, all 1,400 parent header identities, distinct local
headers, rejected child publication, independent sibling headers and selected
Class resolution. Native fixture Classes supply metadata/publication values;
this is a declaration test, not 1,400 fully emitted application implementations.
A mutation forcing the local branch must fail in each target. Browser CSP
disables runtime compilation. Cohorts of 1, 32 and 511 Classes remain byte-equal
to the baseline, including source ancestry.

```powershell
node node_modules/typescript/bin/tsc --pretty false
node tests/native-large-declarations/run.cjs
node tests/native-large-declarations/retain.cjs .cache/native-large-declarations/run-XXXXXX/report.json
node tests/native-large-declarations/verify.cjs --check-current
```

The runner compiles the exact clean baseline source into its private output
directory. Set `AS3_BASELINE_REPOSITORY` and `LAYA_ENGINE_REPOSITORY` to relocate
the baseline and engine checkouts. The archive preserves both generated modules,
diagnostics and runtime/build input hashes. This does not claim that OP2's other
emission or type failures are fixed; its real startup audit must be rerun with
new pinned, revalidated UI inputs before updating those counts.
