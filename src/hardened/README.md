# Hardened semantic IR and structural TypeScript emitter

This subtree is an isolated replacement experiment. It does not call the
legacy emitter and contains no AVM, ABC, Flash execution, compatibility
wrapper, or production runtime dependency.

The adapter consumes only a closed `authored-ui-as3-flat-ast@1` plus the exact
source text and a caller-supplied SHA-256 function. It authenticates the source
digest and the parser frontend's `SHA-256(JSON.stringify(nodes))` fingerprint
before preserving source node IDs, spans, package/class/member names, import and
member order, accepted modifiers, compile-time namespace annotations, source type names, and statement order in
`as3-semantic-ir@1`. Every node shape outside the minimal discriminated subset
fails closed. `use namespace X` plus an exact `X` member modifier is flattened
only after ordinary member-name collision proof; it never creates QName or
namespace runtime state. In particular, expression returns, metadata,
runtime namespace selection, implicit coercions, parser recovery, implicit derived
constructors, and misplaced `super` are not admitted.

Flash APIs require three authenticated byte boundaries:

1. the Bleach `swf-capability-census.json`, including the exact source QName,
   role, member use, arity, and playerglobal signature;
2. LayaAir `authored-content-capabilities.json`, including the exact public
   module, export, kind, member, and compiler signature;
3. a canonical, externally hashed source-to-target mapping document.

Underscore-prefixed Laya module segments, exports, and members are rejected,
as are dot segments. The emitter keeps
the source-visible Flash class/member names and deterministically maps an
authenticated Laya source module such as `src/layaAir/flash/display/Sprite.ts`
to its public `laya/flash/display/Sprite` module specifier.

`emitSemanticProgram` receives an exact TypeScript compiler API from its
caller. It builds imports, declarations, types, statements, and expressions
with `ts.factory`, then prints with LF using the TypeScript printer and reparses
the result. Admitted instance method closures pass through the shared
`AS3MethodClosure` weak cache after `super()` in the explicit constructor. The
cache maps both the original method and its receiver-bound closure to the same
callable, so base/derived constructor admission is idempotent and listener or
timer removal sees stable identity. It never constructs TypeScript source with
text templates.

The separately authenticated native timer lowering and its maintained-source
scope are documented in `NATIVE_TIMER_AUTHORITY.md`.
