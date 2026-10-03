# Static object literal initialization

Permit object literals in the existing deferred static lexical initializer
path. The object must be allocated during class initialization, after default
storage publication; it must not become an early trait value or be re-created
on each read. Existing typed storage and object creation helpers are retained.

From this compiler checkout after building lib:

```powershell
$env:LAYA_ENGINE_REPOSITORY=(Resolve-Path ../LayaAir-op2-static-object-review).Path
node tests/native-generated-static-object-initializers/run.cjs
```

ES5 and ES2015 match four compound original AIR observations in initialized
Laya/Chromium under script-src self CSP, with strict TypeScript diagnostics.
Four additional checks establish application-domain isolation. Two invalid
literal categories remain rejected; reverting object acceptance reproduces
the original compiler failure for both targets. No engine runtime changes.
Complete Shortcut execution and full game startup remain separate checks.
