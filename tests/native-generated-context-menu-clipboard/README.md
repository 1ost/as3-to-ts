# ContextMenuClipboardItems native reference qualification

This fixture qualifies the explicit `nativeContextMenuClipboardItemsReferenceModule` binding and native return coercion for `flash.ui.ContextMenuClipboardItems`. The shared engine implements the five Boolean flags, AIR defaults, independent cloning, constructor-minted identity, canonical reflection/property traits and construction. Existing ContextMenu gains clipboardItems and clipboardMenu accessors.

Two AIR Desktop 51.3.4 captures agree on 72 observations. Ten rows execute the complete generated `clipboard.Reader` class; 62 exercise the shared native protocol, including direct ContextMenu accessors. ES5 and ES2015 outputs match in Node and Chromium under strict CSP, with eight compiler rejection guards, three nominal runtime checks, two detected mutations per target, and zero type errors. `runtime.json.gz` retains source/compiler/runtime/type inputs and the original native-return admission failure. Earlier 62/68-row captures are diagnostic history; evidence-final is the current 72-row oracle.

Run from this compiler root with `LAYA_ENGINE_REPOSITORY` pointing to the paired engine:

```
npm run tsc
node tests/native-generated-context-menu-clipboard/run.cjs
node tests/native-generated-context-menu-clipboard/verify.cjs --check-current
node tests/native-generated-context-menu-clipboard/verify-adjacent.cjs --check-current
```

The retained adjacent SpriteOwnerHolder regression matches 63 AIR rows per runtime, with 30 runtime guards, ten binding guards and zero type errors. Its runner now preserves per-target modules and drivers. The legacy regression harness does not fingerprint its complete type-program input graph; the primary fixture does.

ContextMenu NativeMenu ancestry remains unimplemented and is explicitly excluded from the adjacent comparison. Complete ContextMenu source property dispatch and browser clipboard execution are not qualified. These focused proofs do not establish whole-client factory, type or H5 runtime acceptance.
