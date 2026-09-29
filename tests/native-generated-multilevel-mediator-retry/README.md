# Class initialization retries through stable source ancestry

Run npm run tsc, then node tests/native-generated-multilevel-mediator-retry/run.cjs.
Uses retained original AIR evidence in the sibling OP2 test directory
(game-client-laya/tests/multilevel-mediator-script-retry).

A retrying class extends the complete maintained UIMediator and Mediator classes.
Both ES5/ES2015 targets match 17 original observations in Node and Chromium,
including escaped failed Class construction, inherited methods, middle/root
membership, fresh retry identities and successful initialization only once.
Eight rejection guards preserve exclusions for retrying ancestors, unqualified
native ancestry and missing script authority. Nine domain checks and two mutation
checks per target exercise isolation and reject incorrect runtime wiring.

The planner now accepts stable source-only ancestry of more than one level. Every
ancestor must remain a declared non-retrying script class; cycles, unknown roots
and unqualified native bases remain rejected. This does not qualify parent static
initializer failures or the full OP2 login/account flow.
