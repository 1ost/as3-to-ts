# Comments after return and throw

Run `node tests/native-return-comments/run.cjs` after building the compiler.
Set PYTHON to a physical Python executable, PLAYWRIGHT_MODULE to an installed
Playwright package, and LAYA_ENGINE_REPOSITORY to an engine checkout containing
commit27aa27de84d17cac430e0ee59c334d5ee6fd3797 and its installed build dependencies.
The runner archives that exact committed engine and creates fresh outputs.

Fourteen repeated original observations cover compact/block/documentation/chained
comments, newline in a block comment, line comments, plain newline and newline
after a comment, no-value return, Number/identifier/Object expressions, and thrown
Arrays. Complete source and Class/instance XML remain in evidence and repeat-evidence;
files.json authenticates every retained file. Three comparison negatives preserve
row completeness, multiline return behavior and thrown-versus-returned values.
Generated code executes in Node and Chromium at ES5/ES2015. Provider declarations
and actual consumers are typechecked; no substitute declarations are used.

The parser skips block/documentation trivia after return without losing an internal
CR/LF terminator. It leaves the following expression as its own statement when the
return ended. It also skips comments before a throw operand. Expression trivia stays
in the original source for emission. The previously reviewed Array-helper expression
parentheses are required for compact return[1] and are a separate prerequisite patch.

The original compiler rejects the exploratory newline cases when followed by bare
[5] statements as invalid metadata. The successful complete14-case class uses ([5])
for those following statements; no method was removed. The failed exploratory source
and original command diagnostics remain in the root review packet. These are separate
source variants, not byte-identical captures. This fixture does not claim general
ASI, all Unicode line separators, or arbitrary malformed-source acceptance.
