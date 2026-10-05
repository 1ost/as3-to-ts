# Numeric compound assignment through source interfaces

Authenticated int, uint and Number interface accessors with both getter and
setter now use the qualified public += and -= lowering. The interface contract
and exact reference/read/write providers remain required. Static source getters
can supply interface receiver identity. This does not admit other operators,
unary updates, nonnumeric accessors or missing accessor halves.

The source fixture derives from the public compound suite, replacing the
receiver contract with inherited interfaces and implementing real accessors.
Twenty-four AIR observations repeat identically and match ES5/ES2015 in Node
and strict-CSP Chromium, with zero type errors. They cover int/uint overflow,
fractional and String operands, undefined/null, NaN/negative zero, exceptions,
getter/RHS/setter order, private namesakes and receiver changes during RHS or
valueOf. An applied subtraction mutation that captures the initial receiver
fails both runtime comparisons. Twelve guards include two restored compiler
regressions, absent/mismatched providers and unsupported accessor operations.

Run `npm run tsc` and `node tests/native-generated-interface-compound/run.cjs`.
`node tests/native-generated-interface-compound/verify.cjs --check-current`
authenticates the retained compiler/provider/runner inputs and all results.
Adjacent public compound assignments (24 rows) and interface assignments (28)
pass both targets and realms. The live interface-write rejection test uses *=
now that numeric += has independent qualification; its historical archive stays
unchanged. Full factory emission and H5 acceptance remain separate work.
