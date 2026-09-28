# Generated DisplayObjectContainer references

`node tests/native-generated-container-references/run.cjs` emits the unchanged
Reader AS3 with `nativeDisplayObjectContainerReferenceModule`. The declared
provider, import and reference-plan binding must match exactly. The engine's
canonical display declaration tokens supply nominal identity; this option does
not permit native subclass allocation or class-initializer operations.

The original Pepper Flash 26 capture runs twice and retains 48 observations:
`is`, `as`, explicit casts, typed locals and typed returns over MovieClip, Sprite,
a Sprite subclass, TextField, Shape, EventDispatcher, null, undefined, plain
objects, arrays, numbers and the container prototype. The ES5 and ES2015 browser
runs match all 48 rows, with zero generated/dependency type errors. Forged
prototypes, constructor properties and hostile proxies are rejected without
invoking their traps. Ten compile-time guards and three comparison controls pass.

Ordinary reference-only consumers are held explicitly: their direct call casts
are not qualified by generated-class lowering. An exploratory consumer run
exposed this gap; the generated-only guard now rejects it before emitting TS.
The existing interactive-reference suite still passes all 36 rows in both targets.

Run `node tests/native-generated-container-references/verify.cjs` to authenticate
the retained original source, SWF and captures. The native run receipt is retained
as `native-result.json.gz`; this is focused compiler qualification, not proof of
the complete ProgressBar or loading screens.
