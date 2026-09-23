# Literal static constants in source consumers

Run npm run build and npm run test:native-consumer-constants. Four unchanged
source classes from the common engine's consumer-constant-emission packet are
emitted. Six AIR observations match on ES5/ES2015 in Node/Chromium with zero
strict provider-graph type errors. The runner checks both ordinary and generated
consumers; twelve ordinary guards and five extra generated mutation guards run.
The native observer reads the emitted Trace storage around original consumer
method calls. Class initializers remain present and would record effects if run.

An exact public static primitive literal constant from a planned source class
is resolved from its authenticated source. Its value uses common AS3Property
scalar conversion without evaluating the Class binding. This preserves AIR's
lack of class/parent initialization on first and repeated literal reads, including
uint wrapping. The normal scope resolver prevents rewriting a shadowing local.

For ordinary consumers, mutation, mutable statics, computed constants, nonprimitive constants, private
members, inherited static lookup, indexed access and escaped Class values remain
held. This is not general Class property access or a computed-initializer port.
Reports and actual source/provider/output hashes are under .cache/native-consumer-constants.

The generated-consumer replay keeps the identical AIR source and uses its native
lazy Class constructor in the observer. Before the fix, the first constant read
recorded both parent and child initializers, contradicting AIR; both logs now stay
empty. Generated classes reuse the same exact-source literal-read lowering. Other
generated Class accesses retain their existing separate qualification; no new
computed or nonprimitive constant authority is granted.
