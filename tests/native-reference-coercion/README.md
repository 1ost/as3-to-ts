# Planned reference locals and enumeration

Run `npm run test:native-reference-coercion` after building. The sibling engine
must include the restored reference-enumeration and reference-catch AIR packets
and the common Error instance proof. Playwright is discovered in the sibling OP2
client or from `PLAYWRIGHT_MODULE`. Output is under `.cache/native-reference-coercion`.

All four original AS3 sources are emitted without body edits. EnumValue and
EnumChild use generated nominal registration; both probes consume their planned
tokens through `nativeReferenceCoercion`. Its `{plan,module,coercionModule}`
configuration requires a live declaration plan plus explicit distributed
`nativeClassHelperModules`. Source construction reads the actual lazy binding.
Consumers outside the plan can resolve its existing declarations but cannot add
or publish identities. Planned source bytes are checked and caller ASTs cannot
override the source. The planner and consumer share type-name resolution.

The generated graph passes strict checking and all 24 native AIR observations
in Node/Chromium on ES5/ES2015 (with ES5 iterator lowering enabled). Ordinary
reference locals get their null defaults at function entry; loop-header variables
stay undefined until assigned. Initializers, direct local writes and loop values
use common reference coercion. For-in keys pass through a temporary so a rejected
value cannot overwrite the old variable or enter the body.

Single builtin Error catches use the common private instance proof and rethrow
unmatched values. Other typed/multiple catches are held. The prerequisite engine
packet separately proves Error.prototype versus TypeError.prototype behavior;
the compiler does not replace catch filtering with a host `instanceof` check.
Declared-reference errors currently preserve only the captured message prefix,
not complete value-dependent diagnostic text.

The unchanged probes also exercise fixes for the Dictionary value-loop closing
parenthesis, exact native Dictionary construction (including weak keys), and an
instance method named `each` that the old emitter treated as a reserved keyword.

Guards cover copied plans, changed sources, missing modules, conflicting AST
transforms and unsupported writes/signatures. Consumer field storage, reference
parameters/returns, duplicate reference declarations, local constants, updates,
type operations, general Class-value uses and nested functions remain held until
their complete lowering is qualified. Generated class registration retains its
existing signature/storage authority and its separate unsupported boundaries.
This is not whole-client, full language, or application-domain admission.
