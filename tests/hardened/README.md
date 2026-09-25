# Hardened semantic IR and structural emitter gates

The test runner compiles only `src/hardened/**` with an explicitly configured
modern TypeScript compiler. It reads, hashes, and validates the configured
Bleach SWF capability census and Laya authored-content capability document;
no host path is embedded in the implementation.

Required environment variables:

- `HARDENED_TYPESCRIPT_PATH`: directory containing the exact TypeScript 4.9.5 package;
- `HARDENED_SOURCE_CAPABILITY_CENSUS`: current `swf-capability-census.json`;
- `HARDENED_TARGET_CAPABILITIES`: current `authored-content-capabilities.json`;
- `HARDENED_SOURCE_REPO` and `HARDENED_TARGET_REPO`: configured authority
  repositories whose exact HEAD and Git blob identities are checked.

Run `node tests/hardened/run-tests.cjs`. The gate covers double-pinned Flash
type mapping, package-to-module identity, per-declarator field splitting,
constructor `super()` ordering without reordering, AS3 method-closure binding,
stable add/remove callback identity, closed/authenticated normalized AST input,
source import ordering, deterministic TypeScript factory/printer output, and
fail-closed unsupported nodes. It never invokes the legacy emitter or any
AVM/ABC/runtime helper.
