# Predeclared Number for-each storage

Generated source previously rejected `var n:Number; for each(n in values)`.
Admit this local storage and route it through the same common enumeration cursor
and assignment coercion as inline typed loops. Do not emit JavaScript for-in
fallbacks or change application sources.

The two complete AS3 inputs include an unchanged copy of OP2's maintained
`cn.kyiax.yare.util.MathUtil`. Flash 26 captures agree on 15 observations:
scalar conversion, empty/null/undefined receivers, receiver evaluation once,
break/continue, body exceptions, sparse arrays, Vector, negative zero, and actual
MathUtil sum/avg calls. ES5 and ES2015 match in Chromium and Node with no type
errors. Six guards retain provider authority, foreign-type rejection, parameter
redeclaration rejection, Array iterator exclusion and catch-shadow rejection.
Predeclared int/uint/Boolean locals now have separate evidence in
native-generated-primitive-each; the former int exclusion guard has been replaced
with the still-held Array case. The full OP2 loading flow remains unqualified.

Run `npm run tsc`, then `node tests/native-generated-number-each/run.cjs`.
`verify.cjs` authenticates original captures and `verify-runtime.cjs` checks the
retained native results and implementation hashes. Browser profiles are ignored.
Adjacent tests: inline typed each (9 rows) and String enumeration (13 rows), each
passing in both targets, Node and Chromium.

Capture using the shared engine's `scripts/nativePepperOracle.py`, with
`--source tests/native-generated-number-each/source --entry NumberEachProbe`
and a fresh `--output` directory. Supply Flex 4.16.1, playerglobal 14.0,
Electron and Flash 26 plugin paths through its required arguments. The receipt
retains exact compiler/runtime/tool hashes and two capture runs.
