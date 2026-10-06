# Planned interface namespace imports

The source factory authenticates and selects public and file-private interfaces
using nativeVectorTypes. Their planned namespace imports must be treated as
lexical declarations, like generated class namespace imports. They must not
become unresolved TypeScript Class-module dependencies.

The old emitter fails the AIR-qualified probe on __native_interface_0 importing
../scope/detail. The corrected emitter emits both interfaces and matches AIR
[7,11,true,true] on ES5/ES2015 in Node and Chromium under restrictive script CSP.
Five guards reject changed source, forged plans and class selection, reproduce
the old failure by disabling the interface branch, and preserve same-name Class
imports on both interfaces. Type checks have zero diagnostics.

Set LAYA_ENGINE_REPOSITORY to the isolated engine, and PLAYWRIGHT_MODULE to the
installed playwright module. Run node tests/native-generated-interface-namespace-imports/run.cjs.
The existing native-generated-private-namespace-imports suite also passes on
both targets/realms, with its four guards and behavioral mutation control.

Focused evidence is written to .cache/native-generated-interface-namespace-imports.
Full cohort assembly, semantic typing and application acceptance are separate.
