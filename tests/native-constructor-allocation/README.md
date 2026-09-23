# Native constructor allocation protocol

Run `npm run tsc`, then `node tests/native-constructor-allocation/run.mjs`.
The sibling `LayaAir-op2` supplies the real Sprite implementation and retained
AIR evidence; `LAYA_ENGINE_REPOSITORY` can select another engine checkout.
Playwright resolves from the OP2 browser tools or `LAYA_BROWSER_TOOLS`.

The callable constructor shell invokes an optional, explicitly registered
native allocator before executing source field effects. A source `super()`
enters the existing native receiver without allocating again. Adapters without
an allocator keep their existing receiver and body return behavior.

This fixture uses **handwritten constructor-protocol carriers**, with minimal
test metadata, to connect the compiler helper to the real engine Sprite entry.
It compares all ten retained `generated-sprite-ancestry` AIR observations in
initialized Chromium, plus eleven construction guards. Eighteen synthetic
allocator fault/authority checks run in Node. Both the helper and carriers are
transpiled using the repository's TypeScript dependency for ES5 and ES2015;
the engine uses its own build pipeline. Modern TypeScript checks the complete
import graph without diagnostics. Each run retains bundles, input hashes and
comparison results under `.cache/native-constructor-allocation/run-*`.

The Event and Error ancestry fixtures separately test **actual emitted AS3**
through the new shell on both targets, in Node and Chromium. Event emission
asserts the shell is present and keeps Sprite provider admission rejected.

This is not Sprite compiler admission, full source reflection, or an OP2
application pass. Complete inherited native trait/reference projection and
unchanged AS3 Sprite subclass emission through the actual bulk worker remain
required. Sprite argument/coercion effects beyond the retained no-argument
constructors need their own source observations before admission.
