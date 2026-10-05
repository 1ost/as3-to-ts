# Generated static Accessibility Class calls

Original Reader source imports the common canonical Accessibility Class and calls
sendEvent/updateProperties using a genuine native Sprite. ES5 and ES2015 factories
run on real Laya in strict-CSP Chromium. Four rows come from generated AS3; the
remaining 22 behavior rows and complete reflection are observed at the shared
host boundary. Together they match all 27 repeated AIR observations.

Eight nominal/forgery checks pass. Three engine mutations per target are caught:
removing the null-source check, removing child-ID coercion, and claiming an active
host. The complete generated source, observer and imported engine graph type-check
with zero diagnostics. No compiler implementation change was needed.

The adjacent source-error suite passes in Node and Chromium: 17 admitted field
observations, 16 constructor observations and 29 guards, with zero type errors.
Its 27 pre-existing held observations remain unqualified. The Accessibility test
itself uses real browser display objects; it does not claim Node display parity.

```powershell
node tests/native-generated-accessibility-static/run.cjs
node tests/native-generated-accessibility-static/verify.cjs --check-current
```

`qualified.json.gz` retains 1,882 files (18,974,750 bytes), SHA-256
`6ac2163aa5c1728b8b78d9d0841fe9ff933d69afe006e7a0c8e0978ad8ec0b6d`.
It contains AIR/SDK authority, factory and mutation bundles, compiler/runtime/type
inputs and the source-error regression. Retain only into an absent archive with
`verify.cjs --retain <qualification-report> <source-error-report>`. Omit
`--check-current` to verify historical retained inputs after later changes.

The native host remains inactive. Real assistive-technology delivery, dynamic
source Class construction, full TextAccImpl/TLF integration, production provider
promotion and real H5 account acceptance are not established by this fixture.
