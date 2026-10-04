# Coordinated same-file Class retries

A public Class and its file-private helper now initialize as one source unit
when explicitly selected by `classScriptSources`. The common engine publishes
each completed declaration. A failed attempt leaves escaped globals, Classes,
functions and arrays intact; the next access recreates every reached Class.
Helper lookup timing preserves both AIR's early null selection and deferred
selection of the successful helper. Child domains inherit the established
public Class without allocating another copy of its source unit.

The comparison exposed a second compiler defect: intrinsic Function parameters
were omitted from the typed local plan, so `fn.call(null)` used host JavaScript
instead of the common AS3 invocation path. Function parameters now use the same
qualified call/apply lowering as Function locals. Source/catch bindings continue
to govern whether a receiver has that authority.

The unchanged AIR source cohort supplies 58 observations, captured twice in the
engine's `tests/nativeFlashOracle/source-unit-initializer-retry`. Generated
ES5/ES2015 match all rows in Node and strict-CSP Chromium, with zero type errors,
six compiler rejection guards and seven domain checks per target. Three applied
controls remove early helper selection, discard failed globals, and erase the
Function parameter intrinsic; every control fails comparison in both runtimes.
Adjacent single-Class retry (13), derived retry (16), local Function intrinsics
(8), and file-private classes/lifetime (34) also pass in Node and Chromium.

```
$env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-source-unit-retry-review'
node node_modules/typescript/bin/tsc
node tests/native-generated-source-unit-retry/run.cjs
node tests/native-generated-source-unit-retry/verify.cjs --check-current
```

`runtime.json.gz` retains all five reports, generated sources, positive and
mutated executable bundles, type checks and input hashes. The verifier compares
them with original oracle rows and validates current compiler src/lib inventory
and runtime inputs. `runtime-pin.json` records the exact common-engine commit.
The engine separately tests sixteen malformed-publication guards and fourteen
retained-context checks.

Selection with multiple helpers, source-unit inheritance or private interfaces
remains rejected pending its own source evidence. Ordinary file-private cohorts
keep their established path. This change does not promote OP2's global provider
pins or qualify CustomEase, PromptTextPanel, combined factory/types, or H5 game
acceptance. Next replay the maintained 34-case CustomEase fixture at this pair,
then rerun its complete consumer through authenticated source/provider inputs.
