# Private Class lexical and typed-local ownership

Run `npm run -s build` then `node tests/native-generated-private-lexical/run.cjs`.
The unchanged shared five-file/24-row fixture supplies helper classes and separate
package/file imports. Checks cover exact helper AST selection, distinct helper
identities, typed locals in Second, parent lexical scope selection, and distinct
lexical registrars. Additional compiler fixtures check private reference storage,
static initializer byte spans and protected inheritance without public exposure.
Six guards reject forged/cross-file source selection, absent namespace authority,
and the unchanged First fixture's inline typed `for each` declaration.

The First class's `for each(var item:Helper in items)` remains held by typed-local
target planning. Do not remove or rewrite the source to pass the test. Native
source-unit class initialization/loading and complete callable emission also
remain gated. This is lexical projection validation, not full native Flash replay.
