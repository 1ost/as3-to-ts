# Protected numeric compound addition

Run `node tests/native-generated-numeric-addition/run.cjs --combined` with
`LAYA_ENGINE_REPOSITORY=../LayaAir-op2-private-getter-review`. This compiler change
uses existing shared addition and lexical storage providers; no runtime shim is
introduced. Protected instance Number/int/uint fields now admit `+=`, including
inherited fields. Existing private String/int admission is retained.

Two complete AS3 classes match twelve twice-captured AIR rows on ES5/ES2015 in
Node and Chromium under self-only script CSP, with zero generated/provider type
errors. Rows cover fractional Number sums, int/uint overflow and truncation,
String/null/undefined operands, inherited ownership, receiver redirection during
RHS evaluation and null receiver failure before RHS effects.

AIR rereads the receiver path for storage after RHS evaluation and addition.
The shared lowering preserves the old value but repeats the emitted receiver
expression for the write. Field storage performs declared numeric conversion;
the expression returns the unconverted sum. A mutation of the actual emitted
write receiver back to the captured read receiver must break both routing rows
on each target. Five guards retain protected static/nonnumeric additions,
accessor/constant writes and other compound operators.

`verify-air.cjs` authenticates the original sources, receipt and repeated captures.
`verify.cjs --retain <report.json>` freezes runtime evidence once.
`node tests/native-generated-numeric-addition/verify.cjs --check-current` verifies
compiler/provider/type inputs, bundles, AIR comparisons and applied mutations.
Complete ParcelList, combined factory construction and game runtime remain
separate integration requirements.
