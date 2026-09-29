# Generated Proxy construction

Run `npm run tsc`, then `node tests/native-generated-proxy-construction/run.cjs`.
The engine checkout defaults to `../LayaAir-op2` and can be selected with
`LAYA_ENGINE_REPOSITORY`. The test consumes its authenticated original AIR packet
`tests/nativeFlashOracle/generated-proxy-construction` and generated reflection.

All three original classes are emitted into complete native module factories,
then loaded through NativeSourceClassLoadingSession into ApplicationDomain.
Ten runtime observations and both original reflection documents match for ES5
and ES2015 in Node and Chromium. Each target has zero TypeScript diagnostics,
eight native-entry guards, four domain checks and five compiler rejection guards.
The source Entry retains its private field initializer, before/after super
snapshots, accessor pair, and detached method closure behavior; Child retains its
real super argument and Consumer retains its native reference signature.

The new provider uses the exact `flash.utils.Proxy` name, `Proxy` export and
`nativeBase: 'Proxy'` declaration. A missing/wrong native-base binding, missing
or repeated super call, and unqualified namespace hook are rejected.

`runtime.json.gz` contains the passing report and hashed compiler/runtime inputs;
`verify.cjs` checks the retained comparisons. Namespace-hook lowering, dynamic
Proxy property dispatch and complete OP2 ArrayCollection integration remain open.
This does not claim whole Proxy subclass support or full game startup.
