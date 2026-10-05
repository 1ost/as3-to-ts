# Interface peers in class-script retry plans

The package-internal trait guard used to classify implicit-public interface
getters, setters and methods as internal class members. A public interface in
the package therefore rejected a source-derived retry class before emission.
The guard now skips interface nodes; normal interface contract validation remains.

`node tests/native-generated-retry-interface-peers/run.cjs` checks 21 cases:
interface acceptance and implementation, genuine default/explicit internal
class members, internal members on the selected class and its base, and the ban
on selecting an interface as a class script. An isolated CommonJS mutation
restores the old classification and reproduces the original rejection.

`node tests/native-generated-retry-interface-peers/runtime.cjs` adds an unused
same-package interface peer to the existing authenticated derived retry cohort.
The four original AS3 subjects remain byte-identical to the two AIR captures;
the added interface is explicitly a compiler regression fixture, not new AIR
evidence. All 16 original retry observations match for ES5 and ES2015 in Node
and strict-CSP Chromium, with zero type diagnostics, six rejection guards and
nine domain checks. The existing two factory mutation controls execute in Node.
The unchanged derived retry suite also passes with lexical providers enabled.

The runtime provider is `../LayaAir-op2-element-format-class-review` at
`5c699b637a2ac7921e1ae2cf1648c17533238d63`. No runtime behavior was modified.

`node tests/native-generated-retry-interface-peers/verify.cjs --check-current`
authenticates the retained plan report, both runtime reports, compiler source
and built modules, generated modules, bundles, TypeScript inputs and original
AIR evidence. The prior compiler's rejection was also reproduced when retaining.
This is focused compiler qualification, not whole-client or live-game acceptance.
