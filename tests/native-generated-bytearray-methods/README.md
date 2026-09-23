# Generated native ByteArray method receivers

Run `node tests/native-generated-bytearray-methods/run.cjs`, also with `--combined`.
The complete retained bytecalls.Owner source and its two-run AIR host provide 16
observations on ES5/ES2015 in Node/Chromium. Its private ByteArray field and typed
parameter call native compression methods whose names collide with protected
methods on Owner. The fixture tests direct calls, extraction, call/apply, closure
identity, null dispatch/argument order, receiver replacement during argument
evaluation, and preservation of the owner's protected methods.

The native reference binding must be exact. Source field type spans and parameter
types establish the native receiver; unknown/chained receivers, writes, deletion,
updates and mismatched/missing providers remain held. Ten rejection guards and
four runtime provenance guards accompany three negative comparison controls.
The common ByteArray provider owns method identity and source null errors without
publishing incomplete Class reflection metadata. Full archive execution, native
constructor parameter coercion, arbitrary native methods and reflection remain
separate prerequisites. The fixture constructor uses the independently qualified
ByteArray cast path; constructor parameter admission is not claimed.
