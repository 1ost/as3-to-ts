# Deferred private static Object constants

Build, then run with `LAYA_ENGINE_REPOSITORY=../LayaAir-op2-private-object-review node tests/native-generated-private-object-constant/run.cjs`.

Both ES5/ES2015 targets match 15 original AIR rows in Node and Chromium with
zero generated type errors. Default null slots precede cinit; each constant
allocates at its source position and locks once. Failed Class retries allocate
fresh objects and preserve escaped partial states. Object contents remain mutable.
Twenty runtime checks cover owner/capability isolation, one-shot publication,
null-valued constants, source-write error 1074, rejected early/instance/protected
bindings, independent domains and inherited identities. Three compiler guards
include removing retry authority and reverting private Object-constant support.
General single-Class retry authority must still be explicitly selected.

Adjacent engine embedded-Class initialization passes 9 AIR rows and 17 guards,
including its coercion and repeat-initialization negative controls.
