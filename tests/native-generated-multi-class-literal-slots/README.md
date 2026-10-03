# Private literal slots in a multi-class source file

Run `LAYA_ENGINE_REPOSITORY=../LayaAir-op2-multi-class-review node tests/native-generated-multi-class-literal-slots/run.cjs` after building.

The unchanged AIR fixture is emitted through source-class modules for ES5 and
ES2015. Five observations compare private String literals (including escapes),
null reference slots, helper storage, updates, and shared script-global identity.
Node and Chromium results must agree. Seven lifecycle checks cover independent
sibling domains and inherited Class/helper identity. Eleven compiler guards
include calls/member reads/allocations that remain held and removal controls
for the String and null-slot qualification separately.

This does not enable multi-class executable-initializer retries. The existing
planner restriction remains in place; no classScriptSources entry is required.
A separate exploration found that method-return chaining `owner().call(null)`
bypasses the canonical Function call bridge. This fixture uses an explicit
Function local to isolate literal slots; the chaining defect remains open.
