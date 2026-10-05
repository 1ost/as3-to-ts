# Generated native MouseEvent and TextLine type operations

Generated method bodies can now use unshadowed MouseEvent and TextLine names in is/as expressions through authenticated native providers. TextLine uses its existing reference-module option; MouseEvent requires the new nativeMouseEventReferenceModule and the exact MouseEvent native-base provider binding. Emission calls the common nominal type helpers and evaluates the operand once. Initializer operations, shadowed type names and qualified-name forms remain guarded.

Two AIR Desktop 51.3.4 captures agree on 43 rows from complete Reader and MouseChild source units. ES5 and ES2015 match in strict-CSP Chromium with initialized Laya and real graphic-backed TextLines. Cases cover native and generated-subclass identity, mismatched natives and structural impostors, null/undefined, Class/prototype values, single evaluation, short circuiting, thrown values, no conversion hooks and released/recreated TextLines. Six browser host checks reject forged/proxied/copied MouseEvents and TextLines. Sixteen compiler guards and four applied is/as mutations per target pass with zero type diagnostics.

The adjacent complete TextLine return fixture also matches all 85 AIR rows on both targets with six guards, three host checks and two mutations per target. These are browser comparisons; no Node runtime or font pixel-parity claim is made.

```
npm run tsc
node tests/native-generated-native-type-operations/run.cjs
node tests/native-generated-native-type-operations/verify.cjs --check-current
```

The default runtime is ../LayaAir-op2-context-menu-clipboard-review at f4b6a30ab6812e1d794d1cd15b85d9f0df892395; LAYA_ENGINE_REPOSITORY overrides it. AIR_EVIDENCE_REPOSITORY defaults to the new evidence-only ../LayaAir-op2-native-type-operations-review. For the adjacent runner it points to ../LayaAir-op2-textline-return-review. runtime.json.gz authenticates both AIR packets, all compiler source/lib/utils, positive and mutated outputs, type-program/runtime inputs, and the prior rejection. Full ContainerController/TextLine factory execution and real H5 acceptance remain open.
