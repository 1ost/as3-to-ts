# Source typeof for wildcard locals and parameters

When the authenticated generated-class path enables the common XML provider,
typeof on a source wildcard local or parameter now calls its shared as3TypeOf
export. Lexical binding lookup preserves capture and shadowing and excludes
bound fields. Declared String/Boolean storage keeps its existing source rules.
No inference from initializer text or host object shape determines the type.

Run npm run tsc, then node tests/native-generated-wildcard-typeof/run.cjs with
LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE set. Thirty-four observations agree
with two AIR captures for ES5/ES2015 in Node and Chromium CSP, with zero type
errors. These include the original 12-case failing LiteralProbe source unchanged,
plus 22 primitive/reference/Class/function/XML/capture/shadow/reassignment cases.
Two guards authenticate the plan and provider. Applied host-typeof and ignored
shadow-type mutations fail the XML and String-shadow rows respectively.

The previous 12-case generated XMLList indexing fixture also passes on both
targets/runtimes with 14 guards and two mutations. verify.cjs authenticates the
portable reports, source authority, all executed inputs and mutation outcomes;
--check-current also checks current local bytes. Whole-client/H5 acceptance,
other provider/compiler diagnostics and unqualified typeof operand forms remain
open. The earlier wildcard-local XML mismatch is resolved by this qualification.
