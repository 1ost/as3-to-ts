# Generated Capabilities accessibility fallback

This focused fixture compiles the AIR-captured `caps.AccessibilityReader` into authenticated native source factories. It preserves a configuration-and-capability gate matching OP2's `StandardFlowComposer`; it is not the complete composer.

Run from the compiler root:

```powershell
node tests/native-generated-capabilities-accessibility-host/run.cjs
node tests/native-generated-capabilities-class-reference/run.cjs
node tests/native-generated-capabilities-accessibility-host/verify.cjs --check-current
```

Both ES5 and ES2015 factories pass Node and strict-CSP Chromium execution, with five source observations, nine rejection guards, three host checks, two detected factory mutations per target, and zero strict TypeScript errors. The adjacent canonical Class-reference fixture also passes its eight observations, nine guards, six checks, and two mutations per target. Its unimplemented-member check now uses `hasPrinting` instead of the newly implemented `hasAccessibility` predicate.

The actual AIR captures report accessibility support (`true`); the actual native engine reports no callback host (`false`). The expected native rows explicitly transform only the host capability and resulting enabled-attachment counts. Configuration evaluations remain identical. The archive verifier checks these differences explicitly against the retained unmodified AIR rows. This does not assert equal host values, synthesize a Flash version, or implement an accessibility tree.

`runtime.json.gz` retains both reports, exact compiler/runtime/typecheck inputs, AIR evidence, generated factories, strict-CSP browser bundles, and mutation outputs. `runtime-pin.json` authenticates the archive. A portable verification without `--check-current` validates historical retained bytes. New runs use fresh cache directories; prior Class-reference archives are preserved.

Full TLF version-gated behavior, full source factory/startup integration, and real H5 acceptance remain open. Production provider pins are unchanged.
