# Generated ErrorEvent returns

The existing nativeErrorEventReferenceModule option now qualifies method and
getter returns through common typed-return coercion. Exact provider/import and
plan validation remain required; other native return types remain separately held.
The original compiler rejection and exact implementation bytes are retained.

The unchanged Reader matches 44 AIR observations in ES5/ES2015, Node and strict
CSP Chromium, with zero generated/dependency type errors. Seven rejection guards
and three host-forgery checks pass. Samples include native ErrorEvent subtypes,
null/undefined, unrelated events, objects, primitives, Class and prototype values.
Typed setters preserve backing values when coercion fails; no object conversion
hooks run for nominal coercion. Return identity and getter effects are preserved.

Try/finally and overriding returns preserve source completion semantics. An inner
catch cannot intercept deferred return coercion. Three mutations per target are
detected in both runtimes: bypass coercion, force null returns, and coerce before
finally. The last mutation is detected by the inner-catch probe; a finally return
alone would mask the timing error and cannot prove correct deferred coercion.

Run run.cjs with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE configured.
verify.cjs authenticates the source cohort, AIR captures, pre-fix rejection,
compiler/runtime inputs and results; --check-current verifies current bytes.
Archive: 3222142 bytes, SHA-256 5ae5031983af8be8eaa736135ddd32b33f5edb2cd1004be5b34922ad6d96669f.
Full factory and H5 acceptance remain open.
