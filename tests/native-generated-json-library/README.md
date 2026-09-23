# Complete maintained JSON library through JSONA

Run `node tests/native-generated-json-library/run.cjs --combined`.
All seven unchanged maintained JSON sources plus the complete authored Reader
are authenticated by the engine's generated-json-library oracle and emitted
together. The observer calls generated JSONA.decode/encode, all Reader methods
and JSONTokenizer; it supplies inputs and records results without implementing
any tested method body.

All 39 retained AIR observations compare on ES5/ES2015 in Node/Chromium: five
receiver cases, 23 decoder/tokenizer cases and 11 encoder cases. This covers the
JSONA static facade, scalar/array/plain-Object encoding, escaping, malformed input,
exact parse errors and retained trailing-input behavior. Generated and provider
types pass the existing strict fixture configuration (strictNullChecks disabled).
Three corrupted comparisons verify row count, order and value checks.

The initial complete run failed at plain-Object describeType authority. The common
engine now provides complete captured Object reflection through its private
factory identity. Arbitrary declared-class encoding remains dependent on that
class's own complete reflection authority. No host JSON implementation, partial
reflection record or trimmed source is used. The separate OP2 actual-worker
fixture is test_bulk_generated_json_library.mjs. Application integration remains
outside this fixture's claims.
