# Object-local dot compound addition

Run `node tests/native-dot-property-addition/run.cjs`, optionally with
`--consumer`. All three unchanged Adder, Slot and Root subjects from the
authenticated dot-property-addition AIR packet emit and match 40 observations
on ES5/ES2015 in Node and Chromium. Both modes typecheck the entire provider
graph with zero diagnostics. Consumer mode emits Adder outside the generated
class domain. Seven rejection guards and three corrupted comparison controls
retain unsupported operations and provider boundaries.

The existing nativeObjectPropertyModule now lowers dot += on its qualified
Object/wildcard local/parameter paths through as3AddAssignProperty. The read
receiver and RHS are evaluated before source addition. The receiver path is
evaluated again for storage, preserving RHS reassignment and repeated nested
getter effects. Typed setters coerce storage but return the original sum.
Read, RHS, conversion and storage failures preserve source identity and order.

Specialized existing indexed/lexical dispatch retains precedence. This change
does not admit new indexed compound families, property increments/decrements,
subtraction, deletion or construction. It does not qualify the whole client.
