# Private Class lexical and typed-local ownership

Complete helper execution is now qualified separately by
`tests/native-generated-private-modules/run.cjs` (34 Flash rows). The checks
below remain focused compiler-consumer evidence.

Run `npm run -s build` then `node tests/native-generated-private-lexical/run.cjs`.
The unchanged shared five-file/24-row fixture supplies helper classes and separate
package/file imports. Checks cover exact helper AST selection, distinct helper
identities, typed locals in Second, parent lexical scope selection, and distinct
lexical registrars. Additional compiler fixtures check private reference storage,
static initializer byte spans and protected inheritance without public exposure.
Five guards reject forged/cross-file source selection and absent namespace
authority. First now passes typed-local planning including its inline iterator.

The First class remains unchanged. Its inline iterator is covered by the
separate complete native inline-typed-each fixture. This test validates lexical
projection; the module fixture separately executes private Classes and shared
source-unit initialization/loading.
