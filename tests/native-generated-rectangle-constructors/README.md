# Rectangle constructor reference parameters

Run `npm run tsc`, then `node tests/native-generated-rectangle-constructors/run.cjs`.
`verify.cjs` authenticates the retained runtime receipt and original AIR captures.

Two complete source holders cover optional and required Rectangle parameters.
ES5 and ES2015 factories match 29 original AIR observations in Node and Chromium
with zero type/browser errors. Cases cover null/undefined, omitted/extra arguments,
instance identity, unrelated geometry types, structural impostors, prototypes,
primitives, constructor body entry order and absence of string conversion.

The new nativeRectangleReferenceModule option requires an authenticated plan and
an exact Rectangle provider/export/import binding. Seven compiler guards cover
missing reference/Rectangle providers, malformed paths, mismatched provider/import
paths, forged plans and non-null defaults. Two runtime guards reject forged
Rectangle instances before constructor bodies execute.

This uses the existing canonical Rectangle declaration and shared reference
coercion. It does not admit Rectangle native subclass construction or publish
complete Class metadata. Maintained OP2 BitmapDataStore uses this parameter type;
its full behavior and game startup remain separate integration work.
