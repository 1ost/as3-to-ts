# Generated ErrorEvent type tests

The explicit `nativeErrorEventReferenceModule` provider now qualifies `is` and
`as` in generated method bodies. Emission uses the common AS3 nominal type
operations with the authenticated ErrorEvent token; it preserves operand order,
single evaluation and expression control flow. No runtime implementation changes.

Two AIR captures from engine evidence commit
`e061dadc52d24b2a4ef5be26a766d6b7c54cf9e8` agree on 31 observations. The complete
Reader subject matches all rows in Node and strict-CSP Chromium for ES5/ES2015:
native subtypes/descendants, unrelated values, null/undefined, class/prototype
objects, conversion hooks, short-circuiting, conditionals and thrown values.
Ten compiler guards preserve provider/plan identity, reject shadowed targets,
and hold class-initializer and qualified-name forms. Six host checks cover
forgeries, proxies, copied fields, domain separation and retirement.

Three applied factory mutations (false `is`, null `as`, broken short-circuiting)
are detected in Node and Chromium on both targets. Zero generated TypeScript
diagnostics. The adjacent ErrorEvent subtype reference suite passes 23 AIR rows,
14 rejection guards and its compiler mutation control on both targets/runtimes.

Runtime is `../LayaAir-op2-element-format-class-review` at
`5c699b637a2ac7921e1ae2cf1648c17533238d63`.

Run:

```
npm run tsc
node tests/native-generated-error-event-type-tests/run.cjs
node tests/native-generated-error-event-type-tests/verify.cjs --check-current
```

The archive retains original AIR sources/artifacts, generated factories, baseline
compiler rejection, compiler/type-program/runtime inputs and all primary mutation
bundles. Full source factory, startup and live H5/account acceptance remain open.
