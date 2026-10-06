# Numeric expression Vector indices

The full-factory replay of compiler eac49d4 held ListElement on its source
`param2[(param1 - 1) % _loc4_]`. Numeric index classification now recursively
accepts arithmetic whose operands have authenticated numeric source types,
numeric literals and unary +/-. Unknown expression types remain explicit holds.
The key emitter preserves unary prefixes using the parser's effective start.

Engine bbee05b89 retains 56 repeated AIR observations. Generated ES5 and ES2015
match all rows in Node/Chromium CSP with zero type errors. Controls restore raw
indexing, force numeric expressions through named lookup and drop unary prefixes;
all three diverge. Three guards reject copied plans, compound writes and calls
whose result type has not been qualified. The previous 20-row Vector probe and
38-row Proxy regression also pass both targets and runtimes.

Run `npm run tsc` and `node tests/native-generated-vector-numeric-expression/run.cjs`
with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE configured. `verify.cjs` checks
the portable retained packet; --check-current also checks workspace input hashes.
The packet contains actual source, AIR evidence, generated/executed bundles,
mutated emitter implementations and regression inputs/results.

This fixes the demonstrated expression prerequisite; the full-factory replay
and semantic check are tracked separately in the OP2 toolkit. Arbitrary member
receivers, compound/update/delete indexing and other unsupported expression
types remain separate work. Neither focused checks nor factory emission prove
full client or real H5 account behavior.
