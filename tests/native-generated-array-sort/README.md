# Generated Array sorting bridge

Run `npm run tsc` then `node tests/native-generated-array-sort/run.cjs`.
The unchanged original ArraySortBridgeProbe is authenticated against the common
engine's retained two-run AIR packet. Eight observations compare exactly for
ES5 and ES2015 in Node and Chromium, with strict TypeScript checks, two rejection
guards and four independently loaded-domain identity checks per target.

This exercises sorting on local Arrays and declared public/private Array fields,
including unqualified lexical fields, method extraction, sort.apply and sortOn.
Calls retain source argument evaluation order and binding even when argument
evaluation replaces the field. Null direct calls evaluate arguments before the
lookup failure; null intermediate method reads fail before apply arguments.
Source RangeError construction remains catchable as Error with its message/ID.

Generated sorting uses the shared AS3Property/AS3ArraySort providers. No maintained
application source is rewritten. Foreign receivers, inherited lexical Array
fields, computed sorting keys, method mutation/construction, complete RangeError
Class identity and complete game startup remain outside this fixture's evidence.
