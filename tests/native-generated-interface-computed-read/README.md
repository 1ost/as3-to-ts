# Source-interface computed reads

Computed reads on authenticated source-interface locals and parameters now
use the common lexical property helper. AIR permits implementation-only and
inherited members and retains the caller's private namespace. The interface
contract alone is not a whitelist of runtime property names.

38 repeated AIR observations match generated ES5 and ES2015 in Node and
Chromium CSP. Coverage includes locals, captured parameters, inherited getters,
private versus external access, getter effects/errors, bound method identity,
missing members, null and key coercion. The required engine prerequisite is
`c820893d8`: null lookup must reject before coercing an effectful key.

Seven guards reject copied plans, missing read providers, and unqualified
writes/compound assignments/updates/deletion/direct calls. Two executed emitter
mutations detect raw JavaScript indexing and public-only lookup. Both targets
have zero semantic errors. Existing interface compound and namespace-import
fixtures pass 24 and one observation respectively, on both targets and realms.

```
npm run tsc
node tests/native-generated-interface-computed-read/run.cjs
node tests/native-generated-interface-computed-read/verify.cjs
```

Set `LAYA_ENGINE_REPOSITORY` and `PLAYWRIGHT_MODULE` to the isolated engine and
installed Playwright module. Before this change the original probe produced
six type errors per target and an uncaught host TypeError on null indexing;
the raw-read mutation reproduces that behavioral failure. The portable packet
retains exact sources, generated artifacts, executed mutations and dependency
hashes. Native-provider interfaces, interface casts and computed receivers are
not newly qualified by this change. Full-client and real H5 validation remain
separate work.

The subsequent interface-computed-call qualification admits direct calls. The
current read runner retains six guards; the historical packet above retains
its original seven. Current read regression evidence is retained in the call
qualification packet.
