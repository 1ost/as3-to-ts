# Generated declaration identity plan

`npm run tsc` followed by `npm run test:native-generated-declarations` exercises
the restored `createNativeGeneratedDeclarationPlan` API with the real common
engine declaration/type/ByteArray providers (`LAYA_ENGINE_REPOSITORY`, default
`../LayaAir-op2`). This does not enable generated class emission.

Inputs contain a source scope, exact source bytes and SHA-256 hashes, a common
declaration provider module, and optional exact native module/export mappings.
The immutable plan publishes source reference tokens and compiler-only generation
publishers in base-before-derived order without importing source implementations.
Native bindings re-export existing provider constructors; they do not invent
tokens, authenticate runtime metadata or admit a provider's complete API.

Reference-only consumers contribute source-bound annotation locations but receive
no declaration token. Unknown annotations remain explicitly unresolved. Inheritance
requires planned source declarations; native bases, interfaces and file-local
additional declarations remain held. Missing initializer/trait emission cannot be
bypassed by producing a token plan. Method-local binding, constructor timing and
complete Flash reflection remain the emitter/registrar's responsibility.

The internal consumer requires the exact compiler-created plan, source scope and
bytes. Workers must reconstruct plans from the authenticated input; JSON/copied
plans are rejected. Independent builds have deterministic module bytes but distinct
runtime source identities. Configuration accessors are never invoked.

Tests cover 26 negative configuration/capability controls, mutual field references,
wildcard consumers, explicit unresolved types, native identity reuse, source ancestry,
cross-domain identity separation, forged instances, invalid publication and source
reference coercion on ES5/ES2015. Low-level runtime subjects test plan identities;
they are not manually translated application classes or an AIR parity claim.
Actual provider graph hashes and compiled module output are retained under
`.cache/native-generated-declarations/run-*`.

The shared AIR evidence for subsequent class-storage restoration is
`LayaAir-op2/tests/nativeFlashOracle/generated-declaration-storage`. All its
observations, especially initialized derived fields visible inside a base
constructor, still need comparison against the eventual generated class output.
