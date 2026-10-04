# Generated static numeric literal constants

Run `node tests/native-generated-numeric-constants/run.cjs --combined` with
`LAYA_ENGINE_REPOSITORY` pointing to the paired numeric-constants engine review.
The fixture emits both complete AS3 subjects, verifies zero generated/provider
type errors, and compares four AIR rows (42 observed numeric values) on ES5 and
ES2015 in Node and Chromium with `script-src self` and no dynamic evaluation.

AIR 51.3.4 captures were repeated and identical. Values cover protected uint
flags, private child namesakes, inherited lexical ownership, private Number
limits, fractions, signed zero, exponent notation and int/uint wrapping.
The actual emitted negative-zero constant is mutated to positive zero on each
target; three observed rows must differ. Ten compiler rejection guards retain
computed initializers, private instance constants and immutable write boundaries.

This admits protected/private static int, uint and Number literal initializers.
Int/uint literals receive source-width conversion; Number preserves signed zero.
It does not qualify computed initializer execution, instance Number constants,
inherited computed static lookup, or complete TLF/application integration.

`verify-air.cjs` authenticates the original source, repeated captures and receipt.
`node tests/native-generated-numeric-constants/verify.cjs --check-current`
authenticates the retained compiler/provider inputs, bundles, types, observations
and mutations against the current files. The runtime packet is retained once
using `verify.cjs --retain <report.json>`.
