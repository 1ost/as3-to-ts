# Local AS3 type authority workpack

Status: implementation prerequisite. This document does not admit local imports.

The hardened frontend currently authenticates Flash types and members against the
Bleach capability census and Laya capability ledger. Project-local imports remain
held because a package spelling alone is not sufficient authority for a TypeScript
module, declaration kind, source revision, dependency order, or constructor shape.

## Evidence baseline

- Qualification `application-7fe18d9` covers 2,907 application files and publishes
  no TypeScript. It records 278 first failures at `HARDENED_CAPABILITY_ROLE`.
- 264 of those 278 failures begin with a project-local import; 11 begin with an
  unmapped `flash.*` import and three require other semantic diagnosis.
- The repository dependency authority contains 3,029 nodes, 2,923 maintained AS3
  type nodes, 55,482 edges, 2,698 SCCs, and zero unresolved project references.

## Required authority

Generate one canonical local-type map from the fully authenticated dependency
graph. Reuse the hardened-corpus graph verifier; do not implement a weaker second
graph interpretation. Each entry must contain exactly:

- source qualified name;
- declaration kind;
- application/bootstrap module owner;
- authenticated AS3 source path and SHA-256;
- target TypeScript path;
- node ID, SCC ID, and topological level;
- exact prerequisite node IDs.

The generated map, raw dependency-graph digest, canonical semantic-graph digest,
entry count, and source-manifest digest must be pinned by the local authority lock.
Runtime loading must reject unknown keys, duplicate qualified names or paths,
unsafe paths, unsupported declaration kinds, hash drift, count drift, and any map
whose canonical bytes do not match the compiled trust root.

## Admission rules

1. Authenticate the current source's qualified name, module, relative path, and
   raw source SHA before interpreting any local import.
2. Resolve an explicit local import only by exact qualified name. Wildcards,
   aliases, namespace selectors, implicit same-package lookup, and recovery are
   separate workpacks and remain held.
3. Preserve the imported source name and emit a deterministic module specifier
   derived from authenticated target paths. Reject cross-module imports until the
   application/bootstrap TypeScript module boundary is explicitly configured.
4. Admit a local base class only when its graph node is a class and its SCC or
   prerequisite component is eligible under the porting frontier. Interfaces are
   not interchangeable with classes.
5. Do not infer constructor arity from a class import. `new LocalType(...)` remains
   held until an authenticated callable-signature authority exists.
6. The emitter may produce only proposal output. A consumer whose prerequisite
   SCC is unfinished cannot be classified as implemented or publishable.

## Mandatory adversaries

- forged qname/path/SHA/module/kind/node/SCC/level/prerequisite data;
- graph edge, SCC membership, cyclic flag, or condensation-level drift;
- duplicate qnames, portable path collisions, case/NFC collisions, traversal,
  symlinks, excluded shell paths, and application/bootstrap confusion;
- current source bytes that disagree with the mapped source node;
- unresolved, wildcard, same-package, self, and cross-module imports;
- local class used as interface, interface used as base class, and unproven local
  constructor calls;
- consumer admission before every prerequisite component is eligible;
- different CWD/order/time runs producing non-identical authority and output.

No generated TypeScript from this workpack is production code. Strict TypeScript,
capability, forbidden-runtime, dependency-frontier, and behavior gates remain
required after structural emission.
