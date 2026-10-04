# Retrying source ancestry ending at EventDispatcher

The declaration planner now accepts an explicitly selected retryable source
Class whose source ancestors end at the canonical EventDispatcher provider.
Previously it accepted the direct native base and source-only ancestry, but
held their combination. This affects OP2 PromptTextPanel -> UIComponent ->
EventDispatcher. Provider identity/nativeBase checks remain required; Error,
cycles, internal ancestor storage and unqualified providers remain rejected.
No engine runtime or OP2-local compatibility code is added.

The new AIR oracle has 19 rows, captured twice: root and leaf initialization
failures, escaped generations, nominal ancestry, super calls and native event
listener isolation/cancellation/removal. Both ES5 and ES2015 native source
factories match in Node and strict-CSP Chromium. Eleven domain checks include
inherited canonical Classes and independent sibling domains. Eight guards
include actually reverting the planner boundary, which rejects this cohort.
Generated code and the event observer both type-check without errors.

Adjacent source-only ancestry (11 rows), derived retry (16), direct dispatcher
retry (19) and its internal-member mode (19) also pass on both targets/runtimes:
46 distinct oracle rows, 65 row executions per target/runtime. Their existing
guards and controls remain active. This is focused runtime qualification, not
whole-client factory or H5/account acceptance.

Build with `node node_modules/typescript/bin/tsc --pretty false`, then run
`node tests/native-generated-dispatcher-ancestry/run.cjs`. The default engine is
`../LayaAir-op2-dispatcher-ancestry-review`; LAYA_ENGINE_REPOSITORY overrides it.
Run the three adjacent runners named above, with `--internal` for the last one.
Pass their five report.json paths in that order to this directory's retain.cjs.
It archives exact compiler inputs, sources, generated modules, executed bundles,
type/bundle dependencies, AIR artifacts, primary oracle tooling and report bytes.
Older adjacent oracle tooling is identified by receipt hashes, not recaptured.
The pin records
the compiler/runtime bases; the engine evidence commit is in providers.json.

`node tests/native-generated-dispatcher-ancestry/verify.cjs --check-current --check-git`
checks archive integrity, report/oracle relationships and exact current input
bytes. Git comparison requires exact bytes for the changed planner; unchanged
compiler files permit only checkout CRLF/LF normalization. Without --check-current the archived replay remains
inspectable if the original cache directories no longer exist.
