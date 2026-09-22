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

The same command now runs `traits.cjs`. The internal `NativeGeneratedClassTraits`
consumer derives the registrar definition from the exact live plan and source
snapshot. It combines inherited public instance declarations, preserves each
declaration's owner, keeps static declarations own, pairs compatible getters and
setters, and binds reference types through the planned token/native exports.
It does not mark the lightweight projection as complete Flash reflection.
Private/protected/internal declarations retain owner and source spans as explicit
lexical prerequisites; a later emitter must handle those rather than making them
public JavaScript properties. Instance constants, vector storage, partial accessor
overrides, unresolved storage and custom namespaces remain held. Static constants
can be projected but still require correct initialization before registration.

Projection checks include 32 negative controls and 12 retained AIR storage rows
against actual registrar execution for ES5/ES2015 definition output. The constructor
and accessor bodies in this test are bridge subjects, not emitted AS3: constructor
ordering, the Event subclass and complete reflection are not claimed by this test.
Importing ByteArray alone is explicitly rejected as source Class authority.
`.cache/native-generated-traits/run-*` retains the projection, generated code,
source hashes, actual provider graph hashes and per-target comparisons.
The three missing bulk emitter options remain missing; this helper does not
bypass their preflight or establish the application/ZIP runtime path.

The shared AIR evidence for subsequent class-storage restoration is
`LayaAir-op2/tests/nativeFlashOracle/generated-declaration-storage`. All its
observations, especially initialized derived fields visible inside a base
constructor, still need comparison against the eventual generated class output.
