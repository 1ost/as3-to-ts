# Generated ElementFormat references and member dispatch

`nativeElementFormatReferenceModule` requires an exact planned ElementFormat
provider/export/import match, a generated reference plan and common property
read/write and lexical providers. It admits this native return family through
existing completion-aware reference coercion. Other return families remain held.
Typed ElementFormat locals and parameters use common lexical property dispatch,
including computed reads, writes, bound methods and calls. This fixes the host
TypeError leak on null property access; AIR reports TypeError #1009.

`formatcases.Reader` is emitted as a complete original AS3 class, with both ES5
and ES2015 factories. Two identical AIR captures provide 41 observations; all
match Node and strict-CSP Chromium with zero TypeScript diagnostics. Coverage
includes conditional locals used by InlineGraphicElement, assignment/defaults,
required parameters, constructor/clone returns, getters, nullish/invalid values,
try/finally coercion and replacement, bound methods, null access, computed access,
setter conversion/locking and arity. Six host checks cover copied/prototype/
proxy forgeries, Class-versus-instance, separate Class domains and retained use.

Thirteen compiler guards preserve provider/plan authority. Three applied controls
remove local coercion, restore raw native property reads, or remove return
coercion; each is detected in Node and Chromium on both targets. Original return
qualification and null-property failures are retained. The adjacent clipboard
reference suite passes 72 AIR rows, eight compiler guards, three host checks and
two mutations per target in both runtimes using the same updated compiler/runtime.

The archive includes source/type-program/compiler inputs, generated factories,
browser bundles, all applied mutation bundles, source/oracle packets and reports.
Its verifier authenticates both oracle captures and current files. It does not
claim font metric/rendering fidelity, full factory acceptance or real H5 behavior.

From this checkout:

```powershell
npm run tsc
node tests/native-generated-element-format-reference/run.cjs
$env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-element-format-class-review'
node tests/native-generated-context-menu-clipboard/run.cjs
node tests/native-generated-element-format-reference/verify.cjs --check-current
```

Runtime engine: `../LayaAir-op2-element-format-class-review` at
`5c699b637a2ac7921e1ae2cf1648c17533238d63`. AIR evidence lives in the separate
`../LayaAir-op2-element-format-reference-review` branch of the same name.
The final primary run is `.cache/native-generated-element-format-reference/run-t6IuGS`;
adjacent is `.cache/native-generated-context-menu-clipboard/run-1c0n0t`.

The node_modules junction points directly to the resolved dependency installation;
chaining another worktree's junction reached Windows' reparse traversal limit.
No dependency package or shared build output was changed.
