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


### Own fields before native Bitmap construction

The authenticated Bitmap boundary admits its original SDK constructor arguments.
For a direct Bitmap subclass, the compiler evaluates declared field defaults and
initializers, then original leading assignments/local declarations, before the
base call. Only accesses to the class's own slots may refer to the construction
receiver. Their values are staged in a constructor-local record and installed on
the actual instance after canonical native Bitmap allocation. The original AS3
class, member names, visibility and constructor remain intact; generated output
is disposable compiler output.

This boundary relies on the shared Laya Bitmap constructor bypassing overridden
bitmapData and pixelSnapping setters, as proved by native AIR. Staging must not be
extended to arbitrary bases that can observe or call the derived receiver before
returning. Receiver escape, receiver method/accessor calls, inherited slot reads,
lexical receiver closures, unsupported control flow and embedded instance fields
remain held. Final field initializers are checked after every declaration has
been parsed, including fields declared after the constructor. Existing local-base
constructor-local ordering and proof cancellation remain unchanged.

The native private-slot fixture also proves null/literal-String conditional
branches and the String slot passed to Bitmap: null must reach the native #2007
failure instead of inventing a replacement string. Fixture profiles authenticate
implicit base constructor roles only when the SDK actually declares a constructor.


### Numeric Array keys in original arithmetic

The original UISkin/ScaleBitmap loops use expressions such as `index + 1`, whose
AS3 type is Number. Numeric Array access now accepts Number, int and uint without
forcing indices through uint conversion. The shared runtime preserves native
Number property names: valid array indices grow sparse length, while negative,
fractional, NaN, infinite and out-of-range numeric names remain ordinary properties.
Reads preserve holes and exact null errors. Receiver/key/RHS evaluation occurs
before a write's null check; reads evaluate receiver/key first.

The shared AIR suite retains sixteen Number-index checkpoints plus the existing
four write-order cases. Array subclass, inherited index and accessor behavior
remain explicit unavailable operations; String/Object index coercion is not
admitted by this numeric boundary. Original AS3 is not rewritten or cast merely
to satisfy the emitted TypeScript types.


### Original reference counts and completion callbacks

Dynamic Object prefix/postfix updates retain the receiver and key values once.
The runtime reads through authenticated Object dispatch, converts the prior value
with native Number semantics, and writes through the same dispatch. AIR converts
an object key separately for the read and write, so conversion can select a
different property for the store. Prefix returns the new Number; postfix returns
the converted prior Number. Conversion errors stop before the store.

Direct invocation of a Function parameter or mutable Function local uses the shared
invocation boundary. Argument expressions run before null/noncallable failure
(TypeError #1006); bound methods retain their receiver and method-entry coercion.
Anonymous functions now coerce supported primitive/Array/Function parameter slots
on entry too. Known local lambda signatures retain their existing static checks.
Dynamic AS3 this and unqualified reference-parameter coercion remain outside this
slice. Native-only lambda-arguments captures retain source-dependent arity labels;
known wrong arities remain held, while unqualified dynamic anonymous-function
arities fail explicitly before coercion/body effects. They are not native error
parity. No source-dependent label is invented.

Array length assignment retains its original uint storage contract and uncoerced
expression result. Its receiver is checked after RHS evaluation but before numeric
storage conversion. Native sparse growth, truncation, wrapping and null order are
retained. Compound length writes and length updates remain held. The original
DataLoader's length-zero cleanup needs no source rewrite.

### File-local class declaration groundwork

The declaration worker retains classes outside the package as optional nested
`fileLocalClasses` headers. Each header preserves its original name, members,
file-scope imports and parser node ID, with the containing source owner and a
`FilePrivateNS:<source basename>` reflection namespace. These declarations do
not enter the global local-type map. Package imports are not copied into their
file scope. The member-map loader validates and freezes the nested headers
against the containing type's authenticated source path and owner.

This is declaration support only. Semantic adaptation and emission still reject
nonempty file scope with `HARDENED_OUTSIDE_PACKAGE`; scoped references, runtime
class identity, constructors and reflection must be implemented and compared
with native AIR before this hold can be removed. A reflection namespace string
alone must not become a global class identity or ApplicationDomain definition.

Validation: `npm run build`, then `TMPDIR=/private/tmp node --test
tests/hardened-cli/declaration-worker.test.cjs
tests/hardened-cli/local-member-map.test.cjs
tests/hardened-cli/file-local-authority.test.cjs`. The tests retain same-spelled
private helpers under different owners, separate imports, deterministic generated
authority, source hashes, and rejection of altered owner/namespace/member data.
The original 4,114-byte `FrameCenterAdv.as` (SHA-256
`d3f33664f123af9b32bf141c0ba521fafb068943911ae4e2f3a8b6a86c6781a2`)
also extracts its unchanged private `Item` and its four fields. This does not yet
qualify the scheduler for Laya or advance AP's pinned toolchain.
