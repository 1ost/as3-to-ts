# Source namespace methods with lexical namesakes

A typed foreign receiver resolves its opened namespace method before a caller's
private/protected namesake. Exact namespace, ancestry, ambiguity and shadowing
checks remain enforced. Common QName property dispatch preserves bound method
identity, overriding methods and AS3 null errors. Arguments run before final
method lookup; intermediate receiver getters run once before arguments.

Run npm run tsc, then node tests/native-generated-namespace-namesake/run.cjs.
The default engine is ../LayaAir-op2-namespace-namesake-review; override with
LAYA_ENGINE_REPOSITORY. Sixteen observations from two identical AIR 51.3.4 runs
match ES5/ES2015 in Node and strict-CSP Chromium. Generated sources and their
dependencies have zero strict type diagnostics. Seven compiler rejection guards
cover unopened/ambiguous namespaces, local qualifier shadowing, writes,
construction and missing namespace/property authority. Four host checks cover
invalid namespace inputs and absence of public/other-namespace fallback. Two
applied mutations per target detect a wrong method and repeated receiver getter.
The unchanged fixture fails on the preceding compiler's exact-source guard.

The initial namespace-only delegation exposed a further regression: raw symbol
access lost null error IDs and skipped argument effects. The shared property
helpers fix those demonstrated cases; no OP2-local bridge is added.

node tests/native-generated-namespace-namesake/verify.cjs authenticates retained
source/runtime inputs, artifacts and AIR results; --check-current compares disk.
Adjacent Class namespace reads and chained interface getters pass 26 rows on
both targets against the same engine. This fixture qualifies source instance
method reads/calls with lexical namesakes, not namespace writes or construction.
Complete BaseCompose emission and full H5 game acceptance remain separate work.
