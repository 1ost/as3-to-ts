# Native foreach receiver and control-flow evidence

This compiler regression package preserves an evaluated Array receiver for each
foreach loop. Receiver functions/getters execute once; reassignment of the
source variable does not replace the enumerated receiver. Each value is still
read at its iteration point, so later value mutation remains visible.

The emitter also reports an explicit unresolved iterator binding for the original
invalid ForEachSimple source rather than crashing or inventing an instance field.
Generated receiver/key names avoid source text and are distinct across nested
loops. Unbraced bodies keep their optional statement terminator inside the new
loop block, including whitespace/comments, while omitted semicolons remain valid.
Compound source nodes with no own end position use their last descendant end.

## Run

```
node tests/native-foreach-receivers/run.cjs
```

Run from any directory. Set `LAYAAIR_CHECKOUT` to an engine Git checkout holding
commit `3d7c64062e899c8aaf4abd141da5c0d4c01f2a4d`, `PLAYWRIGHT_MODULE` to an installed
Playwright module when necessary, and optionally `COMPILER_CHECKOUT` to a built
compiler candidate. The default compiler is the owning package. Runtime and
provider declarations are built from a fresh archive of the exact engine commit;
working-tree engine edits are not used. Dependencies are taken from the configured
checkouts. Output is isolated under `.cache/native-foreach-receivers/run-*`.

The runner authenticates a pinned evidence index, each original receipt and every
retained receipt input before execution. It compares all 23 original cases for
both ES5 and ES2015 on Node and Chromium. Four generated surfaces are checked with
TypeScript 4.9.5 against actual emitted engine declarations, with `strict:true`,
`strictNullChecks:false`, `allowUnreachableCode:true` (intentional false branches),
and ES2015 source libraries. Provider declaration emission uses ES2020. No
provider declaration text is substituted. These checks do not prove old-browser
support. Earlier isolated TS2.5 adapted-declaration results are superseded by this
package's explicit modern check, not reclassified as actual-provider evidence.

`evidence/receivers` retains the original nine cases. `evidence/control-flow`
retains 14 fresh Flash cases: true/false branches with space, block comment,
newline, line comment and omitted semicolon; nested foreach, ordinary for and
if/else bodies; and collisions across nested loop temporaries. The invalid source
and original rejection receipt are in `evidence/invalid`. Absolute paths in old
receipts are historical acquisition data; the pinned index maps retained inputs
portably and runtime verification does not open those historical paths.

Optional original invalid-source recheck:

```
FLEX_SDK=/path/to/apache-flex-sdk node tests/native-foreach-receivers/verify-original-rejection.cjs
```

On PowerShell set `$env:FLEX_SDK` before the command. The script authenticates
mxmlc.jar and playerglobal.swc to the retained original hashes and retains fresh
compilation diagnostics in a separate output directory.

To reacquire a complete corpus, set `FLEX_SDK`, `FLASH_ELECTRON` and `FLASH_PLUGIN`,
then run `python capture.py <source-directory> <new-output-directory>`. The source
directory contains CatchOracle.as and catching/. The capture uses a hidden Flash
window, an ephemeral loopback port and its own profile. Never target retained
evidence directories. Tool binaries and browser profiles are not packaged.

## Boundaries

These Array receiver/value/control-flow comparisons do not admit generic AS3
iteration. Legacy output still uses host for-in. Object/Dictionary enumeration
order, fixed/inherited trait visibility, structural mutation, sparse Arrays,
Vector traversal and iterator assignment coercion remain separate requirements.
The common engine has Array property support, but that does not supply source
foreach enumeration authority. The metadata-enabled compiler still rejects
ForInStatement; the runner checks that rejection explicitly. No OP2 compatibility
implementation or production bytecode interpreter is introduced.
