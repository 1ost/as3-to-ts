# Generated private static String constants

Run `node tests/native-generated-private-static-constants/run.cjs` from this
checkout with its sibling LayaAir-op2. The test authenticates the engine's
generated-private-static-constants AIR packet, emits all three complete subjects,
and compares all nine rows on ES5/ES2015 in Node and Chromium. Generated and
provider type diagnostics must be zero. Fifteen rejection guards and three
comparison controls retain the boundary around literal String constants.

Private instance, non-String static and computed constants remain held, as do
inherited computed Class lookups. Existing protected constants are regression
tested separately. This does not establish full application routing fidelity.
