# Complete generated Proxy property dispatch

Run npm run tsc, then node tests/native-generated-proxy-dispatch/run.cjs.
Uses the authenticated engine AIR packet tests/nativeFlashOracle/proxy-property-dispatch.
Both complete original classes (proxydispatch.Store and ProxyDispatchProbe) are
emitted without source changes and loaded by NativeSourceClassLoadingSession.
The generated probe itself performs all property operations and collects its rows.

All 38 original observations match in Node and Chromium for ES5 and ES2015.
Each target has zero TypeScript diagnostics, eight compiler rejection cases and
four independent-domain identity checks. The original public getProperty and the
flash_proxy hook coexist without a public alias. The probe exercises reads,
writes, named/bracket calls and argument order, explicit namespace calls, delete,
QName/object keys, live for-in/for-each and genuine TypeError identity. String
anonymous returns and inline String for-in locals use common source coercion.

Native base registration, exact hook signatures and namespace identities must
agree. Explicit namespace calls require the common QName and property providers;
arbitrary namespaces and E4X hooks remain held. No local OP2 bridge is used.

runtime.json.gz retains source bytes, emitted artifacts and hashed compiler,
provider and runner inputs. verify.cjs authenticates the retained comparison.
Engine integration requires commit 33894d7db or its descendants. Adjacent Proxy
construction (ten rows and two reflection documents), object paths (thirty rows),
and anonymous Object returns (seventeen rows, six rejection cases, two mutations)
pass. Generated namespace override inheritance, complete OP2 ArrayCollection,
production startup and the real-account flow remain open.
