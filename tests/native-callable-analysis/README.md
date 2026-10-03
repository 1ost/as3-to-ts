# Metadata callable analysis

The full OP2 factory repeatedly constructs `NativeCallableClasses` over its
complete source map. A debugger snapshot of the live baseline found it building
`new Set(sourceClassNames)` for every mapped declaration while emitting class
324. Metadata-backed declarations never call the alias-based `callScan`, but
previously still built that set and traversed every declaration for aliases.

Only that unused analysis is now skipped when metadata is present. Metadata and
type validators still run. The path without metadata retains the same alias
discovery and invocation/prototype rejection checks. No source admission,
runtime provider, generated code policy or metadata validation was changed.

Validation against baseline compiler `0c1a893996ce1e4b51723db9abd02ec64203139d`:

- `equivalence.cjs <baseline-lib>`: eight byte-identical TypeScript outputs and
  four identical invocation/prototype rejections.
- `tests/native-class-metadata/run.cjs`: nine source flows, fourteen lifecycle
  steps, twelve predicates, six type surfaces and sixteen guards pass.
- `tests/native-callable-prerequisites/run.cjs`: 145 AIR observations per target
  pass in Node and Chromium, with zero type diagnostics.
- Generated retry-ancestry (11 AIR rows) and Array-as (12 AIR rows) pass both
  targets in Node/Chromium, with zero type diagnostics, using engine `33f0bd991`.

The first two runtime suites retain their own historical engine snapshots;
the generated suites use the stated current engine. `validation.json.gz` retains
the reports and input hashes, pinned by `validation-pin.json`. No end-to-end
factory timing improvement is claimed until a comparable replay completes.

Build with `node node_modules/typescript/lib/tsc.js -p tsconfig.json`. Set `PYTHON`
to an installed Python executable for the metadata evidence extractor, and
`LAYAAIR_CHECKOUT` / `LAYA_ENGINE_REPOSITORY` to the selected engine for the
respective test runners. Compile the baseline to a separate private directory
before invoking the equivalence test; do not use an unverified stale `lib`.
