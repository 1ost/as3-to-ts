# Source static name methods

Run run.cjs and runtime-guards.cjs from the compiler checkout. The first emits
all three complete AIR subjects from the sibling engine's generated-static-name
packet and compares twenty-five observations on ES5/ES2015 in Node/Chromium.
The actual worker comparison is the OP2 toolkit's test_bulk_generated_static_name.mjs.

The former interface extended Function, incorrectly requiring a source method
named name to also be a string. The emitted source constructor surface now
contains its own source traits and construct signature. A checked, compiler-only
constructorIdentity projection supplies the same object to host Function-typed
registration APIs. It never changes or reads the source name trait, invokes the
constructor or grants generated-Class authority. Lazy Class handles preserve the
source constructor type using a construct-signature constraint.

Four negative type checks reject treating the method as a string, omitting its
required argument, reading a fake Class handle and returning a plain object from
a Class factory. Ten identity controls reject invalid carriers and prove exact
identity, no constructor effects and no implicit registration. Three comparison
controls reject corrupted or incomplete observations. No runtime/source guard
is suppressed. Other host property collisions are not qualified by these tests.

The initial fifteen-row reproduction retained ten TS2345/TS2430 errors in
.cache/native-generated-static-name. Final expanded runs write source/output
hashes, dependency graph, type diagnostics and comparisons to a fresh run folder.
