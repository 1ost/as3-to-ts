# Generated BitmapData returns

`nativeBitmapDataReferenceModule` admits BitmapData method/getter returns only
with a matching explicit native provider and generated reference plan. The
common engine declaration uses the existing private allocation proof, which
continues to accept disposed instances.

```powershell
node node_modules/typescript/lib/tsc.js --project tsconfig.json --pretty false
$env:LAYA_ENGINE_REPOSITORY=(Resolve-Path ../LayaAir-op2-bitmap-return-review).Path
node tests/native-generated-bitmap-returns/run.cjs
node tests/native-generated-bitmap-returns/run.cjs --combined
```

Both modes match 34 original AIR observations on ES5/ES2015 in Node/Chromium,
with zero generated or dependency type errors. Eight rejection guards cover
missing return values, fallthrough, absent bindings, other native return types,
missing explicit authority and mismatched providers. Two forged-value checks
run per runtime/target. Three comparison mutations and two publication-removal
controls detect missing evidence or runtime registration. The adjacent ID3Info
return suite still matches all 26 AIR rows on both targets.

The browser harness evaluates generated modules dynamically; no CSP claim is
made. Rendering, native constructor overloads, reflection, interfaces, generated
native subclasses and full application loading/drawing need their own evidence.
