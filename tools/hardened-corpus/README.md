# Hardened AS3 corpus evidence harness

This harness evaluates the pinned legacy `as3-to-ts` parser/emitter without
publishing generated TypeScript. Every emitted byte stream is evidence only and
is labelled `unverified_scaffold`.

The harness fails before conversion unless the Bleach repository's checked-in
authorities agree on the exact maintained corpus:

- `game-client/tapplication_main/src`
- `game-client/tmain/src`
- 2,921 `.as` files
- canonical-LF source-set SHA-256
  `45ae512fe7ef44e01199e4aaeb95722cf5afd287da1084626e25366790c03790`
- complete semantic dependency-graph SHA-256
  `78957409f5bf7ec6894ad7c73af7bd3a2dcccfce930090f980f1e2d1d1db806f`

`game-client/swc/tapplication/src` is an excluded shell mirror and is refused as
an authority entry or maintained root.

## Invocation

```powershell
$env:BLEACH_REPO_ROOT = 'C:\path\to\bleach-services'
node tools\hardened-corpus\hardened-corpus.js `
  --converter-root 'D:\path\to\authenticated-as3-to-ts' `
  --checkpoint 'D:\evidence\as3-to-ts-fa0b5151.jsonl'
```

`--bleach-root` may be used instead of `BLEACH_REPO_ROOT`.
`AS3_TO_TS_CONVERTER_ROOT` may supply `--converter-root`; it must be an
authenticated checkout with installed dependencies. The checkpoint must
be outside the Bleach repository. Optional gates are `--timeout-ms` and
`--max-output-bytes`; both are sealed into the checkpoint identity.

The converter baseline is pinned to
`fa0b5151ab82758511ddd4b464f0c05b80e06da7`. Converter changes outside this
harness and its tests are rejected. The pinned package lock is authenticated as
well.

## Fail-closed behavior

- The census and dependency manifest are parsed as semantic authorities, then
  every maintained path, raw SHA-256, size, and canonical-LF source-set hash is
  independently recomputed.
- The dependency seal covers all graph nodes, 60,750 sorted edges, each node's
  prerequisite and dependent facts, all SCC membership/prerequisite/dependent
  sets, edge semantics, and unresolved-reference/adapter/ordering/wildcard
  summaries. SCCs are recomputed for strong connectivity and maximality;
  cyclic flags, the acyclic condensation graph, topological levels, and every
  graph-derivable summary count/map are independently recomputed. The resulting
  semantic graph digest must also match the explicit policy pin recorded on
  every checkpoint line.
- Disk `.as` paths must exactly equal the sorted authority set. Symlinks,
  non-files, missing paths, extras, unsafe paths, and the excluded mirror abort
  the run.
- Graph source hashes are verified against canonical-CRLF bytes, while the
  census source-set hash remains canonical-LF. Exact disk bytes, raw SHA-256,
  and raw size are captured separately and sealed for worker input, resume
  validation, and mutation detection.
- One source file is evaluated per child process. Each child has a hard timeout
  and a combined stdout/stderr byte cap. Source bytes are captured with their
  authority hash, passed directly to the worker, verified again by the worker,
  and reauthenticated on disk before and after execution and before sealing.
- Generated TypeScript remains in child memory. Only its LF-normalized SHA-256
  and byte size may enter evidence. `materialized` and `published` are always
  false.
- Parse, emit, TypeScript syntax, TypeScript type, subprocess, and admission
  statuses remain separate. Known upstream deadpoints and semantic corruption
  signatures reject admission.
- The checkpoint is canonical JSONL. It begins with a sealed authority/config
  header, contains the exact UTF-8 path-sorted file prefix, chains every line to
  its predecessor, and ends with a content-hash seal.
- Resume accepts only an exact canonical prefix whose authority, input hashes,
  configuration, tool identity, order, and hash chain still match. A completed
  seal is read without rewriting the file. Every file record's complete
  authority, schema, no-publication policy, and gate consistency are checked;
  the final `resultCounts` are recomputed rather than trusted.

No checkpoint status means that application behavior has been implemented.
Even a syntax- and type-clean emission remains `unverified_scaffold` until the
native TypeScript port separately satisfies its behavior, protocol, resource,
and authored-content contracts.

## Tests

```powershell
$env:BLEACH_REPO_ROOT = 'C:\path\to\bleach-services'
node tests\hardened-corpus\run-tests.js
```

Fixtures cover all seven documented upstream issues: constructor `super`
ordering, comments after `extends`, `break` without a semicolon, missing access
modifiers, inline multiline comments, keyword namespaces, and multiple
property declarations. Additional fixtures cover E4X navigation, namespace
identity, uppercase-call assertion corruption, label mangling, multiple types
per file, `super()` without `extends`, and conditional compilation. The tests
also execute timeout/output caps, exact-set refusal, excluded-mirror refusal,
canonical resume sealing, and cross-CWD/input-order determinism.
They additionally mutate the real authority's cyclic/level declarations and
summary count maps to prove that graph drift is rejected before conversion.
