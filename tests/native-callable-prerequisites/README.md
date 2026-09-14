# Native callable constructor prerequisites

These tests compare the current compiler's emitted classes with retained original
Flash observations. They cover Number/int/uint constructor coercion and argument
arrays, constructor early completion, a single wildcard catch, and interactions
between those features. They do not establish complete AS3 compiler admission,
general typed catch dispatch, full GreenSock readiness, or a running game.

From the compiler repository, rebuild and run:

```powershell
node node_modules/typescript/bin/tsc -p .
node tests/native-callable-prerequisites/run.cjs
```

The sibling `../LayaAir-op2` checkout must contain commit
`d3db69240e22575d48828ae95b1243bc6e593ed1` and its esbuild and TypeScript
dependencies. Playwright must be resolvable from the compiler or engine checkout;
otherwise set `PLAYWRIGHT_MODULE` to an installed Playwright module directory.
Install that module's Chromium browser before running. The runner contains no
application checkout or isolated compiler candidate path dependency.

The runtime comes from the pinned common engine through
`tests/native-instance-initializers/common-runtime.js`. Separate, unmodified
engine declarations are generated from the same committed source archive using
TypeScript 4.9.5. The emitted classes and current compiler helper sources are
checked with `strict: true`, `strictNullChecks: false`, and no declaration
rewriting. AS3 permits null in places TypeScript strict null checking would reject;
this test makes no strict-null-checking claim.

Every run compares all rows in Node and current Chromium for both ES5 and ES2015
compiler output. Counts are 101 numeric, 14 early-return, 12 wildcard-catch and
18 merge-interaction rows: 145 original observations, each checked four times.
ES5 output describes the generated class syntax target. The shared runtime and
test harness use modern JavaScript, including BigInt; these runs do not claim
compatibility with historical ES5-only browsers.

Results, generated TypeScript, bundles, declaration inputs and source hashes go
under `.cache/native-callable-prerequisites/run-*`. The Node `node:vm` use is a
test-only JavaScript sandbox. Production executes native generated JavaScript;
these tests do not execute SWF ABC in production.

## Original evidence

Each `evidence/*` directory retains exact original AS3 source bytes, compiled SWF,
Flash JSON, capture scripts, commands and original provenance. `receipt.json`
maps original source paths to retained relative paths. `evidence-index.json`
authenticates each receipt. The runner verifies every retained byte against its
receipt, then ties authenticated copied files back to the original provenance,
before compiling or comparing anything. Original absolute paths in provenance
are historical capture information and are not runtime dependencies.

All four original provenance sets were verified against their original files,
including the recorded Flex compiler, playerglobal, Electron and Flash plugin
hashes, when packaged. Those external SDK and player binaries are not copied.
The retained Python scripts describe the historical acquisition process and
contain original machine paths. They are not the portable regression entrypoint;
fresh Flash acquisition requires supplying equivalent tools and adapting capture
locations while retaining new provenance.

The numeric native `Recorder` is instrumentation only. Its driver and recorder
are retained verbatim from the verified numeric comparison fixture. All subject
classes are emitted from authenticated AS3 source. Numeric result comparisons
include the recorded binary64 bit strings, including supplied NaN payloads, with
no normalization or excluded rows. The other groups emit their journal classes
as well as subject classes. Native catch and constructor traces are compared
exactly with the original JSON.

The early-return corpus excludes a source fixture that the original Flash
verifier rejected. No rejected fixture is counted as a passing comparison. The
compiler's independent rejection and initializer suites remain necessary; this
directory supplements those suites.
