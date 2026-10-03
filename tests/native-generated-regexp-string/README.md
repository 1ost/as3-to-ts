# Generated String operations with stored RegExp instances

Run `npm run build`, then `node tests/native-generated-regexp-string/run.cjs`.
`LAYA_ENGINE_REPOSITORY` defaults to `../LayaAir-op2-regexp-string-review`.

The exact captured AIR source is generated into native ES5 and ES2015 modules.
Each target matches 25 AIR observations in Node and Chromium under a strict
script policy, with seven domain/identity checks and zero explicit-root type
errors. Source hashes, generated modules, bundle inputs and results are retained.

The fixture exercises private static RegExp constants passed to String match,
replace and split, including capture substitution, empty results and lastIndex
state. Local variables and method parameters use the same nominal provider;
parameter and return annotations must not silently select the host RegExp type.

A derived class initializer fails once, leaks its class/pattern identities, then
retries. The retry publishes distinct identities with the captured AIR state.
An authenticated custom-namespace method remains callable in this cohort.
Explicit/default package-internal members and unknown namespace spellings remain
rejected. Other guards cover absent retry authority, forged plans, split limits,
and a reverted deferred-constant lowering control (seven guards total).

This proof is bounded to typed String receivers and qualified stored patterns.
It does not qualify new RegExp grammar, split limits, the four existing Unicode
match-index differences, complete property factories, or the real H5 game.
