# Vector interface signature contracts

Run node tests/native-generated-vector-contracts/run.cjs after npm run tsc.
The test authenticates the engine's retained AIR signature compilation packet,
loads all nine complete subject declarations and compares acceptance with AIR:
one unchanged control compiles, three changed implementation signatures fail.
Runtime Vector covariance does not permit different implements signatures.

The planner preserves the full specialization and resolves its element identity
using the declaration's own imports. Structural guards cover nested specializations,
unknown/void elements, same-short-name types and inherited contract conflicts.
These guards exercise planner invariants; they are not additional AIR observations.
Generated Vector storage and callable emission retain their separate admission
guards. No source bodies are trimmed and no runtime implementation is substituted.
