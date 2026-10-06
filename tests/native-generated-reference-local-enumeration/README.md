# Reference-typed local for-each enumeration

The emitter now selects common value enumeration for authenticated predeclared
reference locals. The existing generated assignment pass coerces each fetched
value before publishing it. Class, interface and Vector locals therefore keep
the previous value on coercion failure, and Proxy hooks and live Vector lengths
are observed rather than JavaScript own-property enumeration.

Engine 533048807 retains ten AIR observations, matching in Node and Chromium
CSP for ES5/ES2015 with zero type errors. Three guards reject copied plans,
missing enumeration providers and const storage. Two applied controls restore
legacy enumeration and remove reference coercion; both diverge from AIR.
Legacy emission on identical source skips Proxy values and Vector growth.
The Class enumeration (9 rows, 3 guards) and Proxy dispatch (38 rows, 8 guards)
regressions also pass both targets/realms.

With LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE configured:

    npm run tsc
    node tests/native-generated-reference-local-enumeration/run.cjs
    node tests/native-generated-class-enumeration/run.cjs
    node tests/native-generated-proxy-dispatch/run.cjs
    node tests/native-generated-reference-local-enumeration/verify.cjs --check-current

The packet retains original source/captures, generated output, executed bundles,
compiler/provider input hashes, baseline control and the independent wildcard
Vector property-dispatch failure. Non-Class Vector literals and wildcard Vector
property calls remain separate holds: the final companion uses constructors and
typed Vector receivers, with all ten AIR observations unchanged. Original literal
and earlier wildcard sources/captures remain in engine history (83e21c2c6 and
70faf0558). No runtime provider change is included. This is focused language
qualification, not full-client or H5 acceptance.
