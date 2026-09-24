# Protected Vector slots

Run `node tests/native-protected-vector-storage/run.cjs --combined` after building
the compiler. The suite authenticates the engine's protected-vector-storage AIR
packet, emits all four complete subjects and compares nineteen observations on
ES5/ES2015 in Node/Chromium with zero generated/provider type diagnostics.

The base declaration owns protected Vector slots; inherited methods resolve that
same lexical storage and planned specialization. Coverage includes null defaults,
fresh field initializers, base/child reads and writes, assignment-expression RHS
identity, rejected writes preserving storage, and per-instance mutation/reset.
No class bodies or storage implementation are replaced by the observer.

Five rejection guards retain static/constant/internal storage, unplanned source-class
specialization publication and arbitrary constructor coercion boundaries. Three
comparison controls reject omitted, reordered or changed rows. GameLayer's
Sprite ancestry and full application admission remain separate prerequisites.

Planned concrete source-class elements and initialization timing are qualified by
`native-source-class-vectors`; native class elements remain held.
