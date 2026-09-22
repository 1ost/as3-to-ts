# Generated reference constants

Run `npm run test:native-generated-reference-constants` after `npm run tsc`.
The suite uses the common engine's pinned `reference-static-initialization`
AIR packet. It emits eight complete classes and three interfaces without
rewriting or trimming their AS3: four independent initialization subjects and
all seven maintained Signal sources. The observer is adapted separately.

All 31 repeated AIR observations must match in Node and Chromium on ES5 and
ES2015, both with and without the combined reference/numeric passes. Strict
type checking covers actual generated subjects and provider dependencies.
The report retains source, output, observer and provider graph hashes, eight
compiler rejection guards and five altered-comparison controls. Omitting
`--signal` runs the four independent subjects and their first 22 rows only.

Reference constants use the shared engine's null storage and private one-shot
initializer. Emission declares storage before class registration and schedules
the original initializer among source static fields, after final class identity
is available. Own-class initialization reads use that captured class. Generated
consumer reads enter the lazy class rather than folding a reference constant.
Failed factories retain the thrown identity and allocate a fresh class/singleton
on retry; successful initialization runs once. Primitive literal reads retain
their established early-value behavior.

Interface rest parameters now emit an explicit `any[]` annotation; the original
IOnceSignal interface is included in strict type checking. This is an erased
signature fix, not a change to runtime rest-array allocation.

The Signal fixture binds its actual IllegalOperationError and qualified-name
providers, and Slot's actual source script global. It checks NIL defaults,
constructor rejection, default tails, prepend/append/filter and add/remove.
It does not qualify dispatch, typed argument validation, IllegalOperationError
behavior or full game integration. Mixed class-body statements, computed
primitive constants, interface/vector/native reference constants and source
script globals with failed static initialization remain explicit boundaries.
