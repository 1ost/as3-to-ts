# Bleach AS3 frontend

This repository contains the hardened, local-only ActionScript 3 conversion
tool used by the Bleach porting workflow. It can parse a rooted `.as` source
tree into deterministic AST evidence or transpile the currently admitted
subset into structural TypeScript and a hashed manifest.

The transpile path does **not** call the upstream emitter, load visitors or
plugins, guess unsupported semantics, overwrite an existing output, or provide
the legacy `as3-to-ts` command. The historical emitter, visitors, wrappers,
and tests remain upstream-reference material only: they are excluded from
compilation and the production command graph.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

## Build and verify

```text
npm ci --ignore-scripts
npm test
npm audit --audit-level=high
```

The package is marked `private` and has no publish hooks or runtime dependency
graph. Its two production JavaScript files are self-contained local bundles.

## Usage

Build first, then run:

```text
node bin/as3-frontend parse <source-directory> <new-output-directory> [options]
```

The legacy two-positional form is an alias for `parse`. To emit TypeScript:

```text
node bin/as3-frontend transpile <source-directory> <new-output-directory> \
  --source-census <bleach-swf-capability-census.json> \
  --target-capabilities <laya-authored-content-capabilities.json>
```

To measure the same gate over a source root without writing any `.ts` files,
replace `transpile` with `qualify`. Its sole output is a deterministic manifest
containing one admitted/held record per source and counts by stable diagnostic
code.

An application profile may compile one exact feature root together with its
exact bootstrap dependencies by adding `--source-closure <file>`. The legacy
canonical `as3-authenticated-source-closure@1` form retains its strict no-include
shape. The `as3-authenticated-source-closure@2` form additionally carries exact,
per-root include fragment byte identities and directive edges. These must equal
the reachable projection of the profile's existing source-include authority;
cross-root include ownership is forbidden. Both forms are bound to the selected
profile hash and contain, in fixed application/bootstrap order, repository-relative
roots, profile source prefixes, source byte hashes, QNames, and exact semantic
local dependencies. The positional source directory is the explicit canonical
base, so durable output contains no host paths. Unlisted files are not discovered.

Application profile lock v2 additionally carries one closed
`as3-application-start-contract@1`. It binds the exact public root QName, the
`startAS3Application` export, zero constructor arguments, cancellation before
construction, and the constructed-instance result. The generated application
entry consumes that operation once, checks the supplied `AbortSignal` before
construction, and returns the exact root instance. Its manifest evidence binds
both the application-entry JavaScript and constructor-module JavaScript bytes.
This launch contract does not qualify the held browser facade or its definition
evaluation provenance by itself.

When bootstrap selection must begin conservatively, `qualify --source-plan`
accepts canonical `as3-authenticated-source-plan@1`. It has the v2 root/include
shape but names each file's sorted superset `allowedLocalDependencies`. Parsing
must prove every semantic dependency lies inside that authenticated superset.
Only a fully admitted plan emits canonical `derived-source-closure.json`, with
the exact semantic dependencies under the v2 schema. `transpile` never accepts
a plan and rechecks equality against that derived exact closure. Root reordering,
path escape, source/fragment/edge drift, duplicate QNames, missing dependencies,
and semantic dependency drift all fail closed. Existing single-root include
behavior remains unchanged.

For a separately loaded feature, `transpile` may also accept
`--secondary-authority <file> --compiler-provider <file>`. This requires the authenticated source closure
and emits only `SecondaryAuthority.receipt.json`: no secondary executable entry
or eager import is generated. The canonical receipt binds the request, profile,
source closure, compiler identity, runtime type authority metadata, actual
runtime-authority JavaScript, package metadata, and the exact complete set of
generated JavaScript files. It also publishes the exact canonical source
closure as `AchievementModule.source-closure.json`. Its only accepted exports, in order, are
`AchievementModule` and `achievement.ui.AchievementPresentationPart`. A host
must authenticate the receipt and reject any missing, extra, or drifted package
file before importing either module. The receipt deliberately does not assert
AP's converter-provider identity and does not emit `AS3_SECONDARY_AUTHORITY`;
an AP adapter must bind its separately authenticated repository/commit/lock
provider contract to this receipt. The normal authority-first `ApplicationEntry`
is unchanged.

The compiler-provider authority additionally binds repository/commit claims to
the exact executing `command.js`, parser worker, and local `package-lock.json`
hashes; the request pins the authority document hash. The receipt classifies
every emitted QName as application-owned or bootstrap-owned and publishes the
intended browser linkage partition. Browser linkage in this legacy receipt remains explicitly held:
no module is emitted until an import-free ESM factory can define only application
QNames while accepting every bootstrap QName as an authenticated external
constructor. The normal CommonJS package still contains bootstrap output and
must not be mistaken for that browser factory.

The executable browser lane is a separate, fail-closed opt-in. An exact
`as3-secondary-browser-linker-request@2` on the same flags requires the v2
source closure, the exact six ordered Achievement application classes, a
pinned primary runtime/type identity, and the authenticated compiler-provider
document. It emits `__as3_runtime/achievement-secondary-linker/` as an exact
four-file package: the canonical source closure, canonical secondary type
evidence, one import-free `AchievementModule.secondary-linker.mjs`, and its AP
v3 receipt. The receipt keeps the evidence-file artifact hash distinct from the
registry-canonical live type-document digest. The factory's sole export is `linkAS3SecondaryAuthority`; every
bootstrap QName and runtime module is obtained by a literal call on the primary
capability, while only the six application definitions evaluate in source
order. Class initializers remain deferred and ordered. The generated factory
opens a logical transaction before evaluation, submits the complete live
constructor/predicate/trait document to preflight afterward, and aborts that
transaction if definition evaluation or preflight fails. If later result assembly
fails after preflight, it aborts the returned reservation instead of the consumed
transaction. It returns the branded reservation, not a lease; the host must validate the linked result, commit the
reservation, and seal the committed lease before running any initializer or
other irreversible application effect. The surrounding
CommonJS proposal remains outside this dedicated package and is not browser
authority. Emission proves bytes and declared linkage only: it does not prove
which executable ran, that a host imported the file, or that browser startup
succeeded. The legacy v1 request continues to emit only its inert receipt.

The same v2 lane emits a separate exact two-file
`__as3_runtime/achievement-primary-host/` candidate plus a closed
`achievement-primary-runtime/` ESM graph. Its sole host export,
`createAchievementPrimarySecondaryLinkage`, is a one-shot factory configured by
the package-internal registry adapter. The host statically imports every
authenticated bootstrap definition and external runtime module, but does not
copy bootstrap or secondary implementation into its package. Its canonical
receipt binds the compiler provider, primary runtime artifact, exact secondary
plan, ordered resolver inventories, every direct dependency's path, byte count
and SHA-256 identity, every transitive static import, and the host module bytes. The six Achievement definitions
are omitted from the sealed primary registry and may enter only through the
secondary transaction. The receipt remains explicitly `held` with
`AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_ESM_CLOSURE_UNQUALIFIED`: a native browser
resolves multi-file module URLs after import, while AP currently authenticates
handed-in bytes. A content-addressed module resolver could close that gap, or a
future single import-free host with no dependencies could avoid it. Emission and
dependency hashes therefore do not prove that AP imported those exact bytes or
that startup reached the document constructor.
The held artifact deliberately uses the distinct
`ap-original-achievement-primary-host-candidate-receipt@1` schema and candidate-
named manifest fields; it cannot be mistaken for AP's closed qualified host
receipt or registration.

The compiler also derives a second, separate two-file candidate at
`__as3_runtime/achievement-primary-host-bundle-candidate/`. Its
`AchievementModule.primary-host-bundle.mjs` has no static or dynamic imports,
owns one synchronous cached module table for the complete reachable primary
runtime/bootstrap closure, and exposes only
`createAchievementPrimarySecondaryLinkage`. CommonJS factory bindings are
private to the table; ordinary `module` and `exports` property names remain
ordinary quoted data, while raw CommonJS identities, mutable ESM exports, and
escaped or shadowed loader identities fail emission. Completed namespace
objects are frozen. TypeScript's ES5 lowering preserves optional-chain behavior
and removes template-literal syntax before the final AP-compatible AST audit;
iterable-aware lowering retains native `Set`, `Map`, and iterator traversal.
Every emitted JavaScript string token is re-encoded as JSON string syntax, so
values such as NUL use `\u0000` instead of lexer-incompatible `\0`.
The receipt records every embedded strongly connected component, and tests
exercise single evaluation and live identity through a cyclic factory graph.
The distinct
`ap-original-achievement-primary-host-bundle-candidate-receipt@1` receipt binds
the source host candidate and receipt, each embedded ESM input and derived
factory body, its cycle inventory, and the final bundle bytes. Before copying
any claim, emission revalidates the canonical closed source receipt, expected
plan, literal definition/runtime imports, and the complete dependency-edge
inventory against the embedded graph. Its runtime `dependencies` inventory
is exactly empty because those inputs are embedded evidence, not URLs loaded at
execution. This artifact remains `held` under
`AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_EXECUTION_UNVERIFIED` until an AP-owned
browser observer authenticates and executes the exact emitted bytes. Node or
data-URL diagnostics do not clear that hold.

The output directory must not exist. A successful run publishes it with one
atomic directory rename after every source has parsed and every staged artifact
has been revalidated. Failures leave no partial output directory.

The package-internal type registry also exposes a secondary-authority preflight
reservation for the future browser linker. It requires the primary authority to
be sealed, binds its exact digest, validates a closed collision-free secondary
QName/dependency plan, permits only one active reservation, and publishes no
tokens, constructors, traits, predicates, or construction mappings. Only the
identity-owned reservation can be aborted. Its ownership status enumerates the
closed registry mutation surface and conservatively counts prepared/active
constructions and initialized or live secondary instances. Commit precomputes
and validates the complete publication, journals every identity-owned mutation,
and returns an unforgeable rollback lease. Rollback rejects prepared or active
construction, deletes every journal-owned mapping, and permanently revokes the
secondary constructors and tokens while preserving the primary authority.
Initialization seals the lease for application lifetime because arbitrary
static or user side effects are not reversible; an explicit poison state keeps
a failed initializer installed but unusable. This registry transaction is a
linker prerequisite only and does not itself claim browser-linker readiness.

`internal/AS3PrimarySecondaryHost.ts` is the package-internal adapter from the
emitted linker protocol to that registry transaction. A host configuration is
bound to the exact sealed primary type digest, one expected secondary plan, and
literal definition and runtime-module inventories. Its receiver-branded,
one-shot transaction, reservation, and lease wrappers retain the real internal
reservation and lease identities; they expose commit/abort/seal/poison but no
registry tokens, lookup maps, or rollback authority. Normal and legacy runtime
lanes do not export this adapter. The v2 authority bundle exposes it only under
an internal name consumed by the separately authenticated one-shot host.
Production readiness remains held until AP authenticates and executes the exact
import-free bundle bytes in its browser boundary (or installs and authenticates
a content-addressed resolver for the multi-file candidate).

Available limits are shown by:

```text
node bin/as3-frontend --help
```

Limits cover parser time and memory, file count and bytes, all discovered tree
entries and directories, nesting depth, portable path bytes, per-file AST size,
and complete output size. Parsing and normalization occur in a separate capped
Node process so a fatal parser OOM cannot terminate the controlling CLI.

The transpile command authenticates the exact Bleach source census, the exact
Laya capability ledger, and the locally generated source-to-target mapping
against `config/authority-lock.json`. The current bridge admits 12 Flash types
and 73 proven callable member or constructor signatures. Every other parser construct, API,
member, overload, coercion, or recovery path stops the whole publication with a
diagnostic. Successful files are labeled
`capability-authenticated-typescript-proposal`; they still require the normal
porting workflow's behavior and integration verification before application
ownership is complete.

The frontend rejects unknown options, plugin/visitor flags, symlinks and
junctions, hard-linked aliases, path escapes, non-NFC names, case collisions,
non-ASCII cased path characters with platform-dependent folding, invalid UTF-8,
input mutation, output overlap, and existing or concurrently reserved outputs.

The output parent is a trusted local directory. The reservation serializes all
cooperating frontend processes by portable case/NFC output identity. On POSIX,
Node's portable directory rename API has no `RENAME_NOREPLACE` flag, so the
tool cannot defend the final scan/rename instant from a non-cooperating process
running as the same OS user. Do not grant untrusted writers access to that
parent while a conversion is running.

## Lexical completion callbacks

Authenticated instance methods may call their own declared methods implicitly
inside anonymous callbacks. The existing lexical receiver capture also handles
nested functions and returned callbacks invoked with a foreign `Function.apply`
receiver. Explicit dynamic `this`, inherited method capture, accessor capture and
retrieving a method closure inside a lambda remain held. Original source bytes
and class contracts do not change.

Authenticated `catch(value:*)` retains every thrown value without an Error type
filter, including null, undefined, primitives and object identity. Rethrows and
finally blocks retain their source order. Typed Error catches keep their filter;
multiple typed catches and writes to catch bindings remain outside this admission.
Native evidence lives in LayaAir's `lexical-method` and `wildcard-catch` fixtures.

## Numeric field sorting and wildcard method returns

Authenticated Array.sortOn calls admit a single String field and proven
Array.NUMERIC, optionally combined with Array.DESCENDING. The shared runtime
retains reverse field reads, delayed array writes, native numeric conversion order,
unstable tie ordering, primitive-item partitioning and holes. It uses the retained
AVMplus index sort rather than the host JavaScript sort. Getter failures leave
source ordering intact. Original LoadDataItem priorities and clear() are covered
by native AIR/generated Laya evidence. Multi-field/string/index-return/unique sort
modes, overrides, subclasses, oversized arrays and inherited/accessor Array indices remain held.

Authenticated methods returning * may fall through with undefined. The emitter
supplies the implicit return without changing source bytes; other return types,
getters, lambdas and package functions retain their existing path checks.
The MPL-2.0 sorting adaptation is identified in THIRD_PARTY_NOTICES.md.

## Native Array reference slots

Authenticated native Array assignments from wildcard values preserve reference
identity, normalize null/undefined to null and throw TypeError #1034 before
changing a slot or entering a method on rejected values. User conversion hooks
are not invoked. Consumed assignment expressions retain the right-hand value
independently of the stored coercion. Native evidence is retained in LayaAir's
`array-slot` fixture. Static Object-to-Array assignment and unauthenticated host
subclasses remain held; this does not qualify complete application startup.

Fixed-name wildcard `push` calls preserve receiver capture and argument order.
The runtime dispatches to native Array storage or the actual authenticated class
method, retaining native arity and failure behavior. Computed names, other dynamic
argument calls, Array method overrides and foreign subclasses remain held.
The `dynamic-array-push` native fixture covers this scheduler call pattern.

Dictionary value enumeration requires an explicitly selected compiler intrinsic.
A profile mapping Dictionary to an external bridge cannot silently use the
compiler's branded iterator. Ordinary TypeScript bridge consumers do not need
these compiler-specific helpers.

## Final classes

Authenticated final classes preserve their source modifier through declaration
extraction, semantic adaptation and runtime class metadata. The compiler rejects
final base inheritance; the runtime installation transaction rejects it as well.
An original final class cannot be admitted using a declaration profile that
omitted its final flag. Regenerate such a profile with the shared worker. Final
methods and unqualified reflection remain held. LayaAir's `final-class` fixture
includes AP's unchanged RuntimeArtifactContext and retained native comparisons.

## Native fixture facade ownership

`tools/create-fixture-profile.py` retains runtime predicates on their declared
facade while resolving re-exported constructors and interfaces to the exact
owned capability module. `tools/resolve-laya-export.cjs` uses TypeScript symbol
identity, validates the facade and obligation hashes, and records all inspected
source bytes in `generator-inputs.json`. Matching names or value aliases cannot
replace an owned declaration; duplicate and ambiguous exports remain held.
Run `python3 -B tools/test-fixture-targets.py` for the isolated regressions.
LayaAir's unchanged `original-frame-center-adv` fixture exercises this path with
the EventDispatcher facade and its independently owned core declaration.

## Provenance and licenses

The frozen parser and syntax model derive from `@as3web/as3-to-ts` 0.3.10 at
revision `fa0b5151ab82758511ddd4b464f0c05b80e06da7`:
<https://github.com/as3web/as3-to-ts.git>.

This local fork is licensed under Apache-2.0, except the MPL-2.0 AVMplus-derived
number-format runtime file identified in the notices. Adobe parser notices and bundled
third-party licenses are preserved in
[`src/hardened-cli/THIRD_PARTY_NOTICES.md`](src/hardened-cli/THIRD_PARTY_NOTICES.md).
