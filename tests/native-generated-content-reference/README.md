# Generated content-family reference operations

The existing nativeContentElementReferenceModule now qualifies method-body
is/as with ContentElement, TextElement, GroupElement and GraphicElement. Exact
plan/provider/import bindings are required; shared as3Is/as3As helpers preserve
native allocation identity and evaluate the operand once. Shadowed and qualified
operands, class initializer casts and missing type-test authority remain held.
No engine runtime or source implementation changes are needed.

Run from the compiler root with LAYA_ENGINE_REPOSITORY pointing to the matching
common engine worktree:

```
npm run tsc
node tests/native-generated-content-reference/run.cjs --combined
node tests/native-generated-content-reference/verify.cjs --check-current
```

The complete Reader AS3 from the engine AIR receipt generates for ES5/ES2015.
Both targets match 17 twice-captured AIR observations in Node and strict-CSP
Chromium with zero generated/dependency type diagnostics. Eleven compiler guards
and nine host identity/proxy guards pass. Applied as3As-null and as3Is-false
mutations each break native identity rows on both targets. Retained runtime
inputs, bundles and both AIR captures are authenticated by verify.cjs.

The content-Vector regression's obsolete wildcard-length rejection was already
failing at the unchanged parent pin. It is replaced with the existing three-
argument rejection; the earlier generated Vector constructor qualification is
preserved. The historical Vector archive is unchanged.

This is not generated native construction, content property dispatch, TextBlock
composition, complete ParagraphElement or OP2/H5/account acceptance.

Adjacent verification at these inputs passes Dictionary reference operations
(15 AIR rows, eight guards), justifiers (128 AIR rows, 12 guards), and content
Vectors (164 AIR rows, 40 guards in Chromium with Laya). All report zero types.
