# Declared method Function intrinsics

Run `npm run tsc`, then `node tests/native-generated-method-intrinsics/run.cjs`.
Complete unchanged Subject/Target sources use the production factory on
ES5/ES2015. All 17 authenticated AIR rows match in Node/Chromium under CSP with
zero generated/provider type errors. Two domain checks and an applied returned
literal mutation are checked. Own/private/static/imported/instance method
values preserve their existing closure selection, then call/apply uses the
common Function intrinsic provider, including argument-list and arity errors.

Only source-declared method values and previously admitted Function locals are
recognized. Shadowed names and arbitrary properties gain no method authority.
The separate private `join`/Array.join collision found by the initial probe is
retained in the engine's local first capture and is not fixed by this change.
