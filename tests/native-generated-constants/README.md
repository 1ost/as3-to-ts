# Generated static literal constants

Run `npm run build` and `npm run test:native-generated-constants` with the sibling
`LayaAir-op2` engine and OP2 Playwright installation (or `LAYA_ENGINE_REPOSITORY`
and `PLAYWRIGHT_MODULE`). The test authenticates the retained
`tests/nativeFlashOracle/generated-static-constants` AIR packet, then emits its
two original class sources through the generated declaration pipeline.

Public static primitive literal constants use the common engine's
`defineAS3GeneratedStaticConstant` before registration and static variable
initialization. Their TypeScript surface is readonly. The five AIR observations
cover inherited same-name shadowing, primitive coercion, later-declared constants,
read-only errors, enumeration and repeat construction. Node and Chromium compare
all five rows for ES5 and ES2015 output; the complete provider graph is type-checked.
The observer is a native TS driver using common property operations, not an emitted
AS3 Class/reflection probe. Subject source and generated bodies are not rewritten.

Six rejection controls retain computed/missing initializers, reference types,
instance constants and private static constants as unsupported. Native Event
ancestry, general class initialization and complete source Class identity remain
separate prerequisites. Reports and exact dependency hashes are retained under
`.cache/native-generated-constants/run-*`.
