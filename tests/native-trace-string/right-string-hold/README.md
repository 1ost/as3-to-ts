Investigation evidence, not qualified support. Two identical original AIR captures
include trace(item + ":right") where the source Object has both conversion hooks.
AIR prints seven:right and calls toString; the existing common as3Add emits 7:right
and calls valueOf. This finding was observed in .cache/native-trace-string during
the initial broad literal-anywhere prototype. The accepted compiler change does
not enable that form: only a literal-prefixed all-plus expression is newly allowed.
Resolve the right-String addition provider/compiler contract separately before
expanding trace acceptance. No maintained source was edited to bypass this hold.
