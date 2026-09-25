# Original Boolean compiler definitions

Application profiles may pin a `compileDefinitions` file with schema
`as3-boolean-compile-definitions@1` and exact Boolean `CONFIG::name` values.
The same file hash binds the local-member map; the isolated parser receives
the loaded definitions and returns their canonical digest. Mixing declarations
from another configuration is rejected before emission. No environment default
or implicit false value is used.

The shared projection recognizes parsed standalone `CONFIG::name { ... }`
statement blocks, resolves every configuration name (including guards nested
inside disabled blocks), removes excluded statements, and flattens included
blocks into their AS3 function scope. Original source bytes, hashes, spans and
include provenance remain unchanged. CONFIG expressions and declaration guards
remain held. Normalization still precedes projection, so unsupported parser
structures inside disabled blocks also remain held rather than being guessed.

`compile-definitions.test.cjs` checks parser/declaration consistency, included
fragments, missing names, unsupported expressions and semicolon boundaries.
`compile-definitions-native.test.cjs` requires the configured AIR SDK, Laya,
FFDec and Playwright. It compiles the unchanged fixture with three configurations,
runs each native SWF in two fresh AIR processes, and compares constructor and
method results with actual generated `startAS3Application` output in Node and
Chromium. A local declared in one enabled block is used by another. Native
negative controls prove that enabled missing types and undefined nested flags
are errors. Profile controls reject modified flags and mismatched declaration
configuration hashes. Reports retain the source/SWF hashes and compiler commands.

AP selects its values from a hash-pinned original standalone build script. This
fixture does not establish complete ReleaseMain closure or client startup.
