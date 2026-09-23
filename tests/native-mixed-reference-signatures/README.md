# Mixed reference method signatures

Build the compiler, then run `npm run test:native-mixed-reference-signatures`.
The runner authenticates and emits the complete unchanged AIR mixed-signature
and DateZip probes, plus the typed-return throw probe. All 51 observations match
in Node/Chromium on ES5/ES2015, with 26 configuration/emission guards.
Supplemental emitted checks cover Array value-name shadowing and a U+2028 String
default, including explicit undefined versus omission.

The mixed-signature/DateZip sources remain type-clean. The unchanged throw probe
has exactly one asserted TS2739: the common as3CreateError helper advertises an
object return, while the emitted source local retains its Error annotation.
This separate Error type-binding boundary remains unresolved; no source rewrite
or fake Error declaration is used. The three runtime throw observations compare
Error identity, name, errorID and catch/finally effects. The legacy parser shares
RETURN nodes between throw and return, so lowering also checks the source keyword.

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
