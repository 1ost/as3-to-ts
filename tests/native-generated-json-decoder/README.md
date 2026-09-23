# Complete maintained JSON decoder

Run `npm run tsc`, then
`node tests/native-generated-json-decoder/run.cjs --combined`.

All five complete maintained source dependencies emit unchanged: JSONDecoder,
JSONTokenizer, JSONToken, JSONTokenType and JSONParseError. The runner authenticates
the engine's generated-json-library packet and compares its 23 decoding/tokenizer
observations on ES5/ES2015 in Node/Chromium with zero strict generated/dependency
type diagnostics and three corrupted comparison controls. The separate observer
instantiates the complete Decoder instead of the library's static JSONA facade.

Coverage includes scalar/nested data, escapes, comments, malformed input, token
types and exact parse-error locations/messages. Empty and truncated input retains
source TypeError 1009. Typed public fields/accessors on a different planned class
use common property dispatch even without a private-name collision; host null
errors must not escape. Existing acceptance of trailing input is preserved.

This does not qualify JSONEncoder, JSONA's static facade, reflected class encoding
or whole-application integration. JSONEncoder still requires typed enumeration
and XML/reflection source behavior. The retained packet supplies 11 encoder rows
for subsequent comparison.
