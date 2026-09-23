# Original Array annotation precedence

Unqualified Array field annotations retain the builtin Array type despite an
explicit import of a source class with that name. Qualified probe.Array self
annotations still bind the authenticated source declaration. An unqualified own
Array annotation is ambiguous and remains rejected, matching the retained
original compiler diagnostics. This extends the existing intrinsic annotation
precedence rule; it does not bind arbitrary foreign types or constructors.

run.cjs executes all seven observations from the complete repeated original
name-boundary fixture in Node and Chromium for ES5 and ES2015, using emitted
unchanged Array/Holder sources and actual common-provider declarations. The
fixture driver uses common AS3 property operations; it is not an arbitrary source
assignment or whole-module compiler admission claim. The historical id
imported-builtin-array-reject is retained verbatim: its false value means the
builtin assignment succeeded, as shown in the original body.

Five synthetic metadata/ambiguity guards complement the original rows. Complete
source XML metadata is reconstructed and both original receipts are authenticated.
The separate rejected-own source fails the original compiler with two ambiguous
Array errors; original-ambiguity-repeat.json records a fresh reproduction.

Set LAYA_ENGINE_REPOSITORY to the common engine, PLAYWRIGHT_MODULE to the installed
Playwright package, and PYTHON to the physical Python executable. Build the
compiler with node node_modules/typescript/bin/tsc and run this run.cjs. Optional
COMPILER_UNDER_TEST identifies another compiled checkout. Baseline bfb7dd75 fails
on the unchanged Holder source with AS3_CLASS_METADATA_UNSUPPORTED before runtime.
The runtime provider is pinned to engine643ee1d1. Existing Array-field and
self-constructor suites keep their separately pinned provider baselines.
