# Binary expressions reading super getters

Run `npm run tsc`, then `node tests/native-generated-super-getter-expressions/run.cjs`.
The default engine is `../LayaAir-op2-super-getter-review`.

The ArrayProperty source expression `super.defaultValue == null` previously
entered assignment lowering and was rejected as a compound assignment. Binary
read operators now recurse normally, lowering each super property to its exact
base getter. Assignments retain their existing setter path and restrictions.

Complete AS3 fixture factories match 31 AIR rows in Node and Chromium on ES5
and ES2015, with zero generated-source type errors. Observations cover loose
and strict comparisons, relational/arithmetic/bitwise operations, evaluation
order, short-circuiting, throws, base-versus-override selection, assignment,
and null/default-array copying. Five checks cover readiness and independent
domain identities. Twelve compiler guards retain exact-plan and eleven compound
assignment rejections. Reverting the operator classification must reproduce the
original rejection on both targets. This is not full client runtime acceptance.
