# Open namespace methods after getter chains

The resolver now follows ordinary source-typed getter chains from locals and
parameters before selecting an opened namespace member. Getter evaluation is
unchanged. Cross-file return types retain the declaring unit identity; a
namespace-qualified getter's annotation cannot replace an ordinary getter's
annotation. Optional type probes on foreign ancestry stay optional, while
explicit namespace selectors retain their ancestry requirements.

AIR authority: engine 6c7418410556cb1933a5dd239004e68ea9fc9799.
Six observations cover nested/single-evaluation and inherited getters, consumer
class-name collisions, public method receivers and a same-name getter in another
namespace. Both ES5 and ES2015 match Node and Chromium CSP with zero type errors,
two guards and an applied public-selector mutation. The pre-fix compiler emitted
zero type diagnostics but threw swapLines is not a function in both targets.
The pre-fix report uses the initial fixture before the namespace-getter collision
was added, and is corroborating evidence rather than an archived rerun environment.

Run npm run tsc, then node tests/native-generated-namespace-getter-chain/run.cjs
with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE set to the engine and installed
Playwright. verify.cjs authenticates the retained packet; --check-current also
checks live inputs. Retained field-receiver regression: seven rows, two guards,
one mutation, both targets and realms. Native-cast namespace regression also
passes 15 observations, 11 guards and three mutations for each target. Namespace
unit, inherited namespace, provider isolation and source ancestry suites pass.

This focused language qualification does not establish complete TLF or H5 parity.
