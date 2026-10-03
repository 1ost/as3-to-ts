# Generated TextField is/as operations

`nativeTextFieldReferenceModule` now permits `is` and `as` against the exact
canonical TextField binding. Lowering calls shared `as3Is`/`as3As` so native
identity, null results and operand evaluation follow AS3 behavior. Shadowed
class identifiers and mismatched provider bindings remain rejected.

Run from this compiler checkout after building `lib`:

```powershell
$env:LAYA_ENGINE_REPOSITORY=(Resolve-Path ../LayaAir-op2-textfield-test-review).Path
node tests/native-generated-text-field-tests/run.cjs
```

The runner compares 17 original AIR observations with ES5/ES2015 source-class
modules in initialized Laya/Chromium under a script-src self CSP, checks strict
TypeScript diagnostics, and rejects six invalid compiler configurations per
target. Four runtime checks cover separate application domains, shared native
identity, forged prototypes and proxy wrappers. Replacing the nominal predicate
with true must fail the forged-value check on each target.

The engine already publishes TextField identity. No renderer changes are needed.
This does not establish complete Shortcut runtime, startup or account acceptance.
