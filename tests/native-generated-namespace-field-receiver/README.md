# Namespace field receiver types

Ancestry retains a namespace field's declared type alongside its exact URI and owner. Unqualified receiver inference resolves the opened field before using that type. It does not put namespace fields in the ordinary name-only type table. Local declarations retain precedence, and declaring-unit qualified types cannot be replaced by consumer imports.

Engine AIR authority: `3e967daaa`. Seven snapshots cover inherited static/instance fields, a second namespace's same-name field, a consumer's same-name class import, local shadowing and explicit base access. The pre-fix compiler fails the initial call with swapLines is not a function on both targets.

`npm run tsc` and `node tests/native-generated-namespace-field-receiver/run.cjs` pass ES5/ES2015 in Node and Chromium CSP, including all observer/provider types. Two rejection guards and a public-method substitution check identity boundaries. The inherited static owner regression still passes five snapshots including its collision variant, two guards and receiver mutation.

Use `verify.cjs` for portable retained-evidence verification, and `--check-current` to also authenticate live input files. The pre-fix report is corroborating evidence, not a complete archived rerun environment. This focused result does not establish full client runtime acceptance.
