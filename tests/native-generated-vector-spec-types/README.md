# Primitive Vector specialization types

The maintained OP2 `TabStopFormat` passes `Vector.<String>([Category.TABSTOP])`
directly to Property factories. Untyped `as3VectorPrimitiveSpec("String")`
inferred `unknown`, producing four TS2345 errors in the source cohort.

The planner now supplies the scalar element type for String, Boolean, int,
uint and Number specializations. Runtime tokens and checks are unchanged.

Run `node tests/native-generated-vector-spec-types/run.cjs` after building.
The test compiles 20 typed construction/conversion consumers, preserves five
incompatible-element rejections, reproduces 20 errors when annotations are
removed, and checks identical emitted JavaScript at ES5 and ES2015. Imported
builtin-name ambiguity remains rejected. Use `LAYA_ENGINE_REPOSITORY` to select
the shared engine checkout.

Adjacent validation: `tests/native-generated-vector-construction/run.cjs`
passes 35 AIR observations and 22 domain checks per target in Node/Chromium.
This is type inference qualification, not whole-client runtime acceptance.
