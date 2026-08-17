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
and 68 proven callable member signatures. Every other parser construct, API,
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

## Provenance and licenses

The frozen parser and syntax model derive from `@as3web/as3-to-ts` 0.3.10 at
revision `fa0b5151ab82758511ddd4b464f0c05b80e06da7`:
<https://github.com/as3web/as3-to-ts.git>.

This local fork is licensed under Apache-2.0. Adobe parser notices and bundled
third-party licenses are preserved in
[`src/hardened-cli/THIRD_PARTY_NOTICES.md`](src/hardened-cli/THIRD_PARTY_NOTICES.md).
