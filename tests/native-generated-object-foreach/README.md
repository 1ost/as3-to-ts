# Generated Object for-each

Run `node tests/native-generated-object-foreach/run.cjs` (also `--combined`) after
`npm run tsc`. The complete captured subject is emitted and compared with fourteen
authenticated AIR rows on ES5/ES2015 in Node/Chromium, with zero type diagnostics.

Existing Object locals use the common enumeration cursor and Object assignment
coercion. Undefined values become null while object, array and function identity
is preserved without conversion hooks. Tests also cover sparse/scalar/empty
receivers, Dictionary values, stable receiver evaluation and break/continue.
Eight rejection guards require common providers and retain holds on int, Array,
parameter, inline, member and catch-shadow targets. Three comparison controls
reject missing, reordered or changed rows.

This language prerequisite does not qualify the complete JsonConfigProxy flow.
