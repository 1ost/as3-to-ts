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

Implementing-class emission requires the authenticated generated declaration
path. Legacy callable emission and ordinary consumer reference coercion still
reject interface types; planning cannot silently erase runtime coercion.
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
registration in the planning driver. That driver uses native class scaffolding;
the separate emission test below executes unchanged original source bodies.

Run `node tests/native-generated-interfaces/emission.cjs`, also with `--combined`,
to emit all five unchanged AIR classes and four unchanged interfaces. Both modes
match 28 of the 31 AIR observations on ES5/ES2015 in Node/Chromium, with zero strict
type diagnostics, six rejection guards and five comparison negative controls.
The three interface-reflection rows remain explicitly held. No subject source is
trimmed, rewritten or replaced by fixture classes.

This qualifies generated interface storage and fixed method entry/normal return
coercion, direct/inherited nominal implementation, virtual accessor/method dispatch,
and the original static initializer timing. The private static initializer method
uses the existing common lexical registry and symbol identity. Public typed super
calls delegate coercion to their captured generated base method. Generated classes
omit legacy string-name interface metadata; their interface authority is the
validated domain publisher. TypeScript interface declarations import every base
and translate required parameter types. An implements clause never supplies a
native superclass.

Static lexical variables/accessors and protected static methods, interface
reference locals, optional/rest callables and complete
interface Class reflection remain held. The actual Signal chain still needs
these prerequisites before it is runnable.

Run reference-entry.cjs, also with --combined, for required interface constructor
parameters. Six unchanged source classes and one interface match 12 of the 32
interface-reference-entry AIR observations on ES5/ES2015 in Node/Chromium, with
zero strict type diagnostics, six guards and five comparison negative controls.
The domain authenticates interface parameter identity; common property coercion
applies before body entry, including when a wildcard derived constructor forwards
an invalid value to its base. Missing arguments reject and undefined becomes null.

The complete Locals source is retained in the plan and explicitly rejected. Its
20 AIR observations are not claimed: generated interface local references and
nested functions require further lowering. No subject body is trimmed to bypass
these gates. This does not qualify optional interface defaults or Signal runtime.
