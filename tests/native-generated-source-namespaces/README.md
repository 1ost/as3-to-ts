# Compiled standalone source namespaces

Build with `node node_modules/typescript/bin/tsc`, then run
`node tests/native-generated-source-namespaces/run.cjs`.
`LAYA_ENGINE_REPOSITORY` selects the engine; the default is the isolated sibling
`LayaAir-op2-source-namespace-review`. `AS3_NAMESPACE_BASELINE` selects the
unchanged compiler used for the namespace-free output comparison (default
`../as3-to-ts-op2`, required commit `59fe4d6`).

The compiler emits complete standalone literal and alias namespace source units
from its authenticated declaration plan. The explicit
`sourceNamespaceProviderModule` must be listed with the script provider in the
module's external dependencies. Generated native code selects genuine inherited
namespace declarations before allocating local headers. Each source script
constant initializes once, including when another source namespace aliases it.
Namespaces may accompany independently authored Classes/interfaces in a cohort;
they do not enter the Class/interface type registry.

The test compiles all three original namespace sources from the engine's retained
AIR oracle, including the exact maintained `tlf_internal.as`. A separate small
authored Class exercises a mixed cohort. Both ES5 and ES2015 native bundles match
16 projected original lookup/value groups in Node and Chromium; the browser runs
with `script-src 'self'`. Eleven checks cover construction, inherited identities,
aliases, separate domains, retirement and retained values. Eight compiler guards
per target retain missing-provider and unsupported-value-use rejection. Removing
inherited namespace selection must fail. Generated source type checks have no
diagnostics. A namespace-free Class/interface artifact is byte-for-byte identical
to the baseline compiler output.

This qualifies publication, not all Namespace behavior. Constructor identity,
`is/as Namespace`, equality and property writes remain outside this checkpoint.
Runtime namespace operands and Namespace-typed storage remain rejected. A file
containing both a Class/interface and namespace declarations remains held until
its shared script-global semantics are qualified. Production pins and full
startup are unchanged.

The older `native-generated-loaded-interfaces/run.cjs` currently stops at its
line-41 rejection expectation on both baseline `59fe4d6` and this compiler. That
pre-existing test failure is not reported as a pass. Engine interface/Loader
regressions pass at the pinned engine, and the namespace-free artifact comparison
checks that this change preserves Class/interface module emission. Source
namespace planning separately passes its 33 guards and authenticates 96 retained
AIR observations.

Run `node tests/native-generated-source-namespaces/verify.cjs --check-current`
to verify the retained generated report, input pins and selected engine commit.
