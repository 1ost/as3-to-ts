# Source namespaces over the native EventDispatcher boundary

Generated namespace ancestry previously omitted the qualified native
EventDispatcher provider. Source namespace fields on its descendants failed
with `namespace inheritance requires a proven same-file ordinary base`.
The ancestry table now includes its empty custom-namespace surface only when
the plan has the exact native constructor entry. Reference-only providers and
same-named source classes do not grant this authority. Proxy namespace lookup
also stops at other native roots instead of treating them as source units.

The original three AS3 Classes and namespace in the engine's
`tests/nativeFlashOracle/dispatcher-namespaces/qualified` fixture emit complete
native factories. Twelve AIR behavior rows match on ES5/ES2015 in Node and
strict-CSP Chromium, with zero type errors. The engine also broadens its
listener declarations to accept the source API's Function type; runtime
implementations are unchanged.

Ten checks preserve missing/incorrect native providers, dynamic source and
provider/source collision guards, plus the separate native-super and inherited
namespace update holds. Two in-memory compiler mutations reproduce the old
ancestry and Proxy failures. A runtime mutation removes namespace binding and
changes the detached-method observation in both realms. The observer captures
the direct Symbol-keyed method before reflective accesses can bind it lazily.

Adjacent namespace traits (46 rows, ten guards, two mutations), namespace/Proxy
isolation (20 rows, eleven guards, compiler/runtime mutations), and dispatcher
retry (19 rows, five guards, nine domain checks, one mutation) pass both targets
and realms on the final inputs with zero type errors.

Build with `npm run tsc`, set LAYA_ENGINE_REPOSITORY to the matching engine,
and run `node tests/native-generated-dispatcher-namespaces/run.cjs`.
PLAYWRIGHT_MODULE optionally selects an installed Playwright package.
`verify.cjs --check-current` checks the retained archive and current input bytes;
without that flag it verifies portable retained evidence. The archive includes
compiler/type/bundle inputs, original AIR evidence, emitted factories,
mutation bundles and adjacent reports/oracles. The pre-fix rejection is retained
against compiler b6e0c8cc54f7b2fc2aaf3da2704ee22ccb393f99.

Direct native `super.addEventListener` / `super.removeEventListener` and
inherited namespace integer updates remain held and have explicit negative
tests. Complete TLF factory emission and real H5/account validation remain open.
