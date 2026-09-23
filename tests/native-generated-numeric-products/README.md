# Literal numeric products

Run node tests/native-generated-numeric-products/run.cjs after npm run tsc.

Emits all four complete AIR subjects (including maintained OP2 GameConfig), type-checks against the real engine graph, and compares eight authenticated AIR rows in Node and Chromium for ES5/ES2015. Nine rejection guards retain holds for runtime operands, calls, grouping, other arithmetic, nonnumeric computed constants and mutations.

Public static numeric products of signed decimal literals use early storage and inline consumer reads. They do not trigger class initialization; the common slot coercion still supplies int/uint conversion. This does not qualify general constant folding, instance products, or full game execution.
