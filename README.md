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

The output directory must not exist. A successful run publishes it with one
atomic directory rename after every source has parsed and every staged artifact
has been revalidated. Failures leave no partial output directory.

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

## Provenance and licenses

The frozen parser and syntax model derive from `@as3web/as3-to-ts` 0.3.10 at
revision `fa0b5151ab82758511ddd4b464f0c05b80e06da7`:
<https://github.com/as3web/as3-to-ts.git>.

This local fork is licensed under Apache-2.0, except the MPL-2.0 AVMplus-derived
number-format runtime file identified in the notices. Adobe parser notices and bundled
third-party licenses are preserved in
[`src/hardened-cli/THIRD_PARTY_NOTICES.md`](src/hardened-cli/THIRD_PARTY_NOTICES.md).
