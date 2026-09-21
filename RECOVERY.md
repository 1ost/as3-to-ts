# OP2 transpiler recovery

Original Git history through `6c1a52d85619c5a1267e66d3f1f9c1b6bc996f77` survived
in an independent checkout and is preserved on `port/op2-flash-client`.

Recovery commit `7c478722f7e7d5da46be4a3fb739552559cdd434` restores all 1,185
tracked files and their executable modes from the surviving index for compiler
checkpoint `2a5a57a9d558df4846ccc96fbb53e5a59f1f6b1f`. Every staged blob and mode
matches that index. Original metadata for that missing commit was not invented.

The September 20 head `633bb5e2ea6072fddf2e4d540beb945d1bb16e19` remains missing.
The recovered September 15 source is not a substitute for all later compiler
features expected by the OP2 tools. Isolated foreign-typed-local and
method-signature planning candidates are preserved on the separate
`recovery/op2-candidates-20260920` branch.

Validation of the restored base: the locked TypeScript compiler build passed;
typed-local guards (28), lexical-member checks (34 plus four negative
comparisons), native namespace tests, and focused int/uint assignment tests
passed. The historical return-comment runtime suite stops at its hardcoded
fixture-manifest hash check. The recovered file matches the Git index, but does
not match that runner's expected receipt. Its checks were not weakened.

These are recovery checkpoints, not a claim that the complete port is ready.
