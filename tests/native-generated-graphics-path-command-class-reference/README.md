# Native generated GraphicsPathCommand Class provider

TextFlowLine's original createSelectionRect uses MOVE_TO/LINE_TO. Its previous
replay stopped at unresolved Class-value identity GraphicsPathCommand. This
fixture qualifies the shared native constant Class without changing compiler
admission or introducing an application substitute.

The engine fixture tests/nativeFlashOracle/graphics-path-command-class-reference
retains two identical AIR 51.3.4 runs and SDK pcode/provenance. Three observations
come from the original Reader source, emitted unchanged through a Class script;
five compare common native construction, writes and full Class/instance reflection.
All seven int constants and computed MOVE_TO/LINE_TO reads match AIR.

Both ES5/ES2015 pass Node and Chromium with script-src 'self': eight observations,
three rejection guards (copied plan, missing external module, absent provider),
six host guards (prototype/class/proxy/forged objects, extra arguments and final
subclassing), and two detected generated-code mutations per target/runtime.
Generated sources and their engine dependencies have zero type diagnostics.

Reproduce with LAYA_ENGINE_REPOSITORY pointing at the isolated engine and
PLAYWRIGHT_MODULE pointing at the installed Playwright package:
  node tests/native-generated-graphics-path-command-class-reference/run.cjs
Verify retained evidence:
  node tests/native-generated-graphics-path-command-class-reference/verify.cjs --check-current

Primary run: run-5JqlWr. runtime.json.gz retains compiler/runtime inputs, emitted
sources, bundles, Node/browser results, mutations, SDK extraction and AIR receipts.
Archive: 3,850,207 bytes; SHA-256
  dd2d3c8cce4d8705778e7a20bade27387c1c9d17ae2dfbb6d1d08a8beb590c8f

This qualifies Class/constant behavior. drawPath rendering, the complete source
factory and actual H5 game/account acceptance remain open.
