# Generated namespace trait projection

Run `node tests/native-generated-namespace-traits/projection.cjs` after building
the compiler. `LAYA_ENGINE_REPOSITORY` defaults to the isolated sibling
`LayaAir-op2-namespace-traits-review` checkout. The required engine evidence is
at immutable commit `0e85a408b7b3cfe7041ec20e938b6a58309d3dca`.

This fixture reads nine original AS3 units and both original AIR captures from
Git objects, verifying their recorded hashes. It projects all six Classes through
the actual generated declaration planner and trait emitter. Only the registration
definitions in the retained engine protocol fixture are replaced with compiler
output. Authored initializers and method bodies are still that fixture's native
protocol probes, **not compiled AS3 bodies**. This checkpoint cannot qualify
full generated namespace Classes, FlowElement, or game startup.

All 46 observations match on ES5 and ES2015 definition output in Node and Chromium
under a self-only script CSP. There are zero type diagnostics, ten compiler guards,
and two applied mutations per target/runtime. The mutations corrupt a method URI
or merge two constant URIs and must restore the common registrar's admission
error; they are rejection controls, not complete differing runtime traces.

Projection now retains URI/name identity through inherited-layout filtering,
method signatures, accessor halves and constant initialization records. Reference
types keep planned token expressions; namespaces do not become lexical private
members or public string keys in these definitions. Existing flash_proxy signature
validation remains in force. Callable emission and initializer wiring are still
held by their separate namespace admission checks.

`node tests/native-generated-namespace-traits/verify.cjs --check-current` verifies
the retained compressed report, original oracle, the four changed/relevant compiler
source hashes recorded by this fixture, and recorded engine source inputs. It does
not reconstruct omitted cache files or claim to check every compiler dependency.

Regression results with this patch and the same engine:

- Declaration planning: 26 guards, both targets.
- Generated public accessor overrides: 13 observations, five guards, both targets
  and runtimes, zero type diagnostics.
- Generated Proxy dispatch: 38 observations, eight rejection guards, both targets
  and runtimes, zero type diagnostics.
- Generated accessibility: 12 observations, seven rejection guards and sixteen
  runtime guards, both targets and runtimes, zero type diagnostics.
- Namespace declaration and inheritance tests, both targets, and source ancestry
  and provider-isolation tests pass with the preceding accessor-resolution fix.

The older `native-generated-declarations/traits.cjs` test stops at its assertion
that `public var bad:Class` should be rejected. The unchanged compiler baseline
`04057b67` has the same failure. That obsolete guard was not changed in this work;
the entire historical trait suite is not reported as passing.

Next: connect these definitions to namespace-aware callable members, field and
constant initialization, method binding and `super` dispatch; compile the original
Classes and compare their complete generated output before replaying FlowElement.
