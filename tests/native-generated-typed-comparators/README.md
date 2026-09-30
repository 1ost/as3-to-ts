# Source Class parameters and int returns in anonymous functions

Four complete maintained fixture Classes are emitted through the native module
factory. Twenty-nine observations captured twice in AIR 51.3.4 must match in
Node and Chromium for ES5 and ES2015; browser CSP allows only external scripts.
The original source, SWF, capture receipt and observations are retained. The
observer exercises generated function bodies and the shared Array sort bridge.

Required source Class parameters use authenticated declaration identities,
including subclass acceptance, unrelated Class/object rejection, null/undefined
conversion and assignment checks. Argument counts precede parameter conversions;
all conversions precede the body. Functions with no parameters accept extra
arguments in AIR, whereas the tested parameterized functions reject them.
Explicit int returns coerce values, fallthrough returns zero and throw operands
remain unchanged. Captured values and actual Array.sort calls are also compared.

Seven rejection guards retain unsupported signature/body boundaries. Five
applied generated-code mutations remove reference checks, remove count checks,
remove int conversion, remove fallthrough conversion or incorrectly reject
extra arguments to zero-parameter functions. Each must change an AIR result.
Source Class parameters with other return types, optional/rest parameters,
primitive typed parameters, nested try/catch and receiver/member lookup remain
held. Whole OP2 manager and startup readiness require separate integration work.

Run from the compiler checkout in PowerShell:

```powershell
node node_modules/typescript/bin/tsc --pretty false
$env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-internal-values-review'
node tests/native-generated-typed-comparators/run.cjs
node tests/native-generated-typed-comparators/retain.cjs <reported-output>/report.json
node tests/native-generated-typed-comparators/verify-native.cjs --check-current
```

`native-pin.json` records the engine commit and baseline compiler. The compressed
native report includes generated sources and factories, source/compiler/provider
hashes, typecheck inputs and both runtime results. The verifier can check retained
evidence independently of temporary output; `--check-current` also checks the
original run's complete on-disk bundle/typecheck inputs.
