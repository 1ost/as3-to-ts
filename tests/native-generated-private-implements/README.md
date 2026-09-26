# Complete private-Class interface factories

Build the compiler, then run `node tests/native-generated-private-implements/run.cjs`.
The test requires the sibling LayaAir engine's authenticated
`tests/nativeFlashOracle/file-local-implements` packet (21 repeated Flash rows).
It emits the five complete original sources with both ES5 and ES2015 targets,
type-checks the generated sources and real providers, and runs native factories
in Node and CSP Chromium. All 21 source observations must match exactly.

Private implementation descriptors retain exact source-file identity and public
interface references. The existing interface contract projector validates their
methods/accessors and inherited implementations using the actual private AST and
import scope. The common nominal publisher registers each actual private Class
with its interfaces. Public source loading entries remain limited to public
Classes and interfaces; helper Classes have no public definition entry.

The unchanged source replay also exercises interface setter dispatch, including
source null errors and raw assignment results, private integer compound addition
with overflow/fractional/String inputs, and lexical `getDefinitionByName` through
the common defining-script domain. Sixteen native checks cover distinct sibling
interface tokens, inherited token/Class selection, wrong-domain casts/coercion,
source lookup called from the host, and retained instances after session retirement.

Ten guards reject forged plans, unavailable script/setter providers, unsupported
multi-declaration Class retry, missing/duplicate interfaces, missing public
accessors, signature mismatches and incompatible derived overrides. Each target
must have zero TypeScript errors. Reports and complete generated sources are
retained under `.cache/native-generated-private-implements`.

Private interface declarations and namespace runtime value publication remain
held. This packet does not prove complete TLF or OP2 startup behavior.
