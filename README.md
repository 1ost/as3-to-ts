# Bleach AS3 frontend

This repository contains a hardened, local-only ActionScript 3 parser frontend
used by the Bleach porting toolchain. It converts a rooted `.as` source tree
into deterministic parser-AST JSON and a hashed manifest.

It does **not** emit TypeScript, load visitors or plugins, overwrite an existing
output, or provide the legacy `as3-to-ts` command. The historical emitter,
visitors, wrappers, and tests remain upstream-reference material only: they are
excluded from both TypeScript compilation and the packaged production graph.

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
node bin/as3-frontend <source-directory> <new-output-directory> [options]
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
and complete output size. Parsing occurs in a separate capped Node process so a
fatal parser OOM cannot terminate the controlling CLI.

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
