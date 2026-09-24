# New-expression precedence

Run `node tests/native-new-precedence/parser.cjs` and
`node tests/native-new-precedence/run.cjs --combined` after building.

The parser confines `new` to its constructor target and first argument list.
Thirteen grammar checks cover following casts/type tests, arithmetic,
conditionals, members, indices, call results, nested new, comments, qualified
and computed constructor targets, parenthesized factories and Vectors.

Three complete unchanged AIR subjects match eight observations on ES5/ES2015
in Node/Chromium with zero generated/provider type diagnostics. The observations
cover Class-parameter construction with argument/constructor order, matched and
unmatched is/as, known construction, chained method access, arithmetic,
conditional results and indexed Array construction. Three comparison controls
reject damaged observation lists. The old compiler snapshot fails the same
fixture because it misidentifies construction as a Class call inside the cast.

This fixes parsing, not broad dynamic Object construction, native display
constructor authority, definition lookup or complete UIComponent behavior.
