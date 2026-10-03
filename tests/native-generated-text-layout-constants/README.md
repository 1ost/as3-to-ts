# Generated text layout constant consumer

After building the compiler, run with
`LAYA_ENGINE_REPOSITORY=../LayaAir-op2-text-layout-constants-review node tests/native-generated-text-layout-constants/run.cjs`.

Both ES5/ES2015 targets compare 5 generated consumer observations plus 56 shared
native Class observations against original AIR, in Node and Chromium. Full
generated types must have zero diagnostics. Removing either provider reproduces
the compiler hold; changing PUSH_IN_KINSOKU causes the AIR comparison to fail.
Existing generic provider emission needs no compiler implementation change.
