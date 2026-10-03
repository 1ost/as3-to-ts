# Built-in integer constants and complete Twips execution

Recognize exact public static numeric int/uint MIN_VALUE/MAX_VALUE references
using authenticated source declarations and resolution. Shadowed, inherited,
unknown, called or computed expressions stay outside this new recognition.
Constants use existing typed early storage; consumer access retains slot coercion.
Both ordinary script globals and explicit class-script modules are checked.

Generated direct, unshadowed Math.round calls use shared as3MathRound. AIR's
floor(value + 0.5) rule differs from JavaScript at signed zero and large values.
Local/member/imported Math names retain source lookup. Other Math operations are
unchanged. Construction and non-unary round calls are not admitted by this path.

From the compiler checkout after building lib:

```powershell
$env:LAYA_ENGINE_REPOSITORY=(Resolve-Path ../LayaAir-op2-int-constants-review).Path
node tests/native-generated-builtin-int-constants/run.cjs
```

Both generated targets match 31 original AIR rows in initialized Laya/Chromium,
with strict type checks, nine compiler checks and two application-domain checks.
Disabling constant recognition reproduces the original hold. Replacing the shared
round helper with host Math.round produces observed AIR mismatches on each target.
The unchanged complete maintained Twips source is included. Full startup and
account validation remain separate; font pixel parity is excluded.
