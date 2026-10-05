# Generated BlendMode consumer

The existing native provider path emits the complete original BlendUse source;
there is no production compiler change. Five generated rows and 58 native Class
rows match AIR for ES5/ES2015 in Node and strict-CSP Chromium. The suite includes
all 15 constants, the NORMAL/alpha condition, reflection, property and constructor
protocols, eight host guards, one missing-provider rejection and one applied
wrong-constant mutation per target in both runtimes. There are zero type errors.
Only inter-element reflection XML whitespace is normalized.

Run `npm run tsc`, then `node tests/native-generated-blendmode-class/run.cjs`.
The default engine is ../LayaAir-op2-blendmode-class-review; override it with
LAYA_ENGINE_REPOSITORY. `verify.cjs --check-current` authenticates the retained
AIR sources, full compiler inputs, generated source, positive/mutated bundles,
native observer, metadata generator and runtime/type-program dependencies.
Whole-client factory emission, rendering and real H5 acceptance remain open.
