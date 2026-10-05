# File-private Vector emission

Vector annotation lookup now uses the selected generated declaration identity,
including file-private helpers. Construction, conversion and Class-vector literal
checks authenticate that declaration against its enclosing source through the
existing plan capability. Public/non-generated annotations retain their existing
lookup. No engine runtime change or game-local substitute is involved.

`npm run tsc` and `node tests/native-generated-file-private-vectors/run.cjs` compare
11 AIR observations on ES5/ES2015 in Node and strict-CSP Chromium, with zero type
errors. Three guards reject changed source, foreign declaration selection and an
applied restoration of the old annotation lookup. Two runtime mutations select a
foreign element declaration or remove a Class literal element; both are detected.
Adjacent initializer callbacks (14 rows) and Vector constants (17 rows) also pass.

`node tests/native-generated-file-private-vectors/verify.cjs --check-current`
validates the retained reports, compiler/provider/runner inputs and AIR captures.
The engine packet retains a separate failed AIR same-basename experiment. That
compiler collision is outside the successful distinct-file qualification.
Full client type checking and H5 acceptance remain open.
