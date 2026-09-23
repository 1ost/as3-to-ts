# Original Array literal parsing and emission

Run `node tests/native-array-literals/run.cjs` after building the compiler.
Set LAYAAIR_CHECKOUT to the local common engine and PLAYWRIGHT_MODULE to an
installed Playwright module when necessary. The runner archives immutable engine
42dd05e7d17faa3d74eabdea0af796978a4a7214 and owns fresh outputs and browsers.

Twenty-six original Flash observations cover compact and empty arrays, trailing
commas, leading/interior/trailing elisions, block/documentation/line comments,
nested literals, comma/comment text inside strings, and increment evaluation
order, plus post-call indexed reads with parenthesized comma expressions.
Elisions produce own undefined entries. The negative control changes an
own entry to a hole and verifies that the comparison rejects it.

The complete captured Subject.as is compiled by the real compiler. Its source
classes are emitted through the native callable/lazy-class path with actual
common provider code. Source TS is lowered to ES5 and ES2015 before Node and
Chromium execution. Strict TypeScript4.9.5 checks the actual generated source and
provider graph at ES2021, with strictNullChecks=false and skipLibCheck=true. The
engine's bigint code requires a modern provider target; this does not claim an
ES5 engine build. No provider declaration adaptation is used.

`original-evidence-26-valid/provenance.json` authenticates the original source, SWF,
capture scripts, commands and player/compiler identities; the runner pins that
receipt's bytes. `capture.py NEW_DIRECTORY` with OP2_FLASH_PLUGIN configured
reproduces the original capture from the adjacent `original/` source files.
An initial fixture-generation attempt omitted a closing brace and is not included
in successful evidence or runtime counts.

The parser now recognizes elisions and ignores documentation tokens inside an
Array; emission preserves leading trivia without searching inside comments.
The generic whitespace helper also tolerates an absent match. Missing element
separators reject. This is literal formation, not common Array factory provenance,
mutation/storage history, enumeration, or splice admission. Those prerequisites
remain separate and must be connected to this compiler output.

Ten retained original compiler syntax probes check Array comments/separators and short Vector literals. Vector elisions reject; empty and trailing-comma Vector syntax remains accepted. These are parser checks only, with no claim of native Vector runtime support. `original-syntax/provenance.json` authenticates retained sources, successful SWFs, and the original command/tool-hash report.

Five further original syntax probes under `original-post-call-syntax` require
index expressions after calls: empty brackets and missing comma operands reject;
a complete comma-expression index parses. Post-call brackets use accessor rules.
Parenthesized expressions also preserve surrounding block comments.

The original compiler accepts some unparenthesized comma-index source but emits
a class that fails Flash verification with error 1030. Successful runtime cases
use explicit parentheses; the verifier-failing forms are not claimed as matched
runtime behavior. The captured oracle catches errors per row and the delivered
26 successful rows contain no errors. Vector runtime, storage history, and splice
remain outside this suite.
