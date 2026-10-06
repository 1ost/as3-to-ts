# Namespace field and method-result receiver chains

The resolver carries namespace field types and namespace method return types
through already-lowered selectors. Types remain attached to the declaring class
and exact namespace URI, for own/inherited and explicit/implicit access. Runtime
Class values and unknown call results do not supply invented member types.
Local variables and functions retain precedence over opened namespace members.

AIR authority: engine aade21bca53f7ed1b4d9452e7a65acd064bddcec. Sixteen observations
cover namespace fields and method results, static members, same-name consumer
imports, a second namespace, single evaluation, and local field/function shadows.
Both ES5/ES2015 match Node and Chromium CSP with zero type errors, four guards,
and public-selector/wrong-method-namespace mutations. Pre-fix evidence has 11
type errors and a first-call bump is not a function failure on both targets.
That baseline predates the extra local-function-shadow row and is corroborating
evidence, not an archived rerun environment.

Run npm run tsc and node tests/native-generated-namespace-receiver-chain/run.cjs
with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE set. verify.cjs authenticates
the portable packet; --check-current checks live inputs too. The packet includes
the seven-row field-receiver regression in both targets and realms. Getter-chain
regression also passes six rows/two guards/one mutation in both targets/realms;
native-cast namespace passes 15 rows/11 guards/three mutations per target.
Namespace, inherited namespace, provider isolation and source ancestry suites pass.

Namespace accessor-result types and whole-client H5 acceptance are not established
by this focused field/method result qualification.
