# Generated SoundLoaderContext parameters

`nativeSoundLoaderContextReferenceModule` admits constructor parameters only
with a matching explicit provider and declaration/reference plan. The common
engine publishes SoundLoaderContext using its private allocation guard. Existing
method/setter parameter coercion consumes that same canonical identity.

```powershell
node node_modules/typescript/lib/tsc.js --project tsconfig.json --pretty false
$env:LAYA_ENGINE_REPOSITORY=(Resolve-Path ../LayaAir-op2-sound-context-review).Path
node tests/native-generated-sound-context-parameters/run.cjs
node tests/native-generated-sound-context-parameters/run.cjs --combined
```

Both modes pass 26 original AIR observations on ES5 and ES2015 in Node and
Chromium, with zero generated/dependency type errors. The runner authenticates
the engine-owned original evidence, emits the full source class, and checks five
compiler rejection guards, six forged-value rejections per runtime/target,
three comparison mutations and two publication-removal controls. Removing the
publication must fail generated class registration with the exact missing
registered-identity error. Output is retained in `.cache` for inspection.

Adjacent regression: `node tests/native-generated-optional-rest/run.cjs --combined`
passes 56 AIR observations and 19 guards on both targets; native constructor
and decorated-inheritance tests also pass on both targets.

This does not admit native context construction, typed returns, members,
reflection or subclasses, nor prove complete SoundPlayer playback or H5 startup.
The browser runner uses dynamic module evaluation; no CSP qualification is claimed.
