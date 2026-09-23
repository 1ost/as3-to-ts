# Generated String for-in

Run `npm run tsc`, then
`node tests/native-generated-string-forin/run.cjs --combined`.

The complete Enumeration subject from the authenticated AIR packet matches 16
observations on ES5/ES2015 in Node/Chromium with zero generated/dependency type
diagnostics, six rejection guards and three corrupted comparison controls.

The existing common key iterator still evaluates the receiver once and preserves
empty-loop targets, labels, break/continue and cleanup. String locals/parameters
receive `as3String(key)` on each iteration, before the body. Null and undefined
Dictionary keys become literal strings, so ordinary nullable String coercion
alone would be incorrect. The wildcard regression retains its numeric key types.

Other typed targets, inline declarations, member/catch-shadow targets, collection
mutation and XML for-each remain unqualified. This does not establish complete
JSONEncoder runtime fidelity. Validated in run-DMVZmJ (16 rows/six guards);
wildcard regression run-LLjYsl passes 17 rows/seven guards.
