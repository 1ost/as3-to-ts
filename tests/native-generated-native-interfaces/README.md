# Canonical native interface references

Run `node tests/native-generated-native-interfaces/run.cjs` and again with
`--combined`. LAYA_ENGINE_REPOSITORY can select the isolated engine checkout.
Both complete unchanged AIR subject classes are emitted and strictly typechecked,
then compared on ES5/ES2015 in Node/Chromium against fourteen captured rows.
Ten compiler rejection guards, six runtime authority guards per target/runtime
and three negative comparison controls accompany the source comparisons.

Provider configuration must explicitly set nativeInterface:true and supply the
common interfaceProviderModule. Generated domains validate the exact imported
token through isAS3Interface and its source name, preserving token identity.
They do not synthesize an interface from TypeScript shape or a matching name.
Class bases and generated implements/extends still require their separate source
contract authority. Native interface constructors are rejected.

Admitted scope: method signatures/returns, fields, is/as and internal methods
with one required interface parameter and Boolean/void return. The test subjects
perform guarded direct binary calls. Unguarded native dereference behavior,
extracted native method closures, dynamic ByteArray member dispatch, constructor
parameters, source native-interface inheritance and complete archive execution
are separate requirements. This test does not claim all native ByteArray APIs.
