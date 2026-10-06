# Generated XMLList integer literal indexing

Authenticated XMLList reads with decimal integer literals in 0..0xfffffffe use
the common as3XMLListIndex provider. The result remains an XML node for child,
attribute and direct typeof operations, or undefined when no item exists.
Receiver evaluation retains normal lexical field and parameter resolution.
Other keys, indexed writes/updates/deletion and invocation remain rejected.

Run npm run tsc, then node tests/native-generated-xml-list-index/run.cjs with
LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE set to the isolated engine and
installed Playwright module. The unchanged LiteralProbe AIR source yields 12
matching observations for ES5/ES2015 in Node and Chromium CSP, zero type errors,
14 guards and two applied compiler mutations (raw indexing, always index zero).

The 27-row generated child-attribute regression passes on both targets/runtimes
with 11 current compiler guards and four runtime guards. Its old rejection of
attribute assignment predates the already-qualified XML mutation implementation
and is retired. Engine indexing qualification additionally covers 11 AIR rows,
two runtime mutations and 44 XML child/traversal regression observations.

The initial wildcard-local typeof mismatch is retained with its emitted bundle
and AIR baseline. General typeof on a wildcard local containing XML still emits
host typeof and reports object. This independent source-operation gap remains
open; direct typeof on an authenticated indexed expression is qualified here.

node tests/native-generated-xml-list-index/verify.cjs checks the portable packet.
--check-current additionally compares current input bytes. This is focused
compiler evidence; the full OP2 factory replay and real H5 acceptance remain open.
