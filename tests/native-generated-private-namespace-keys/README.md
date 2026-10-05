# Namespace keys introduced by private helpers

The source declaration plan collects namespace member keys from authenticated
file-private classes as well as public ancestry. Modifiers resolve in the
helper's original file scope. Keys remain deduplicated by URI and member name;
private classes do not become public package identities.

The pre-fix compiler rejects this fixture with `generated namespace key is
absent from source plan`. The fixture extends the private namespace import
scenario with new static methods sharing a name under different URIs, a new
instance field and a method that reads it. AIR records six grouped observations
twice identically. Both ES5 and ES2015 match in Node and strict-CSP Chromium,
with zero type errors. Five guards cover exact keys, order independence, source
hashes, unknown namespaces and restoration of the old planner. An applied
runtime mutation substitutes the wrong URI for the new static call and is
detected in both realms.

Run `npm run tsc`, then `node tests/native-generated-private-namespace-keys/run.cjs`.
`node tests/native-generated-private-namespace-keys/verify.cjs --check-current`
checks retained inputs and evidence, including adjacent private namespace
imports (4 rows) and EventDispatcher namespaces (12 rows). This is focused
compiler qualification; whole-client and H5 acceptance remain open.
