# Direct source super method evidence

Run from this compiler repository after rebuilding it:

```powershell
node node_modules/typescript/bin/tsc -p .
node tests/native-super-methods/run.cjs
```

The runner defaults to this checkout's current compiled parser/emitter and helper
sources. An isolated compiler under review can be selected explicitly with
`COMPILER_CHECKOUT`; reports record that override and the source/output hashes.
Rebuild the selected compiler before running. No candidate or OP2 application
path is hardcoded.

The sibling `../LayaAir-op2` must contain commit
`d3db69240e22575d48828ae95b1243bc6e593ed1` and installed esbuild/TypeScript.
Playwright must resolve from the compiler or engine, or `PLAYWRIGHT_MODULE` must
name its installed module directory; its Chromium browser must be installed.
Generated files and evidence go into `.cache/native-super-methods/run-*`.

## Exactly what passes, and what remains held

The complete original capture has **25 rows**. Every run authenticates and keeps
all 25. The 23 direct-call observations are compared exactly in Node and current
Chromium with both ES5 and ES2015 emitted classes. Two original observations
remain explicitly held and are printed in every report:

| Original index | Case | Original result | Status |
| --- | --- | --- | --- |
| 23 | Stable receiver-bound detached super closure | `detached:true:middle-zero` | Detached super reads unimplemented |
| 24 | Extra argument to detached zero-parameter closure | `detached-arity:1063` | Detached super invocation unimplemented |

These are not counted as passing native observations. The held source class
`DetachedLeaf.as` and full original SWF/JSON remain in the corpus. Supported
source classes are `Journal`, `Base`, `Middle`, `Leaf`, and `Grandchild`; their
methods are emitted by the selected compiler, without replacement bodies.

The independently authored review corpus in `review-evidence` adds **30 fully
compared observations**, also checked on both targets in Node and Chromium. It
exercises nested lexical calls across multiple inheritance levels, optional
arguments, two distinct receivers, and an ordinary receiver-bound `run` method
closure whose body makes direct super calls. That ordinary detached method is
already supported and does not implement the held detached `super.method` read.
Its exact driver remains in authenticated `review-evidence/review.cjs` and is
reproduced by the portable runner. Combined totals are 55 original observations,
53 compared and two explicit holds; no held review rows exist.

Direct rows cover lexical ancestor selection, override bypass, most-derived
receiver identity, inherited/protected methods, zero-argument calls, Boolean
coercion, optional true/false defaults, actual argument counts, return values,
nested direct calls, evaluation order and exception identity. This is the bounded
direct-super prerequisite for the maintained TweenLite/TweenCore call. It does
not claim the timing classes or full game are otherwise admitted.

Eleven original rejection cases retain the current boundaries: detached read, computed
name, extra argument, absent member, nested function call, constructor-body
super method, Number parameter, omitted required argument, getter, private
method, and rest parameter. Positive scope currently requires a statically known
public/protected instance method with zero parameters or Boolean parameters and
literal Boolean defaults. Expanding that scope requires new evidence and lowering.
Four independent review cases additionally reject an intervening field, getter,
private method or static method that hides an ancestor method. These are
conservative unsupported-shape tests, not claims that each source is valid AS3.
The combined runner verifies all 15 rejections.

## Original authority and type checks

`evidence/receipt.json` maps retained relative paths to original provenance hashes;
`receipt.sha256` authenticates that receipt. The runner authenticates every retained
file and original mapping, verifies full row count and exact held-row identities,
and verifies the original arity diagnostic log against its candidate receipt.
Original paths are historical acquisition records, not runtime dependencies.
Capture-time Flex, playerglobal, Electron and Flash plugin hashes were verified
against their original files when packaging; binaries and browser profiles are
not copied. Retained acquisition scripts require adapting their historical paths
to acquire fresh evidence.
The independent review uses the same mechanism through
`review-evidence/receipt.json` and `review-receipt.sha256`.

The Flash compiler rejected missing and extra direct-call arguments. Exact
sources and original command diagnostics are retained in `evidence/original-arity`.
To reproduce both compiler failures with the recorded SDK (without a Flash player):

```powershell
$env:FLEX_SDK='C:/path/to/apache-flex-sdk-4.16.1'
node tests/native-super-methods/verify-original-arity.cjs
```

That command authenticates SDK/playerglobal hashes, uses retained sources and
writes fresh commands/results only under `.cache/native-super-methods`.

The runtime is the pinned common provider via
`tests/native-instance-initializers/common-runtime.js`. Strict checking uses
TypeScript 4.9.5 declarations freshly emitted from the same committed engine
source, with no declaration rewriting, `strict: true`, and
`strictNullChecks: false`. Both generated targets include a typed inheritance and
return-value consumer. ES5 describes emitted class syntax, not compatibility with
historical ES5-only browsers: the engine and harness need modern JavaScript.
Node's JavaScript sandbox is test-only; this does not introduce production SWF
ABC execution.
