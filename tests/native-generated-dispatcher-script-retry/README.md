# Direct EventDispatcher Class initialization retries

Run `npm run tsc`, then `node tests/native-generated-dispatcher-script-retry/run.cjs`
and the same command with `--internal` to include lexical capability publication.
The runner verifies the engine AIR receipt before loading its two complete source
classes through the production generated module factory. No source body is
rewritten. Both ES5 and ES2015 run in Node and Chromium under CSP without eval.

All 19 AIR observations pass, with zero generated TypeScript diagnostics, nine
module-domain checks, five rejection guards and one applied initialization mutation
per target. Deterministic generated artifacts, compiler/runtime/type input hashes
and observations are retained in the ignored run report. The prior compiler
rejected this exact fixture with the non-retrying-source-parent guard.

Only an exact flash.events.EventDispatcher provider with the EventDispatcher
constructor-entry protocol gains direct native Class-script eligibility. Other
native bases, unsupported parent retries and internal-package restrictions remain
held. The existing 16-row derived-source-parent retry fixture also passes.

Event listeners in the observer are native test scaffolding; they directly inspect
native Event getters. An initial observer using AS3Property for Event.target failed
with unsupported source property representation. This fixture does not qualify
source dynamic Event property lookup or direct computed construction of native
EventDispatcher (which still lacks a proven Class constructor context). Generated
subclass construction uses its existing canonical native entry and is covered.
ResourceLoader dependencies, complete application emission and gameplay remain open.
