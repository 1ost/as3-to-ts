# Generated private numeric subtraction

Run `node tests/native-generated-lexical-subtraction/run.cjs` after `npm run tsc`.
The complete original Counter AS3 is emitted as generated source. Its private
Number/int/uint fields use compound subtraction with explicit and bare receivers.
Forty original Pepper Flash 26 observations (two identical captures) match in
Node and Chromium for both ES5 and ES2015, with zero type diagnostics. Cases cover
fractional values, int/uint wrapping, strings, Boolean, null/undefined, NaN,
infinities, RHS writes, source valueOf side effects, RHS exceptions and null
receivers. Old field values are read before RHS effects; storage coercion and
assignment-result semantics match the original. ProgressBar's floor/wrap operation
is included. Five rejection guards and three comparison controls pass.

An exploratory computed-method receiver was rejected by the existing exact-source
receiver resolver. That separate capability remains held and has a rejection test;
this change does not relax it. Static/wildcard/accessor operations and
other compound operators remain held. This is not full ProgressBar qualification.

Adjacent numeric-update (22 rows) and lexical-addition (25 observations) suites
pass in both targets. Verify the original retained bytes with `verify.cjs`.
`native-result.json.gz` retains the successful current native run and provider
hashes; `native-result-pin.json` authenticates it.

Protected instance numeric fields and receiver redirection during RHS evaluation
are now separately qualified by `../native-generated-numeric-subtraction`.
