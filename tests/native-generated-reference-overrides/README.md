# Generated source reference overrides

Run `npm run tsc`, then `node tests/native-generated-reference-overrides/run.cjs`.
Complete source declarations from the engine's authenticated
`reference-method-overrides` packet build as parent/child production modules.
Fixed source-class/interface method parameters and returns retain their exact
planned tokens; the engine compares them with the selected parent's signatures.
Direct-super entry uses the parent's existing argument coercion. Return wrappers
and super-call rewrites sharing a source offset now compose in the proper order.

`run-GYGgUc`: ten AIR rows on ES5/ES2015 in Node/Chromium CSP, zero types,
seven identity/domain checks, eight compiler rejection cases, four applied
mutations per target. Mutations remove signatures, bypass parent selection,
change an interface parameter to a source class, and substitute a distinct
authenticated interface token with the same name. Each mutation builds and
fails at its expected runtime boundary.

Regressions: fixed intrinsic overrides `run-KL3x5I` (10 AIR rows), typed returns
`run-q8P32X` (34 AIR rows), loaded interfaces `run-VtpHAw` (61 AIR rows), all on
both targets/runtimes. Optional/rest/native reference/accessor override contracts
remain held; this does not establish full Game startup or account behavior.
