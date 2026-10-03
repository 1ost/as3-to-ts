# Nested anonymous callback prerequisite

The complete maintained OP2 PromptMediator fails with `nested anonymous
callable body held` at compiler a56bea4, even with the refreshed application
selections. Its combat-power animation contains five nested tween callbacks.
The application source is unchanged; no font rendering is involved.

The complete NestedClosure class exercises two-level callbacks with shared outer
uint storage, separate intermediate locals, multiple owners, foreign/null call
receivers, numeric overflow, fractional/undefined/string writes and a five-level
callback chain. Two independent Harman AIR captures agree on nine observations.
`verify-oracle.cjs` checks the captured artifacts and their source hashes.

Reproduce the original capture from the compiler checkout root:

```powershell
../codex-c3/.venv/Scripts/python.exe ../LayaAir-op2-object-accessor-runtime-review/scripts/nativeFlashOracle.py --air-sdk C:/Users/admin/Desktop/AIRSDK/AIRSDK_51.3.4 --source tests/native-generated-nested-anonymous/oracle/source --entry NestedAnonymousProbe --output <new-evidence-directory>
```

Build the unchanged a56bea4 compiler, set `LAYA_ENGINE_REPOSITORY` to the pinned
f46db1d33 engine checkout, and run `baseline.cjs`. Both ES5 and ES2015 reject the
same original class with the maintained application's diagnostic. The retained
baseline records source and built compiler hashes. The original nine-row baseline remains retained independently of the fix below.

The compiler now registers nested anonymous bodies independently, associates each
with its immediate enclosing callable for local coercion, and captures that
callable's source owner. This preserves captured method and intermediate locals
without substituting the callback's foreign dynamic receiver. Existing receiver,
catch-scope, named-function and unsupported signature/local restrictions remain.

A second complete original class in void-oracle adds seven AIR observations:
five nested void callbacks driven after the method returns, retained owner state,
and an int-returning nested callback returned through an Object signature. This
matches the callback form used by PromptMediator without substituting its source
or treating this fixture as game/GSAP integration.

`run.cjs` matches all sixteen AIR observations in ES5/ES2015 Node and CSP Chromium,
with zero type errors and eleven rejection guards. Applied wrong-behavior
controls replace inherited closure owners with dynamic this and replace uint
storage coercion with Number coercion; both produce divergent results.
`verify.cjs --check-current` authenticates the retained source, runner, compiler
and runtime inputs. The report also retains 111 adjacent AIR rows: anonymous
members (11), Object returns (17), typed locals (47), and DataEvent (36).

The prior tests that rejected all nested lambdas now reject nested named
functions; valid nested lambdas are covered by original-player positive tests.
Replay the complete maintained PromptMediator with this compiler next. Full
application, networking, GSAP and runtime acceptance remain open.
