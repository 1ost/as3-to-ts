# Computed private static Boolean constants

Run `npm run tsc`, then `node tests/native-generated-boolean-constant-retry/run.cjs`.
Set LAYA_ENGINE_REPOSITORY to the isolated engine and PLAYWRIGHT_MODULE to the
installed Playwright module. Do not run the destructive prebuild workflow in
the junction-backed compiler checkout.

Eight repeated AIR observations match complete generated ES5/ES2015 modules in
Node and strict-CSP Chromium, with zero type errors. Source covers false default
slots, ordered calls and Boolean coercion, new Item().hasOwnProperty(...), an
exception partway through initialization, fresh Class generations on retry,
failed-generation identity, and Boolean variables reading the same private
constant before/after publication. Failed generations keep their original slots.

The compiler admits private static Boolean constants initialized by effectful
calls and exact same-owner variable aliases to those computed constants. Pure
folding, direct builtin Boolean conversion, instance/protected constants and
arbitrary variable aliases remain held. Eight guards include restoration of the
old constant rejection; omitting all Boolean constant publications produces a
proven mismatch in both runtimes. Twenty-eight common-provider checks cover
false defaults, one-shot false publication, coercion without object hooks,
readonly access, exact capabilities/owners, and malformed trait rejection.

Adjacent String constants (seven rows, 21 provider checks) and Vector constant
retry (17 rows, 13 provider checks) also pass both targets/runtimes. The retained
archive contains exact source/compiler/provider inputs, AIR receipts, generated
modules, browser/Node results, and the pre-fix compiler failure on the same input.
Run `node tests/native-generated-boolean-constant-retry/verify.cjs` for portable
verification, or add `--check-current` to compare the retained inputs locally.

This qualifies the shared language/storage behavior. It does not qualify
TextBlock recreation, TextLineRecycler execution or the complete H5 client.
