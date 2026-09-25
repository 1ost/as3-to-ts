# Generated Sprite trait projection

Run npm run tsc, then npm run test:native-generated-sprite with PYTHON set to a
working Python 3 interpreter and LAYA_ENGINE_REPOSITORY set to the isolated engine
(default ../LayaAir-op2). No network downloads or runtime stand-ins are used.

The planner accepts an explicit Sprite native-base binding. Trait projection
retains all 85 inherited public members, source owners, accessor types/facets and
method parameter counts. All 14 nominal reference types require explicit provider
bindings; missing references remain errors. Native overrides remain held until
signature and dispatch behavior is qualified. A Sprite binding in a mixed cohort
does not change a separate EventDispatcher family's override rules.

verify.py independently parses both retained Flash XML documents, verifies their
provenance and SDK declaration hashes, and compares every projected member. The
test includes the maintained BaseModule and its retained source child, verifies
19 rejection controls, and syntax-checks emitted BaseModule on ES5 and ES2015.
The projection fixture's reference bindings are labels only and are never
executed; they do not represent implemented native providers.

Generated domain initialization calls the common engine's
requireGeneratedFlashSpriteSurface before source declaration publication. At this
checkpoint the real engine still rejects blendShader, startTouchDrag,
stopTouchDrag and requestSoftKeyboard. Shader reference support is also absent.
No generated Sprite runtime, full graph typecheck or game startup is claimed.
The existing native allocation protocol is reused without replacement.

Validation: run-rybnwU under .cache/native-generated-sprite; complete 85-trait
comparison, 14 references, 19 guards. Existing declaration planning and trait tests
pass (26 and 32 guards). Both generated Event modes pass their ES5/ES2015
Node/Chromium comparisons. The older generated-declarations/emission.cjs test
still expects rejection of private value++; this fails identically when the two
changed modules are loaded from pre-change e2b082a sources. That pre-existing
stale expectation is retained, not counted as a regression pass.
