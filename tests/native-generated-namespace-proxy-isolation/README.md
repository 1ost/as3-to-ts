# Source namespace resolution with a Proxy provider

An unrelated flash.utils.Proxy binding in a generated source cohort previously
made the initializer checker construct a second namespace resolver without the
source namespace identities. Complete AIR-verified retrycases sources then
failed with unresolved or ambiguous namespace: scratch_ns. The same defect held
OP2 FlowElement at tlf_internal despite its authenticated import/declaration.

The initializer checker now reuses the emitter's authenticated resolver for
Proxy hook classification. This preserves the existing source namespace and
Proxy authority checks. No engine change or new runtime admission is involved.

Run node tests/native-generated-namespace-proxy-isolation/run.cjs after building.
The fixture verifies immutable AIR evidence at engine a95bd3034 and adds only
an unused native Proxy provider to the compilation configuration. All 20 AIR
observations match ES5/ES2015 in Node and Chromium, with zero type errors,
eleven guards and five domain checks. An in-memory compiler mutation restores
the old resolver and reproduces the scratch_ns failure for each target; the
separate retry-provider mutation fails in both runtime environments.

Retained report: run-ToFX5H. Verify with
node tests/native-generated-namespace-proxy-isolation/verify-runtime.cjs --check-current.

Adjacent checks: namespaced initializer run-wS5rao (20 rows), Proxy dispatch
run-nYKFfe (38 rows), plus the native namespace suite. The original initializer
fixture remains unchanged. Full OP2 dependencies and startup are not qualified.
