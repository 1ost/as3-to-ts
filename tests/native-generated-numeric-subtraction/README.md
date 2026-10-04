# Protected numeric compound subtraction

Run `node tests/native-generated-numeric-subtraction/run.cjs --combined` with
`LAYA_ENGINE_REPOSITORY=../LayaAir-op2-private-getter-review`. Protected instance
Number/int/uint fields now admit `-=`, including inherited fields. Existing
private numeric admission and the shared Number conversion/lexical storage
providers are retained; no application compatibility code is added.

Twelve twice-captured AIR observations from two complete source classes match
ES5/ES2015 in Node and strict-CSP Chromium with zero generated/provider types.
The observations cover fractions, signed/unsigned wrapping and truncation,
String/null/undefined operands, inherited access, receiver redirection during
the RHS, and null receiver failure before RHS effects. The value is read first,
then the RHS is evaluated and converted, then the receiver is evaluated again
for storage. Storage converts the declared field type; the expression returns
the unconverted difference.

An applied mutation replaces the emitted write receiver with the captured read
receiver; both routing observations must change on each target. Five guards
retain protected static/nonnumeric fields, accessor/constant assignments and
other compound operators. Adjacent private subtraction and public compound
assignment tests cover additional conversion/exception cases.

`verify-air.cjs` authenticates the receipt, sources and repeated captures.
`verify.cjs --retain <report.json>` retains compiler/provider/type inputs and
bundles once; `node tests/native-generated-numeric-subtraction/verify.cjs
--check-current` verifies those bytes, comparisons and mutation outcomes.
This is a shared language qualification, not complete ParcelList, combined TLF
factory or native game runtime acceptance.
