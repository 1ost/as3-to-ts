# Generated embedded binary Class fields

Run `npm run tsc`, then `node tests/native-generated-embedded-binary/run.cjs`.
Two complete unchanged AS3 Assets subjects come from the engine's original AIR
packets. The generated ES5 and ES2015 factories match all 25 embedded-byte rows
and nine initialization-order rows in Node and Chromium. The sources include
decoding the exact maintained OP2 collection XML through readUTFBytes/new XML.
Twenty-two compiler rejection guards, three loaded-domain identity/storage
checks, two executable mutations, strict types and browser errors are checked.

The new plan input `embeddedBinaryProviderModule` names the shared
AS3EmbeddedByteArrayDomain provider. A source record's `embeddedBinary` table maps
field names to `source`, canonical `symbol`, original `className`, asset
`sourceSha256`, original SWF `definitionSha256`, and dense byte `payload`. The
asset preparation caller supplies the symbol/name/SWF provenance from extraction.
The compiler verifies the field shape, intrinsic Class type, exact literal Embed
source/MIME metadata, payload hash and consistent repeated-symbol bindings. It
does not invent original Class names or derive symbol identity from byte hashes.

Each unique symbol payload appears once in the cohort declaration module. Its
getter resolves the defining domain's common symbol Class at the source static
initializer position. Private lexical reads and new Data() keep normal Class
authority and argument checking. The initialization fixture additionally exposed
private Boolean call initializers and deletion through an Object alias: deletion
must select lexical access before the public Object fallback. XML construction
now accepts the authenticated ByteArray readUTFBytes String result; unknown
Object calls remain rejected.

Mutations move the Embed initialization ahead of the earlier source initializer
and bypass symbol reuse. Both are executed and detected by original observations.
Additional domain checks prove native loading isolation; they are not extra AIR
captures. Retained report verification checks source, provider and compiler hashes.

Adjacent suites pass: private static constants (9 rows/15 guards), Object
conversion properties (17/6), XML construction (84/8), ByteArray methods (16/10),
and Object property writes (57/6), in both targets and both runtimes. The writes
suite's old delete-rejection assertion also failed with the prior deletion
emitter; it was removed because Object deletion is already qualified separately.

This qualifies the shared compiler/runtime path, not OP2 startup or production
asset preparation. CollectionConfig still needs its original extracted symbol
binding wired into the application's audit and native delivery configuration.
