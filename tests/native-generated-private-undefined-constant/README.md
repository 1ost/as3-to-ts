# Private static undefined sentinel

Build, then run node tests/native-generated-private-undefined-constant/run.cjs.
The default engine is ../LayaAir-op2-undefined-constant-review.

Both targets match 16 original AIR rows in Node and Chromium with zero generated
type errors. Thirty runtime guards include explicit undefined/null distinction,
readonly writes including assignment of undefined, rejected registration shapes,
capability isolation, failed retries and independent/inherited domains.
Five compiler rejection checks include reverting the undefined-literal rule and
source variable/constant shadowing of undefined. An inert one-class script is
included without explicit executable retry authority.

Only unshadowed private static wildcard undefined sentinels on root Classes are
qualified. Imports of undefined or wildcard imports, source declarations named
undefined, inherited declarations and nonliteral wildcard values remain held.
The retained AIR shadow observation demonstrates why spelling alone cannot
identify the built-in value. Full Property/TextLayoutFormat runtime remains open.
