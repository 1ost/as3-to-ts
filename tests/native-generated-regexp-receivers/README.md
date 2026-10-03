# Generated RegExp calls on arbitrary receiver expressions

```powershell
$env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-regexp-receivers-review'
node tests/native-generated-regexp-receivers/run.cjs
```

The test authenticates 31 AIR observations from `regexp-receivers` and compares
generated ES5/ES2015 in Node and Chromium with strict script CSP. Each target has
zero type errors, three domain/state checks, two compiler/provider rejection
guards and a mutation restoring the incorrect host String path.

Nominal stored RegExp values, literals and authenticated RegExp new/Class calls
now dispatch correctly from property, getter and chained receivers. The engine
checks the receiver at runtime so custom methods are preserved. Source dot-call
order evaluates the receiver once and arguments before final method lookup.

The suite covers the observed TabStopsProperty receiver forms, not complete
application-class execution. Unknown pattern types and the pattern engine's
existing grammar/Unicode differences remain separate qualification work.

`--op2-dispatch` additionally enables OP2's generic Object property dispatch.
This diagnostic currently fails at dynamic String `slice` lookup, a separate
bridge intrinsic that the default fixture accesses through the existing host
String method path. The failure is written to `held.json` and exits nonzero;
it is not counted as a pass. Full OP2-configured receiver behavior remains open.
