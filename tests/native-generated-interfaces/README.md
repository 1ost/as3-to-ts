# Authenticated source interface declaration planning

Run `node tests/native-generated-interfaces/run.cjs` after `npm run -s tsc`.
The test authenticates LayaAir's source-interface-declarations AIR packet and
plans all nine unchanged contracts sources (four interfaces and five classes).

The declaration API accepts an explicit `interfaceProviderModule` pointing to
the common AS3Type provider. Source interfaces get separate, immutable bindings
with exact base QNames and token exports. Class bindings record their direct
implements list. Interface tokens are emitted in base-before-child order through
`defineAS3Interface`; importing the module does not import implementations or
publish class generations. Class `bindings` remain a class-only list, preserving existing
initialization scheduling and source-class consumers. References distinguish
interface identities from class declarations, native types and unresolved names.

The legacy parser represents interface methods as TYPE wrappers named `function`.
Those wrappers are excluded from the reference inventory; their real return and
parameter type children remain included. Original bytes and hashes are retained.

Seven AIR nominal rows are compared in Node/Chromium for ES5/ES2015 domain output.
The driver supplies explicit constructor-entry scaffolding to exercise planned
identities with the real engine. It does not claim original class-body emission,
structural interface method validation, Class initialization or full reflection.
Three host guards check separate-domain identity, genuine constructor entry and
frozen tokens. Seventeen planner/emitter guards cover malformed relationships,
hashes, ambiguous names, cycles and remaining emission holds. Three altered result
arrays verify comparison sensitivity. Strict actual-provider type checking passes.

Implementing-class emission remains rejected by NativeCallableClasses. Ordinary
reference coercion also explicitly rejects planned interface types until its
source emission is qualified; planning cannot silently erase runtime coercion.
Contract projection and explicit implements publication are now implemented as
described below; next compare unchanged source bodies with the complete AIR packet.
Source interface Class values/reflection, optional/rest signatures and computed
SlotList.NIL initialization remain separate prerequisites for Signal.

`node tests/native-generated-interfaces/contracts.cjs` authenticates and matches
18 AIR compiler acceptance cases (six accepted, twelve rejected) plus eight
projection guards. This is compile-time evidence, distinct from ADL runtime rows.
Plans retain immutable interface members and proven implementation owners. Method
kind, nominal return/parameter types, arity, optional status and rest status must
match; parameter names and optional default values are not signature identity.
Public inherited implementations count. Static/private/protected methods, missing
accessor halves and structural fields cannot satisfy the required contract.
Conflicting interface inheritance, unresolved signature types and vectors remain
explicit errors. Inherited obligations are also checked on child classes.

For a validated class, the generated publisher calls common `registerAS3Class`
with its exact interface tokens after nominal generation publication and before
authored initialization. No new runtime registry is added. The seven AIR nominal
comparisons now exercise this emitted registration, without manual implements
registration in the test driver. Its native class bodies remain scaffolding;
whole original-source callable emission and complete reflection are still held.
