# Source namespace planning

Build the compiler, then run `node tests/native-source-namespaces/run.cjs`.

The source-unit model retains standalone public namespace declarations separately
from classes/interfaces. Descriptors are frozen, tied to exact source bytes, and
grant access only to detached copies of their own original AST. Mixed class files
also retain their package namespace declarations. Namespace records have no
reflected Class name, Class token, publisher, or loading entry.

The generated declaration planner resolves literal URIs and source aliases across
explicit imports, package scope and wildcard imports. Alias bindings retain both
their own source identity and the resolved target QName. It uses the same literal
boundary as existing namespace lowering. It rejects cycles, missing/ambiguous
aliases, Class aliases, namespace/type/provider collisions, dynamic values and
unqualified literal forms. Namespace names remain unresolved when used as types.

The test authenticates the existing 96-row AIR namespace-update evidence and
reads its unchanged `updatecases.slot` source. Six namespace definitions cover
standalone and mixed units, shared URIs and imported alias chains. Thirty-three
guards cover source authority and unsupported forms. Package variables/constants
are now retained by the parser; a standalone namespace file containing extra
package storage or functions is explicitly held instead of losing that state.

This qualifies build-time identity planning only. Complete native source modules
still reject namespace cohorts pending runtime Namespace-value publication and
domain/load-lifetime evidence. Existing Symbol-based namespace-member tests do
not prove those missing runtime behaviors. No Class or Namespace value is
fabricated to move past this boundary.
