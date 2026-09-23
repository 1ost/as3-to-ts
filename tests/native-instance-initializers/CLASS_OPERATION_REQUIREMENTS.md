# Class operations required by the construction workpack

The callable-source constructor candidate is not admitted. It preserves the
retained construction traces but still accepts the three different source flows
in `class-alias-original`. These are source semantics, not external JavaScript
misuse: each source compiled and ran in the original Flash player.

| Required flow | Original result | Current emitted result |
| --- | --- | --- |
| Untyped Class alias, `alias.bind(null)`, indirect `new` | #1006 before construction count changes | Allocates and runs body |
| Assign `alias.prototype` to ordinary Object `__proto__`, then `alias.call(object)` | #1006 with construction count 0 | Prototype-based entry proof accepts object and runs body |
| Untyped Class alias called with an existing source instance | Returns that exact instance as a Class coercion | Construction-entry guard throws #1006 |

`node tests/native-instance-initializers/CompareClassAliasEmission.js` recompiles
the complete original classes, compares both ES5 and ES2015, and exits 1 until
all original results agree. The retained receipt authenticates the original
source, Flash command log, capture, and independent review comparison. Retaining
the diagnosis does not count it as a passing port.

## Required source coverage remains intact

Do not remove or replace any existing original corpus to gain admission:

- Original 49 observations: complete slot defaults, three-level field/base order,
  explicit and implicit super, field/base failure, leaked receivers and reentrancy.
- Original 31 observations: constructor argument count, coercion/default order,
  argument aliases, exact failure identity, allocation and bound-method identity.
- Original 15 observations: complete static/class/instance initialization order.
- Original 11 publication observations: cyclic Class values, Class-valued fields,
  Classes stored in containers, failure retry and distinct failed Class identities.
- Independent 11 hygiene observations and 20 replay observations: exact intrinsic
  identity despite source shadowing, active/completed/failed receiver replay and
  legitimate base entry, including Class arguments passed through helper methods.
- The three Class-alias observations above, plus transitive aliases, container
  round trips, valid callback invocation and indirect source Class allocation.

In the actual maintained OP2 sources, `TweenPlugin.activate` allocates
`new (param1[_loc2_] as Class)()` and stores plugin Class values. Its
`onTweenEvent` invokes `_loc3_.target[param1]()`. `Profile` passes its Class value
to `new Signal(Profile,String,Object,Object)`. These complete source paths must
remain requirements. Blanket bans on callbacks, Class publication, container
escapes or indirect allocation would exclude useful client paths and are not the
final compiler architecture. None has been implemented as a substitute here.

## Existing common provider integration

The current shared Laya engine provides these relevant APIs in
`src/layaAir/flash/utils`:

- `AS3Class.as3AsClass` recognizes exact registered source identity rather than
  names or mutable `constructor` fields. `as3CallClass` performs Class coercion,
  not constructor execution. `as3ConstructClass` checks authored signature context
  then performs ordinary native `Reflect.construct`.
- `AS3Property.as3CallProperty` resolves the method before running its argument
  thunk, then distinguishes source Classes from ordinary functions. Read, write,
  delete and membership APIs carry source property behavior. Dynamic Object
  writes preserve an own `__proto__` data slot instead of invoking JS's inherited
  prototype setter.
- `FlashTypeMetadata.registerFlashTypeMetadata`, `AS3Type.registerAS3Class` and
  `AS3Property.registerAS3PropertyTraits` provide exact identity and public trait
  authority. This is metadata publication, not executable source interpretation.
- `AS3MethodBinding` is the common stable method-closure registry. The candidate's
  callable output now uses this registry and native method data descriptors,
  replacing its legacy compiler `bound` getter/cache. Existing non-callable
  compiler output remains separate. See `CommonMethodBindingTests.js` for the
  scoped committed-provider and explicit candidate-provider interop gates.

Compiler integration must keep the complete inline native constructor/method
bodies, ordinary allocation and native prototype ancestry. Lock the final native
constructor's prototype descriptor after ancestry setup. Publish metadata for
that exact final identity in the existing lazy factory. Install method data
descriptors before static effects; bind effective instance methods once on fresh
construction before authored fields, with no base-entry rebinding. Source method
bodies and their overriding identities must remain unchanged.

The toolkit must supply authenticated ordered reflection metadata alongside exact
source records; AST enumeration is not proof of original reflection order. The
compiler must validate member identities, types, visibility, inheritance and
native storage against the complete parsed source rather than granting authority
to arbitrary metadata labels. Metadata and trait registration must not trigger
unrelated source class initializers.

The existing constructor context may preserve supplied argument identity and
count while the inline constructor performs its single coercion/default prefix.
This requires explicit evidence for effect/failure order before any authored
field or body; do not coerce the same arguments both in `as3ConstructClass` and in
the constructor. Real native allocation is retained, and context callbacks may
not replace or dispatch source constructor bodies.

## Precise provider prerequisites under review

1. **Source Class prototype delegate.** `AS3Property` currently explicitly rejects
   the registered Class's `prototype` read. Returning its raw native prototype
   would expose native trait storage and is not proven source behavior. This needs
   original Flash evidence and a common delegate contract before lowering the
   complete prototype-alias source path.
2. **Lazy property reference types.** `registerAS3PropertyTraits` currently takes
   an already resolved native reference Class for each custom-typed public field
   or accessor. Resolving all of those at registration would initialize unrelated
   classes early (for example `Journal.nested:Reentrant`) and can change cycles.
   Exact lazy reference authority is needed; mutable names and unresolved compiler
   binding handles cannot substitute for authenticated Class identity.
   The new original engine `tests/nativeLazyReferenceType` corpus refines this:
   typed slot/parameter/return checks do not initialize the type, and instances
   from failed/retried Class generations still satisfy the same source declared
   type. A persistent declaration identity is required; lazily resolving only the
   current native constructor is insufficient. Explicit `is`/`as` and Class calls
   retain their separately observed evaluation/initialization order.
3. **Standalone source value calls.** Property calls already distinguish Classes
   and Functions. A common standalone invocation operation must preserve the
   corresponding receiver, argument order, Class coercion and #1006 semantics for
   aliases and callbacks. A compiler-side JavaScript `.call` fallback would reopen
   the alias failures.
   The common invocation candidate now provides this operation, with ordinary
   source functions requiring their exact authored script-global context. The
   current compiler does not yet model that context. Method closures use their
   bound receiver and are covered by the binding migration, but a host global or
   newly invented empty object must not stand in for a source script global.
4. **Non-object property providers.** `AS3Property` deliberately rejects Array,
   Dictionary, Proxy, primitive and other unregistered/custom receivers. Compiler
   dispatch must select the appropriate proven common provider. Globally routing
   every `rows.push` or callback through that currently bounded Object API is not
   a valid implementation of the full original corpora or Greensock path.

The runtime owner is auditing these contracts independently. No provider change,
local compatibility substitute, broadened admission or compiler pin is made by
this diagnosis. Once the contracts are proved, source emission must route dynamic
calls, construction and property access through them, including opaque/transitive
Class flows. The full workpack above remains the review gate.

Native Laya/provider inheritance, constructor parameter kinds currently held,
super member calls/accessors, interface construction identity, instance const
descriptors and other previously documented exclusions remain separate unresolved
port requirements. Closed-source construction evidence does not complete them.
