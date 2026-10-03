# Generated TabAlignment consumer

Run with `LAYA_ENGINE_REPOSITORY` pointing at the paired TabAlignment engine:

```powershell
$env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-tab-alignment-review'
node tests/native-generated-tab-alignment/run.cjs
```

The runner authenticates maintained AIR fixture sources, emits ES5 and ES2015,
and compares all thirty AIR observations in Node and Chromium with strict CSP.
Five rows exercise generated source constant access and conditional selection;
twenty-five cover the common engine Class API. Six identity/state guards, one
missing-provider rejection and a wrong-constant mutation run for each target.
Generated source type checking must report zero errors.

This adds a provider consumer regression, with no compiler implementation change.
It does not qualify the complete TabStopsProperty runtime or whole-client startup.
