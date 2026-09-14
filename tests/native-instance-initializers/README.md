# Derived instance initialization: closed source callable prototype

**Status: unadmitted candidate.** Independent original Flash review found three
accepted Class-alias source flows that still differ. Their complete source,
original capture and commands are retained in `class-alias-original`; the
reproducible `CompareClassAliasEmission.js` currently exits 1. Passing construction
observations below do not override these failures. See
`CLASS_OPERATION_REQUIREMENTS.md` for the existing common runtime integration
contracts and the full unresolved workpack. No broad callback, publication,
container or indirect-allocation ban has replaced these source requirements.

The explicitly authorized prototype selects complete source chains through
`nativeCallableClasses: { [qualifiedName]: exactOriginalSource }`, alongside the
existing `nativeClassInitialization.classes` lazy map. Every selected class and
ancestor must be present as source with the exact matching identity. Mixed native
provider bases are rejected. This does not change the downstream ES target:
ordinary native callable functions execute under both ES5 and ES2015 compilation.
Callable mode also requires `nativeCallableMethodBindingModule`, the real common
Laya `AS3MethodBinding` module import path selected by the consuming toolkit.

The compiler retains each complete emitted constructor and method body as an
ordinary function body, creates ordinary constructor/prototype inheritance, and
emits native method data descriptors. On fresh construction it binds all effective
instance methods through common `bindAS3Method`, once, after slot defaults and
before authored field initializers; base entry does not rebind overrides. Static
methods bind before authored static field effects. There is no legacy compiler
getter/cache or completion rebinding in callable output. The already-reviewed
lazy binding helper is unchanged. No new allocation Proxy, callback dispatcher,
VM or interpreted source-body representation is introduced. The optional pass
uses the toolkit's TypeScript parser for structural emitted-code edits.
TypeScript is now an exact 2.5.2 runtime dependency. A fresh production-only
installation executes the optional pass without development dependencies.
Redundant dev declarations for existing runtime colors/fs-extra/object-assign/sax
were removed because npm omitted those duplicate entries during the first clean
production test; no locked package versions were changed.

Ordinary `new` allocates the real receiver. A private WeakMap in the common
compiler utility tracks fresh, active, completed and failed construction entries,
plus the exact expected source-base entry. It stores no source bodies and neither
selects nor dispatches them. The first entry establishes the entire closed chain's
default-slot layout exactly once before derived field initializers. Source super
arguments evaluate into a hygienic local array before base entry is authorized;
the emitted constructor then directly applies the exact source base function to
the same receiver. No default slots are reset on base entry. Replays on active,
completed and failed receivers throw #1006 before constructor effects. New nested
instances have independent entries. Inline try/finally updates entry state while
preserving the original thrown object. Constructor identity slots are reserved;
the current direct-name prototype guard misses untyped aliases, as retained by
the failed review capture. This is a closed compiler-produced chain
contract, not support for arbitrary external JavaScript `.call`, forged receivers,
Reflect.construct with an unrelated newTarget, or external native subclasses.

Current executable results:

- All 49 original construction/default/failure/reentrancy observations match
  under both downstream targets.
- A second original Flash capture adds 31 argument/identity observations per
  target: coercion before fields, explicit undefined versus omitted defaults,
  argument-count #1063 before effects, extra arguments when the constructor uses
  `arguments`, normalized arguments entries, custom coercion failure identity,
  inherited prototype identity and stable bound method extraction.
- The earlier complete 15-row static/instance initialization capture and 11-row
  lazy publication/failure capture also match in callable mode.
- An independent reviewer supplied 11 additional actual Flash observations for
  source shadowing of Object/Number/Error/class names, alias replay and failed
  receiver identity. Twenty more original observations cover active/failed/
  completed replay, argument-time base replay and legitimate source-base entry.
  Both captures match both downstream targets. Intrinsics live outside authored
  scopes, and generated constructor identities use fresh outer bindings.
- Strict TypeScript 2.5.2 checks cover class values, instances and inheritance.
  The remaining negative cases reject missing common binding configuration, mixed chains, source-map mismatches, grouped
  direct call/apply, prototype manipulation, unsupported parameter types, rest,
  constructor value returns, non-straight-line/repeated super, colliding slots and unproved
  synthesized derived constructors.

Constructor numeric parameters now require `nativeCallableCoercionModule`, supplying
common `as3CoerceNumber`, `as3CoerceInt` and `as3CoerceUint`. Supplied values and
omitted finite numeric literal defaults use that provider; explicit undefined is
not treated as omission. Source `arguments` uses a mutable Array snapshot of the
coerced entries. Nested-function arguments and direct callee reflection are still
rejected pending their scope/identity support. Boolean, Object and untyped
parameters retain the previous lowering. String and other reference parameter
coercion remain unresolved.

Successful constructor void returns leave a hygienic labeled body. Pending source
finalizers run before completion is recorded, and a throwing finalizer preserves
its original exception. Nested-function returns keep their own scope. Wildcard
catch annotations are removed because JavaScript already catches every thrown
value; callable mode rejects typed/multiple catches until source exception
dispatch is implemented. Method-parameter coercion remains a separate boundary.

The additional 101 numeric, 14 early-return, 12 wildcard-catch and 18 independent
merge observations are retained in `../native-callable-prerequisites`. That suite
checks Node and Chromium for ES5/ES2015 source output, plus TypeScript4.9.5 against
unmodified current engine declarations. Legacy TypeScript2.5 strict tests here
use an explicitly adapted declaration syntax view; they are not current-engine
production type-check evidence.

Interface construction identity, unsupported super forms/accessors, instance const
descriptors, full static/reflection metadata, arbitrary Class aliases and native
Laya/provider bases remain unadmitted by these tests.

Run `npm run tsc`, then:

```
node tests/native-instance-initializers/CallableConstructorsTests.js <isolated-output>
node tests/native-instance-initializers/CallableArgumentsTests.js
node tests/native-instance-initializers/CallablePublicationTests.js
node tests/native-instance-initializers/CallableTypeSurfaceTests.js
node tests/native-instance-initializers/CallableRejectionTests.js
node tests/native-instance-initializers/CallableReviewTests.js
node tests/native-instance-initializers/CallableReplayTests.js
node tests/native-instance-initializers/CommonMethodBindingTests.js
node tests/native-instance-initializers/CallableCatchTests.js
python tests/native-instance-initializers/ProductionInstallTests.py <isolated-output>
```

The method migration's tests load original committed engine
`d3db69240e22575d48828ae95b1243bc6e593ed1` sources from a temporary Git archive.
The common provider and compiled classes execute in one Node test sandbox, so tests cannot
accidentally compare closures from independent registry copies. All prior 137
observations remain passing per target. Forty-six additional checks cover common
property reads matching compiled direct/callback reads, binding before fields and
base calls, overrides, receiver identity, static initializer extraction, ordinary
callbacks and rejection of replaced methods. The three retained Class-alias cases
remain failing and unadmitted. The committed common provider now supplies closure provenance; complete compiler
registration and Class/property/global dispatch remain separate prerequisites.

An explicit integration probe runs
`CommonMethodBindingTests.js --working-common --report <json-file>` against the
actual shared engine candidate and records hashes of every bundled provider
input. It currently passes 56 checks, including the static closure identity across
later complete trait registration and rejection of replacement. This mode is
separate from the default committed-provider regression and does not advance a
dependency pin. Evidence is under ignored
`.local/instance-initializer-review/common-binding-027/working-provider.json`.

The additional capture is retained in `arguments-original` with receipt SHA256
`c0b572a7af4f8f9725667a3a370155067d15dd1f62be93f0d6a428ff259b36c2`;
its original SWF/output remain in ignored `.local/instance-initializer-review/arguments-2`.
If integrated, preserve `arguments-original/** -text` and LF endings for
CaptureArguments.py and RetainArguments.py as well as the rules below.

`review-original` and `replay-original` also require `/** -text`; preserve LF for
RetainReview.py, CaptureReplay.py and RetainReplay.py. Their receipts are verified
by `verify-evidence.js`. The successful package proof is saved under ignored
`.local/instance-initializer-review/production-install-final/production-install.json`.

Version-label correction: earlier test messages and this workpack's first report
called the compiler TypeScript 2.4 based on the old `^2.4.2` declaration. The lock
and actual installed parser were 2.5.2. Historical source/observation/parser hashes
remain unchanged. Current reporting reads the actual `ts.version`; the runtime
dependency preserves exact 2.5.2 and does not migrate the toolchain target/version.

## Original diagnosis and architecture decision

The original diagnosis below describes the baseline before the selected
callable-constructor prototype above. The original Flash
capture has 49 observations. Baseline compiler commit
`18afdd7` emits 52 different ES5 observations; ES2015 stops after the first
observation with a ReferenceError. `CompareCurrentEmission.js` deliberately exits
1 when the native output differs. Complete original fixture class bodies are
compiled unchanged with the reviewed native lazy-class contract and actual
shared decorators. The native host driver performs the same construction and
observation sequence as `InstanceOracle.as`; it does not supply replacement
application class bodies or Flash providers.

## Observed source behavior

- Every instance slot has its source default before the first initializer:
  int 0, Number NaN, Boolean false, Object null, and untyped undefined. An
  initializer can inspect later fields through the real `this` receiver.
- Derived initializers run before constructor statements preceding explicit
  `super`, before evaluation of super arguments, and before base field effects.
  In a three-level chain the order is leaf fields, middle fields, base fields,
  base body, middle body, leaf body. Omitted source super has the same rule.
- A base constructor's virtual method call observes completed derived field
  values and a self-reference equal to the actual instance.
- A derived initializer that throws prevents all base field/body effects. Two
  failed attempts expose distinct real derived receivers and preserve the exact
  user-thrown sentinel. A base constructor that throws can leak a real derived
  receiver whose derived fields are already initialized.
- A field initializer can recursively construct another instance of the same
  class; each receiver has independent defaults, effects and final values.

The first ES5 mismatch is the field-default observation. Later mismatches include
base calls observing undefined fields and base effects executing before a field
failure that should prevent them. The baseline TypeScript 2.5.2 ES2015 transform places field
writes before a non-leading explicit super call, which throws on accessing this.
Moving super to the start would remove that host error but change the observed
source effects and exception order.

## Native-language constraint

An ordinary ECMAScript derived class cannot access its receiver before its
super constructor has produced and bound it. GetThisBinding throws while that
binding is uninitialized; super constructs the base before binding the result.
See the authoritative [GetThisBinding algorithm](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#sec-function-environment-records-getthisbinding)
and [super evaluation](https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html#sec-super-keyword-runtime-semantics-evaluation).
`NativeLanguageConstraintTests.js` reproduces this restriction, the base's
observation before post-super writes, and the inability to apply a native class
constructor to a separately allocated receiver. It is a host constraint check,
not a proposed application implementation.

## Concrete choices before implementation

1. Keep ordinary native ES2015 constructors and reject unproven derived instance
   initialization in production admission. A smaller safe subset would require
   proving the entire ancestor chain cannot observe derived slots or initializer
   effects and that moving effects cannot alter failures, argument evaluation or
   reentrancy. Merely checking for literal initializers is insufficient because
   the base can observe their values. This leaves the general port gap open.
2. Adopt a coordinated constructor/allocation protocol throughout each source
   inheritance chain. It would need receiver allocation and slot defaults before
   derived initialization, then source constructor phases in the observed order.
   Moving source bodies into generated initialization methods/callbacks or
   teaching every base to delay its body is an architecture change, conflicts
   with the current no-substituted-bodies constraint, and is not implemented here.
   Calling a virtual initializer from a native root base is insufficient: super
   arguments and derived pre-super statements have already executed too soon.
3. Require a closed ES5 function-constructor output hierarchy with proven callable
   bases, explicit default writes and compiler-controlled field placement. That
   could use ordinary function allocation/prototypes and pre-base receiver writes,
   but abandons the current both-target native-class guarantee. It cannot simply
   call a native ES2015/Laya base on an existing receiver. Provider boundaries,
   returned objects, decorators and construction identity need a separate design.

No Proxy/VM, fabricated receiver, constructor-body replacement, ABC execution,
global target change or relaxed admission was introduced by the diagnosis. The
root subsequently authorized the callable source-chain prototype above, with
both downstream targets retained. The existing static-class
initialization work remains separate and does not prove instance fidelity.

## Reproduction and provenance

```
python tests/native-instance-initializers/capture.py <fresh-output-directory>
node tests/native-instance-initializers/CompareCurrentEmission.js <output-directory>
python tests/native-instance-initializers/RetainEvidence.py <output-directory>
node tests/native-instance-initializers/verify-evidence.js
node tests/native-instance-initializers/NativeLanguageConstraintTests.js
```

The successful original capture is under the ignored OP2 toolkit directory
`.local/instance-initializer-review/capture-2`. It used the original local Flash
player and Flex SDK, an isolated profile and loopback port, and no account data.
`oracle/provenance.json` retains exact commands, exit codes and SHA256 of every
source, capture script, SWF, observation and tool. `oracle/receipt.json` seals
retained source/capture/comparison bytes, diagnostic scripts, compiler identity
and hashes of emitted complete classes. The raw SWF and emitted outputs stay in
the ignored capture directory. A failed initial attempt with an incorrect plugin
path is retained separately in `capture-1`; it is not used as source evidence.

The verifier authenticates receipt SHA256
`46be80b65ca3b6a997a3e44a5781c7bc020383d962bb596086b4b7f3cdc36c2d`.
If this evidence is integrated, Git must preserve raw bytes with
`tests/native-instance-initializers/oracle/** -text` and LF endings for the four
scripts listed in receipt.files: capture.py, CompareCurrentEmission.js,
NativeLanguageConstraintTests.js and RetainEvidence.py. No Git attributes,
commits or dependency pins were changed by this workpack.

## Direct source super calls

Direct `super.method(...)` now resolves the lexical source-base declaration and
calls its unbound native function with the current receiver. The verified form
covers ordinary instance methods targeting public/protected methods with zero or
Boolean parameters and literal Boolean defaults. Argument expressions evaluate
before coercion, and omitted argument counts are preserved. This includes the
maintained TweenLite call to TweenCore.setEnabled.

See `../native-super-methods` for original observations and current-engine type
checks. Detached, computed, grouped, namespaced and accessor super forms, other
parameter types, and native provider bases remain unimplemented. The source Class
identity and dynamic-operation requirements above are unchanged.

## Authenticated Class metadata integration

`nativeCallableMetadata` adds optional exact source Class publication and common
property/invocation lowering. The source hash and parsed member checks validate
the supplied surface; trusted capture tooling must authenticate original ordered
reflection metadata before passing this option. See `../native-class-metadata`
for retained source/SWF provenance, metadata reconstruction and executable checks.

The implemented metadata shape is public Object-root classes. It preserves
failed static-initialization generations, source nominal identity, Class aliases
in Object/Array containers, Class coercion, deletion/membership and mixed
Class/nominal/int/uint predicates. Compiler-created predicate helpers are tracked
by exact emitted alias, independently of the configured provider module name.

Inherited/nonpublic metadata, ordinary unbound function globals, method
arguments, source enumeration and source typeof remain unresolved. Existing
super-call support remains available without this metadata option; inherited
metadata is rejected explicitly. These tests do not qualify a complete game.
