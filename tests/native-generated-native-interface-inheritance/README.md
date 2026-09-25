# Native interface inheritance in generated modules

Run npm run tsc, then node tests/native-generated-native-interface-inheritance/run.cjs
(and --internal for lexical-capability publication). The runner authenticates the
shared AIR packet and emits all four complete classes and two complete interfaces
through the production factory. Eleven runtime rows pass on ES5/ES2015 in Node
and Chromium under CSP without eval. The twelfth AIR row independently verifies
the compiler's five native method contracts. Generated TypeScript has zero errors.
Seven domain checks, five rejection guards and two applied mutations verify
isolation/inheritance, invalid declarations, omitted native interface ancestry,
and restoration of the incorrect host getter read.

The declaration planner admits source interface inheritance from the exact
native IEventDispatcher token. Its contract is pinned in the compiler and checked
against AIR; other native parents remain held. Source implementations are checked
normally. An exact native EventDispatcher base can satisfy matching inherited
methods, with native implementation ownership retained in the plan. Source
methods take precedence and incompatible overrides remain rejected. Source
interface tokens are created only after imported native tokens are validated.

Source-interface getter reads on typed local/parameter receivers now use the
common property bridge, preserving null TypeError 1009 instead of a host error.
This is getter-read qualification, not computed properties, writes or unguarded
interface method calls. The observer's native listeners read Event getters
directly; source dynamic Event property lookup remains a separate boundary.
The native-name row checks the token label, not interface Class reflection.

Regressions: all 18 existing AIR interface compiler cases plus eight projection
guards; 28 generated source-interface runtime rows; 19 direct dispatcher retry
rows. ResourceLoader, LoaderContext/URLLoader bindings, complete parser families
and full startup/gameplay remain open.
