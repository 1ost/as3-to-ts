# Generated Point returns

Run `node tests/native-generated-point-returns/run.cjs` after building the compiler.
The complete captured AS3 class is emitted through production source-Class factories
on ES5/ES2015, typechecked against the shared engine, and compared with sixteen
repeated AIR observations in Node and Chromium under script-src self.

`nativePointReferenceModule` requires the exact plan/import Point provider binding
and only admits generated typed returns. It reuses completion-aware shared property
coercion: nullish values, identity, invalid values, catch/finally ordering, static,
nested and bound calls retain source semantics. It adds no Point casts, Class
reflection, subclass admission, or general native-return permission.

Seven compiler rejection checks cover missing qualification, bare/fallthrough
returns, another native type, missing plan and mismatched module/import authority.
Five runtime checks cover sibling Classes, shared native identity, forged/proxied
Points and retained callbacks. Removing return coercion must still build but fail
the forged-Point check. AIR source, binary, capture and receipt hashes are verified
from the engine's `tests/nativeFlashOracle/point-returns` packet.
