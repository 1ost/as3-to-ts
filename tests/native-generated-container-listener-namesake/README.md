# Native container listener namesakes

Authenticated DisplayObjectContainer receivers resolve public addEventListener
and removeEventListener independently of private methods with the same name in
the generated caller. Exact reference, property, plan and import providers remain
required. Writes and unrelated private member lookup remain rejected.

The unchanged Caller source matches 13 AIR observations in ES5 and ES2015 under
Node and strict-CSP Chromium. Coverage includes listener identity, duplicate
registration, removal, bound closures, receiver and argument order, null receivers,
and competing exceptions. Nine rejection guards, two host-forgery checks and two
mutations per target pass with zero generated/dependency TypeScript diagnostics.
The observer uses the common AS3 property helper for source Function.length; raw
JavaScript function length is not the source-language observation. Renderer and
stage scheduling are test-only no-render scaffolding, using real native Sprites.

The adjacent chained-interface-call suite also passes 18 rows, six rejection
guards and two mutation controls in both targets and runtimes (run-GaJxcm).

Run node tests/native-generated-container-listener-namesake/run.cjs with
LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE set. verify.cjs authenticates retained
AIR sources, receipts, baseline compiler rejection, runtime inputs and results;
--check-current additionally checks current file bytes.

Runtime archive: 11913350 bytes; SHA-256 dd7ed1a610d57aa77bc9d98dff534a794a827a953e41ffaf6a606da40f72575c.
This focused proof does not establish full source factory or H5 acceptance.
