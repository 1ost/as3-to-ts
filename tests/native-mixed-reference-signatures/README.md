# Mixed reference method signatures

Build the compiler, then run `npm run test:native-mixed-reference-signatures`.
The runner authenticates and emits the complete unchanged AIR mixed-signature
and DateZip probes. All 48 observations match in Node/Chromium on ES5/ES2015,
with zero strict TypeScript diagnostics and 26 configuration/emission guards.
Supplemental emitted checks cover Array value-name shadowing and a U+2028 String
default, including explicit undefined versus omission.

`nativeSignaturePropertyModule` names the common AS3Property module for String,
Number, int, uint, Boolean and Object returns in methods with planned reference
parameters/returns, and for mixed String parameters. Array returns use the common
AS3Type `as3CoerceArray` helper, avoiding a source-shadowable Array operand.
Optional String declarations lose JavaScript defaults; method entry checks
arguments.length before applying literal String/null defaults and coercion.
Return conversion remains within source try/catch/finally regions.

This does not enable every scalar-only signature, constructor/accessor/rest
signature, arbitrary default expression, Array parameter or generated-class
typed-local path. DateZip retains maintained serialization expressions, including
the original seconds field. Passing that probe is not a complete ZIP library or
DateUtil game integration result.
