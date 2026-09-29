# Sprite constructor reference parameters

Run `npm run tsc`, then `node tests/native-generated-sprite-constructors/run.cjs`.
Verify the retained receipt with `node tests/native-generated-sprite-constructors/verify.cjs`.

Three complete original subjects are emitted into native class module factories.
Optional and required Sprite constructor parameters match 35 original AIR rows
in ES5 and ES2015 in Chromium with real Laya initialization. There are zero type
or browser errors. The captured cases cover omitted/extra arguments, null and
undefined, exact instance identity, native Sprite/MovieClip and generated Sprite
subclasses, incompatible display and event objects, primitives, prototypes, and
constructor body entry order without implicit string conversion.

Five compiler guards require the reference/display providers, valid module paths,
authentic plans and null-only defaults. Six runtime guards reject forged native
and generated instances before entering the body. Constructor admission now uses
the same Sprite allocation and ancestry proof already used by reference slots.
No runtime workaround or application logic change is required. Full OP2 startup
remains a separate integration requirement.
