# Canonical TextField Vector elements

Run npm run tsc, then node tests/native-textfield-vectors/run.cjs --combined.
Engine evidence requires 62845da63 or a descendant. Both ES5/ES2015 generated
Consumer variants match all 40 original AIR observations in Chromium with Laya
initialized. This does not claim Node rendering support.

The compiler now admits nativeVector only for the exact existing MovieClip or
TextField provider. The runtime still requires canonical declaration identity.
Eight compiler rejection guards and four runtime identity controls pass, along
with three comparison controls. Generated code and its provider graph have zero
TypeScript diagnostics. Adjacent MovieClip vectors retain all 39 matching rows.

Coverage includes null defaults, fresh vectors, assignment/argument coercion,
TextField/subclass references, sibling Sprite/Shape rejection, null/undefined,
indexed read/write, fixed length, splice element identity and native/interface
ancestry. The maintained OP2 TokenTipEnhance creates a TextField Vector, pushes
three authored fields and reads them by index; its complete UI/controller and
account flow still need integration validation.

The pinned runtime report retains original/generated Consumer bytes, compiler
and provider hashes, browser observations and checker results. verify.cjs checks
the retained comparison. No engine runtime behavior was changed for this slice.
