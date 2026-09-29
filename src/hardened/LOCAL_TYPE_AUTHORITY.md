# Local AS3 type and member authority

Status: active fail-closed transpiler authority. Generated TypeScript remains a
proposal until the normal porting workflow verifies behavior and prerequisite
completion.

The frontend authenticates project-local types and declaration signatures from
the Bleach dependency graph and the exact maintained source bytes. It does not
infer a constructor, override, inherited field, accessor, or method from a name.

## Type authority

`config/local-type-map.json` is deterministically derived from the authenticated
dependency graph. Each entry pins the source qualified name, declaration kind,
application/bootstrap owner, AS3 path and SHA-256, target TypeScript path, graph
node/SCC/level, and exact prerequisite node IDs.

The loader rejects unknown keys, duplicate or unsafe identities, hash/count
drift, source disagreement, missing dependency edges, excluded mirror paths,
and any non-canonical map. Explicit imports, graph-backed wildcard imports, and
same-package references resolve only to exact importable prerequisite nodes.

## Member authority

`config/local-member-map.json` is produced by one bounded parser/normalizer/
declaration-worker process per authenticated source. It records a complete or
held result for every local type-map entry. Complete declarations contain exact
bases, interfaces, fields, constructors, methods, accessors, modifiers,
namespaces, parameter optional/rest state, return types, and recursive
`Vector.<T>` type spellings. Held declarations retain a stable diagnostic code
and evidence hash; they never become an empty declaration fallback.

The compiled trust root pins the complete canonical member-map SHA-256, the
local-type-map SHA-256, declaration-worker SHA-256, entry count, and complete/
held counts. Runtime loading deep-validates and freezes the whole document.

## Admitted uses

- local base classes and interfaces with exact dependency edges;
- local constructors with authenticated visibility, arity, defaults/rest, and
  argument types;
- typed `super(...)` calls against the exact direct local constructor;
- local overrides against the nearest inherited declaration, including nested
  `Vector.<T>` signatures and non-narrowing visibility;
- inherited local fields, getters, setters, and method calls with exact owner,
  visibility, arity, argument, and result types.
- package-level `public const Name:Type = new Type()` values only when the
  initializer target is the exact authenticated field type and its zero-arg
  constructor declaration is complete;
- atomic output closure: every emitted local import must resolve to another
  admitted module in the same staged source set before anything is published.

Flash bases and members remain independently double-pinned by the source census,
target capability ledger, and mapping artifact. Inherited local method closures,
custom-namespace overrides, ambiguous/held declarations, package expressions
outside the single proven constructor form, and any missing signature remain
explicit HOLDs.

## Mandatory verification

- deterministic map generation across working directories and source order;
- forged qname/path/SHA/module/kind/node/edge/declaration/parameter data;
- parser recovery, timeout, output cap, malformed IPC, and held-source cases;
- wrong constructor/super/override/call arity, type, visibility, rest/default,
  member kind, base cycle, and missing authority;
- nested `Vector.<T>` declarations and calls;
- full strict TypeScript compile, runtime vector/type tests, package inventory,
  qualification over the maintained application corpus, and diff/status checks.

No generated TypeScript is production application ownership by itself. A
consumer whose prerequisite component is unfinished remains unfinished even if
its structural conversion is admitted.
