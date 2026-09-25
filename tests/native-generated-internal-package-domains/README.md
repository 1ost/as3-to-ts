# Generated modules with inherited package-internal access

Run `node tests/native-generated-internal-package-domains/run.cjs` from the
compiler checkout. Requires the sibling LayaAir-op2 checkout or
LAYA_ENGINE_REPOSITORY with the authenticated internal-package-domains and
internal-package-construction AIR packets.

The parent module uses complete Shared and ParentAccess sources. The separately
compiled child module uses complete Shared, ChildAccess, Derived and Alien
sources. No subject bodies or signatures are rewritten. The production native
module factory binds modules to real ApplicationDomains through the loading
session. Two children inherit the parent Class; an isolated child has its own.

All 33 domain observations and twelve constructor/uint-wrap observations match
on ES5/ES2015 in Node and Chromium. Chromium prohibits runtime compilation via
CSP. Twelve additional lifecycle checks preserve parent ownership after child
session retirement; fifteen guards retain unsupported declarations/configuration.
An applied mutation uses the old fresh-only package declaration API and must fail.
All emitted sources and provider dependencies type-check without diagnostics.

Required compiler fixes include named package binding over selected parent
tokens, dynamic dot access in package scope (including wildcard namesakes),
zero-argument internal void methods, uint updates, immutable internal uint
constants in script globals, and omitted constructors over a source root with
its own omitted constructor. Implicit native/multilevel/explicit-parent
construction remains held. Class-script retries may coexist with the lexical
provider only when their source package has no internal declarations.

Run the existing root and derived script-retry tests with `--internal` to
exercise that composition. They retain their original AIR comparisons and
negative cases. Retry behavior involving internal declarations, unnamed-package
inheritance, complete ZIP module composition and game startup remain separate
qualification work. Engine Class construction uses source-compatible error 1063
for the new constructor comparisons.
