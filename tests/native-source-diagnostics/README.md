# Collecting source emission failures

`emitNativeSourceClassModule` accepts `collectSourceErrors: true` for bulk
diagnosis. It attempts every planned class, file-private class and interface,
then throws if any declaration failed. The error's immutable `sourceDiagnostics`
records contain the declaration identity, owning source unit, source hash and
original error message. No partial module, generated source array or loader is
returned. Errors in planning, cohort validation or module assembly still stop
their phase immediately. Omitted/false keeps the original fail-fast behavior.

Build and run from this checkout with `LAYA_ENGINE_REPOSITORY` set to the
`LayaAir-op2-object-accessor-runtime-review` checkout at f46db1d33:

    node node_modules/typescript/bin/tsc
    node tests/native-source-diagnostics/run.cjs
    node tests/native-generated-object-accessors/run.cjs
    node tests/native-generated-private-interfaces/full.cjs

The focused test covers two real static-initializer failures separated by a
valid class, a later interface, repeated use of the same plan, original default
failure identity, immutable diagnostics, invalid options and early cohort
rejection. Controlled emitter failures check public/private interface and
file-private class ownership. Successful artifacts are identical with the
option on/off, including the seven complete original Object-accessor classes
and a source unit containing private class/interface declarations.

Validation passes in ES5 and ES2015. Adjacent original-source runtime tests
match 28 Object-accessor and 21 private-interface AIR observations in Node and
CSP Chromium with zero type errors. This adds build-time diagnostics only; it
does not admit failed classes or qualify an application cohort.
