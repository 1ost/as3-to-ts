# Complete generated XML boundary subject

Run `node tests/native-generated-xml-boundaries/run.cjs --combined`.
The complete unchanged Reader from the engine's authenticated 30-row
generated-xml-boundaries AIR packet is emitted with exact XML/XMLList provider
references. Observer code supplies inputs and calls generated methods; it does
not replace any tested method body. Provider constructors supply test XML trees;
this does not qualify source XML construction.

All 30 rows compare in Node and Chromium on ES5 and ES2015. They cover distinct
reference coercion, null/undefined, raw assignment expression results, attribute
XMLList identity/typeof/length/string conversion, ordered filtered descendants,
attribute property keys, empty selection and source null errors. Type checking
includes generated output and the real provider graph, with strict checks and
strictNullChecks disabled to match the existing generated fixtures.

Eleven compiler guards hold missing provider options, general XML methods and
construction, dynamic/namespaced filters, attribute writes (also parenthesized),
filtered-list escape and wildcard receivers. Three corrupted comparison controls
check the retained row comparison. Run the OP2 toolkit's
test_bulk_generated_xml_boundaries.mjs for actual-worker integration with the
declaration domain in a separate directory.

The new nativeXMLModule option requires matching planned and global XML/XMLList
bindings. Only exact local/parameter receivers, literal attributes, fused
name().toString(), and for-each over literal name-equality descendant filters are
admitted. The common engine owns selection and source errors. QName, arbitrary
filters, XML mutation/construction and full generated reflection remain held.
