# Class comment source spans

Maintained ModuleManager failed at the callable-class parser because its class
wrapper was inserted between the closing star and slash of the ASDoc comment.
The block-comment scanner used its final character as the token start. The
package parser also calculated comment ends from the start offset twice.
Commented compact packages exposed a second issue: emitter package removal
used a fixed character count and could remove the first slash of the comment.

baseline.json records the unmodified fb61ae1 compiler rejecting both targets.
The fix preserves exact block-comment token spans and starts package emission
at the parsed first content token. No maintained AS3 changes are necessary.

run.cjs covers ASDoc, ordinary, multiline LF/CRLF and empty comments. It adds
only comments to the two original anonymous-member AIR classes; all seven
original observations must match for each of five variants under ES5/ES2015
in Node and CSP Chromium. Type checks and exact comment-span assertions pass.
verify.cjs --check-current authenticates retained output and input hashes.
The anonymous-member suite retains another fresh 111 AIR regression rows,
including typed storage, callback returns and DataEvent. Twelve expression-
comment parser regressions also pass. These tests do not qualify whole-client
startup, native timers, account flows or font rendering.
