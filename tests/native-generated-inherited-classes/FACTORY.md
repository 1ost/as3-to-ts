# Native source Class module artifacts

Run `node tests/native-generated-inherited-classes/run.cjs --factory`, also with
`--layout --combined`, from the compiler root after `npm run tsc`.

`emitNativeSourceClassModule` accepts a genuine declaration plan, emitter options,
an exact external-module allowlist, the common loading-session module and an
ES5/ES2015 subject target. The plan must use inherited Class selection, an explicit
script domain and script globals for every source. Reference-only declarations,
interfaces, custom visitors and incomplete cohorts are rejected. Existing emitter
holds, including source static initialization and inherited public overrides,
remain in effect.

The compiler emits all complete source subjects itself. Callers cannot supply
replacement generated bodies. It gives every class a distinct internal module ID,
uses the planned QName mapping for implicit imports, validates both TypeScript
imports and compiled require calls, and rejects missing providers or collisions
between external imports and internal IDs. There is no basename lookup. External
modules, including the compiler's native Class helper, are ordinary static ESM
imports shared across cohorts.

The returned `moduleSource` is native ESM JavaScript containing statically compiled
module functions. `nativeSourceClassModule` is a code-owned common loading-session
capability. Its binder receives the session's script domain and creates a fresh
module cache. It publishes the complete planned token/resolver list without
initializing source Classes. Module evaluation failure invalidates that cache;
session retries invoke a fresh binder. The generated code performs no eval,
Function construction, bytecode decoding or SWF execution. ES5/ES2015 selects the
compiled subject bodies; the surrounding ESM artifact targets a modern browser
and is intended for the application's normal bundler.

`declarationSource` supplies the public TypeScript declarations. `generatedSources`
and `dependencies` retain the full emitted TS and dependency graph; source hashes
come from the authenticated plan. Consumers must type-check these sources with
their actual providers and bundle the static imports before admitting a module
to an application loading session. A discovered source inventory is insufficient.
Import paths are relative to the artifact's output directory, including all
generated TS retained for type checking.

The production-artifact test uses actual common providers and compiler helpers.
It compares all 47 authenticated AIR rows on both subject targets in Node and
Chromium, checks full generated/provider types and repeatable artifact emission,
and runs Chromium with CSP `script-src 'self'` (no unsafe-eval). Its fifteen
lifecycle/identity checks include separate domains, same-domain inheritance,
lazy source creation and invalid/closed cohort rejection. Eight build guards
reject forged plans, invalid targets, dependency omissions/collisions, custom
visitors and mismatched reference plans. Three implementation mutations must fail:
missing inherited selection, sharing the module cache across cohorts, and omitting
Class-return coercion. Source-unit creation instrumentation is observer-only.

This qualifies the retained Shared/Reader/Derived cohorts. It does not approve an
arbitrary OP2 dependency cohort, source document-root construction, all source
initializers, the full native game or authenticated account flows.
