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
baseline records source and built compiler hashes. No nested callback compiler
fix, native parity result, GSAP integration or application acceptance is claimed.

The next implementation must preserve the source owner across every nested
callback instead of capturing a foreign dynamic call receiver. It must also
preserve typed writes to variables captured from both the method and intermediate
closures. Validate against these original observations, then replay the complete
maintained PromptMediator; emission alone is not behavioral acceptance.
