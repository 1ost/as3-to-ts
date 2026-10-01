# Generated public String accessor halves

Emit the five complete original AIR subjects from the shared engine's
nativeGeneratedStringAccessors packet through the production factory. Both ES5
and ES2015 match all 23 AIR observations in Node and CSP Chromium, with zero
strict type diagnostics. Twelve compiler guards cover exact plan identity,
override/final half ownership, type mismatch and duplicate getters. Two applied
factory mutations reject a new setter falsely claiming override and an overridden
getter losing its override flag in both runtimes.

Run node tests/native-generated-string-accessors/run.cjs with
LAYA_ENGINE_REPOSITORY pointing to the isolated shared engine checkout.
verify.cjs --check-current authenticates the retained proof and all source hashes.
The report engineCommit records the checkout base at capture; the matching
runtime inputs were committed as 88e34f41c. No raw AS3 subjects are rewritten.

The original compiler rejected ReadChild.value as duplicate/incompatible; after
trait admission it rejected super.value as an unqualified accessor signature.
Both paths now accept String. Adjacent Boolean override, interface accessor-half
and independent accessor-type tests pass. OP2 replay on this pair remains pending;
no text-layout or startup completion is claimed.
