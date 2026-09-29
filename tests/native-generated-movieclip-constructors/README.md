# MovieClip constructor reference parameters

Run `npm run tsc`, then `node tests/native-generated-movieclip-constructors/run.cjs`.
`verify.cjs` authenticates the retained runtime receipt and original AIR capture.

Three complete source classes cover optional/required MovieClip parameters and a
generated MovieClip subclass. ES5 and ES2015 factories match 35 original AIR rows
in Chromium with real Laya, with zero type/browser errors. Samples cover null,
undefined, native/generated MovieClips, Sprite and other incompatible objects,
primitives, prototypes, omitted/extra arguments, identity and body entry order.
An object's toString is never used to coerce these references.

Six compiler guards enforce reference and MovieClip providers, valid/exact module
configuration, authentic plans and null-only defaults. Six runtime guards reject
forged Sprite, MovieClip and generated subclass instances before body entry.
Constructor admission reuses the existing authenticated MovieClip reference path.
Maintained BitmapNumber, ComboBox and IconComboBox use these parameters; their
complete UI behavior and full game startup remain separate integration work.
