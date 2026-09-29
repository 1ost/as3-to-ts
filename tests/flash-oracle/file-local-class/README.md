# File-private native class identity

The two source files named `Owner.as` each declare their own file-private `Item`.
Harman AIR 51.3.3 reports the same reflection name for both classes and both
instances, while constructor identity and `is` distinguish their allocations.
String conversion produces `[object Item]` and `[class Item]`. A missing-property
error uses `FilePrivateNS:Owner.Item`. Looking up the reflection name globally
fails with ReferenceError #1065.

`native-air.json` retains source/scenario hashes, the SWF and full oracle receipt
digests, runtime version, and captured observations. `native-capture.json` is the
original capture byte stream; two independent AIR runs produced identical bytes.
The initial fixture without explicit imports failed native compilation and was
corrected by adding both imports before the retained capture.

Reproduce from LayaAir using `scripts/nativeFlashOracle.py` with
`--air-sdk <AIR SDK> --source <this directory>/source --entry FileLocalRuntimeProbe
--scenario <this directory>/scenario.json --output <new evidence directory>`.

The compiler's `tests/hardened-cli/type-authority.test.cjs` uses the real emitter
and runtime on private class IR to compare the first 17 captured values. The
remaining three values record native global lookup failure; the test checks an
empty publication list, not a Laya domain lookup. The original-AS3 adapter still
holds nonempty file scope. This evidence does not qualify the full original
scheduler, inheritance, all private member visibility rules, or the game.

`qualified-class-regression.json` records the separate existing `qualified-class`
suite: real original input through the compiler and Laya Chrome WebGL matched
all 75 AIR observations, with no state, trace or pixel differences. It verifies
the packaged runtime with the new internal identity helper, but its source has
no file-private declarations and does not close the adapter hold.
