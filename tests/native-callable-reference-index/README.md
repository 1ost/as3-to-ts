# Index constructor references by source owner

A live OP2 factory sample placed constructor parameter analysis in a scan of
the full declaration plan's reference list. The current emitted class was
BoostProfile while callable analysis was visiting TextFlowLine. The 1,353-source
plan repeats that lookup across constructors and emitted classes.

This change creates an owner index on the first typed constructor lookup within
one NativeCallableClasses analysis. Buckets preserve the original reference
order and objects, so the first matching source span is unchanged. Untyped or
vector-only analyses that make no typed-reference lookup build no index. No
process-wide cache, new admission, provider or runtime behavior is introduced.

Differential checks use independently compiled baseline 45bfddd and current
libraries with identical fixture sources, engine 33f0bd991 and helpers. The
preload changes only library resolution and adds counters around the exact
constructor-reference predicate and index insertion. It also hashes all emitted
factory artifacts and records exact rejection messages.

Class, vector and event constructor suites preserve six complete factory
artifacts and 32 rejections. Their 88, 101 and 65 original AIR observations pass
ES5/ES2015 in strict-CSP Chromium with real Laya, unchanged compiler/runtime
guards and zero type/browser errors. The small vector suite has unchanged
comparison counts; index construction can add work on small plans.

A separate 66-class scaling fixture deliberately gives different owners equal
source offsets but alternating Item0/Item1 parameter types. Both generated artifacts remain byte-identical. Baseline scans
make 815,232 comparisons; indexed searches make 16,896 comparisons plus 25,608
index insertions. This measures reference-search work, not whole-client wall time.
The selected OP2 factory still uses its previous qualified compiler pins.

The event fixture initially failed under the baseline compiler while evaluating
Flash imports before common Laya initialization (undefined MouseEvent.CLICK).
Its initialization import now comes first for both versions; original AIR
subjects and assertions are unchanged. event-order-failure.json.gz retains the
old observer and failed baseline capture. This is fixture bootstrap ordering,
not a claim that arbitrary engine import order is qualified.

```powershell
$env:LAYA_ENGINE_REPOSITORY=(Resolve-Path ../LayaAir-op2-boolean-string-review).Path
node node_modules/typescript/lib/tsc.js -p tsconfig.json --pretty false
node tests/native-callable-reference-index/compare.cjs ../as3-to-ts-op2-type-resolution-review/lib
node tests/native-callable-reference-index/compare-scaling.cjs ../as3-to-ts-op2-type-resolution-review/lib
node tests/native-callable-reference-index/verify.cjs
```

The retained archive verifies full current compiler/provider input graphs,
source/oracle bytes, emitted artifact hashes and rejection equality. Existing
base-commit proof packets remain historical; use this packet for this change.
