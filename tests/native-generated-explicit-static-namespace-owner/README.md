# Explicit static namespace declaring owner

Generated explicit namespace selectors with an implicit receiver use the same authenticated declaring-owner import and initialization helper as opened namespace identifiers. Ordinary non-generated namespace emission retains its existing route. The owner helper handles missing ancestor imports, source name collisions and file-private declarations without adding public aliases or type suppressions.

AIR authority: engine b20c6c1b7. Five snapshots cover field/method/accessor reads and writes through public Child and file-private PrivateReader, neither of which imports Base. Before the fix both targets had nine missing-name diagnostics and failed with Base is not defined.

`npm run tsc`; `node tests/native-generated-explicit-static-namespace-owner/run.cjs`; namespace-field-receiver regression. Both targets match AIR in Node and Chromium CSP with zero errors. Missing owner imports are rejected separately in public/private declarations, copied plans are rejected, and a bare-owner substitution reproduces the original runtime failure. The seven-row namespace-field regression and its controls also pass.

Use `verify.cjs` for portable evidence checks and `--check-current` for live input hashes. The pre-fix report corroborates the defect without claiming a full archived pre-fix rerun environment. Whole-client runtime acceptance remains separate.
