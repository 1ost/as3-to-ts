# Generated source JSON parse

Run run.cjs after npm run tsc. The complete AIR Parser source matches all 35
captured rows on ES5/ES2015 in Node/Chromium with strict generated/provider types.
Seven guards cover unsupported argument counts/types, provider paths and JSON
shadowing. Comparison negative controls detect missing, reordered or changed rows.

nativeJSONModule lowers direct unshadowed JSON.parse calls with source String
text and an optional source Function, literal callback or null. Text grammar,
source number rounding and branded SyntaxError 1132 use common AS3JSON. A source
Error catch sees the failure; reviver exceptions preserve identity. The observer
uses a host SyntaxError as a reviver exception to check that host values remain
untouched; it does not qualify source SyntaxError construction or Class binding.

JSON Class identity, dynamic call arity/coercion and complete reviver enumeration
order remain open. Broader input/signature forms are held rather than guessed.
