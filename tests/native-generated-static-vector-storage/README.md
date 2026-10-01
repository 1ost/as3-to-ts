# Generated static lexical Vector storage

Complete unchanged Holder and Child AS3 subjects are emitted through the
production source-module factory. Their 28 observations match two original AIR
captures on ES5/ES2015 in Node and CSP Chromium, with zero strict type diagnostics.
Six extra checks prove that loaded application domains own independent static
storage. The observer invokes source methods rather than translating their logic.

The compiler now admits authenticated private/protected static Vector variables
through existing lexical descriptors and coercion. Direct-source-parent protected
Vector access uses the same owner capability as existing static primitives. No
engine runtime change is necessary. Unknown Vector authority, Vector constants,
missing native bindings and deeper static ancestry remain explicit compiler guards.
Two applied compiler controls restore the old own-field and inherited-field guards;
each reproduces its old failure against the original source subjects.

Run npm run tsc, then node tests/native-generated-static-vector-storage/run.cjs.
Set LAYA_ENGINE_REPOSITORY if ../LayaAir-op2-static-vector-review is elsewhere.
Run verify.cjs --check-current to authenticate the retained report and inputs.

Adjacent checks pass: protected Vector storage (19 original rows, both targets
and runtimes), generated Vector boundaries (33 rows), and private lexical
projection (24-row source evidence, not a new runtime comparison).
The protected-storage rejection test now uses unsupported internal static storage
and its own exact Vector plan, so an unrelated stale-plan failure cannot mask it.
Full ParagraphElement/PagraphData dependencies, layout and startup remain open.
