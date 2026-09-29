# Generated externalizable interfaces

Run npm run tsc, then node tests/native-generated-externalizable/run.cjs with
../LayaAir-op2. The shared engine's generated-externalizable oracle retains eleven
original AIR observations from two identical captures. Ten runtime observations
match in ES5/ES2015 and Node/Chromium; the eleventh verifies the exact two native
method signatures in the declaration plan. Each target checks five invalid
contracts and six independent/inherited application-domain identities. Both
targets type-check with zero diagnostics. runtime.json.gz retains that result.

The pre-change planner rejected the native base interface. After admitting the
contract, an actual null call exposed raw JavaScript method dispatch. Interface
methods now use the shared named-call provider, preserving source error 1009,
nominal receivers and argument evaluation. Structural lookalikes are rejected.
This change implements no AMF codec or automatic externalization.

Adjacent checks passed: native-generated-interface-calls --combined (44 original
rows in both targets/realms), and native-generated-native-interface-inheritance
(11 runtime rows plus captured native signatures, five guards, seven domain
checks and two mutations per target). Full game startup remains unqualified.

Direct native implementations now publish the authenticated native token and validate
the same method contracts even when no source-derived interface declares them.
The original Direct class covers the form used by OP2 HashMap.
