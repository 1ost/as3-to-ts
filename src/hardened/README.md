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

Independent fixture profiles and native AIR/Laya comparison are documented in
[`tools/FIXTURE_PROFILES.md`](../../tools/FIXTURE_PROFILES.md). They use an explicit
application authority context and preserve the default Bleach lock.

### Deferred original class initialization

Original static fields remain data slots and original field/method declarations
retain their source contracts. Generated modules register class initializers
without executing application code; sealed construction authority is required
before class lookup or construction runs them. Native class lookup initializes
the base first, lexical self lookup remains available during initialization,
external cyclic lookup returns null, and a failed initializer can retry.
Constant expressions populate trait defaults before source initializer code;
executable calls, allocations, conditionals and variable reads retain source
order. All field headers are bound before initializers and method bodies, so
original forward references require no source reordering.

The shared Laya native oracle retains class-initialization, cycle, failure,
self, defaults, constants and mutation probes. They also exercise the original
TextFormatLib and ColorLib unchanged. These are AIR 51/Chrome state comparisons;
they do not qualify every Flash class-closure behavior. Escaped class identity
after initialization failure, cyclic construction, cross-class constant folding,
reflection-triggered initialization and other Flash runtime versions need
separate evidence. Array.join admission uses the shared primitive conversion
owner and keeps unsupported recursive/host array behavior explicit. Ordinary
TypeScript Laya consumers do not install this compiler runtime.


### Native ArgumentError construction

Authenticated application profiles lower an unshadowed `new ArgumentError` to
shared `AS3Error` runtime construction. The source identity remains ArgumentError;
the runtime extends Error and preserves its message value until native string
conversion. Zero through two arguments are supported, with a proven numeric
second argument converted to int after argument evaluation. Imported, local,
parameter, field, method and inherited names continue through source resolution.
Error.message and Error.name retain their SDK wildcard types, including native
addition and typed String slot conversion. Error.errorID remains int.

The shared Laya oracle retains eleven ArgumentError checkpoints (including exact
original application failure messages) and six message-value checkpoints. The
original UIManager/DataLoader constructor holds clear without AS3 edits; their
remaining dependency and callback holds are separate. Explicit ArgumentError
type annotations, typed catches, subclass construction, reflection, nonnumeric
identifier conversion and mutable prototype behavior require additional evidence
and admission. Original Error construction retains its existing argument bounds.
Ordinary TypeScript Laya consumers do not need this compiler runtime.
