# Generated Class namespace read regression

```powershell
$env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-class-namespace-review'
npm run tsc
node tests/native-generated-class-namespace-read/run.cjs
```

The complete engine-owned AS3 cohort is emitted using an authenticated source
Class plan. ES5 and ES2015 both type-check with zero diagnostics and execute in
Node and Chromium under a CSP that forbids dynamic code evaluation. Each target
matches all thirteen pinned AIR observations. Sixteen additional native checks
cover Class identity, rejected inputs, exact namespace lookup and independent
ApplicationDomain storage/method closures.

Thirteen compiler checks include a forged plan, a reversion of the Class-value
receiver branch, Object/wildcard receiver holds, namespace shadowing, a source
Class type collision, assignment/compound assignment, deletion, direct method
calls/construction, and prefix/postfix updates. The latter operations remain
held; only a read is lowered to the shared property helper.

Type authority comes from source-backed receiver annotations. A source/provider
Class spelling anywhere in the cohort conservatively prevents treating that
spelling as the intrinsic Class; the authenticated plan also rejects ambiguous
built-in types. Existing ordinary namespace member lowering is preserved.

Reports retain generated modules, exact input hashes, type diagnostics, captures,
and bundles beneath `.cache/native-generated-class-namespace-read/run-*`.
This is focused language/runtime evidence, not full OP2 acceptance.
