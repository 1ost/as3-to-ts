# Inherited protected static Array storage

`node tests/native-generated-inherited-static-array/run.cjs` compares four complete
original AS3 source units, including a file-private subclass, with 16 repeated AIR
51.3.4 observations on ES5/ES2015 in Node and strict-CSP Chromium. It checks direct,
deeper and cross-package inheritance, shared Array identity/mutation, invalid
assignment preservation, null/undefined conversion and protected visibility.

The compiler admits authenticated intrinsic Array fields through its existing
ancestor storage selection and common lexical provider. No engine runtime change
is required. Three rejection checks and two executable mutations per target pass
with zero generated/provider type errors. The pre-change compiler reproduces the
inherited-static ownership rejection on the same original sources.

`verify.cjs --check-current` authenticates the primary retained proof.
`verify-adjacent.cjs --check-current` authenticates the preceding int/reference
suite rerun with this compiler: 14 AIR observations on both targets and runtimes,
three guards, two executable mutations per target and zero type errors.

Other static storage forms, full OP2 source assembly, application integration and
real H5 account acceptance remain separate requirements.
