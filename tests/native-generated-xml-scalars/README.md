# XML scalar method lowering

Run `node tests/native-generated-xml-scalars/run.cjs --combined`. The complete
ScalarReader source is authenticated by the engine's generated-xml-scalars AIR
packet. All seven rows compare on ES5/ES2015 in Node/Chromium, with zero generated
or dependency type errors. Three guards reject extra arguments and escaped method
references; three comparison controls catch missing, reordered or changed rows.

Only zero-argument calls on exact typed XML locals/parameters are lowered to the
common helpers. Existing attribute/list and fused name operations remain distinct.
This focused emission test uses a test module loader; it does not prove full
ClientProperties production-factory loading or Game startup.
