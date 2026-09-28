# Generated tween cancellation and activity queries

Run `node tests/native-generated-tween-controls/run.cjs` after `npm run tsc`.
The full TweenControls AS3 is generated and loaded through the common native
source-class session against the actual FlashTweenRuntime. Ten state observations
and five invariants pass in Node and Chromium for ES5 and ES2015 with no generated
or dependency type errors. This exercises a source getter/setter, immediate and
delayed cancellation, completion, repeated cancellation and one evaluation of each
query/cancel target. These are native integration assertions, not a new Flash
capture. The underlying runtime retains original comparisons in the engine's
src/extensions/greensock/runtime-tests. No runtime behavior is changed here.

`tests/native-imported-tween/run.cjs` additionally validates exact imported
TweenMax ownership, shadowing, missing/wrong imports, opt-in migration, no method
extraction/construction, and exactly one argument. Optional legacy completion or
property-selection overloads and TweenLite controls remain held. The existing
generated tween-handle suite preserves all 19 observations in both targets.

The successful native report and generated artifacts are retained compressed in
native-result.json.gz with its SHA256 in native-result-pin.json. Full ProgressBar
and loading-screen qualification remain separate.
