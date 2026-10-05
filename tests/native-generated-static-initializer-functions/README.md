# Anonymous functions in static field initializers

Select the source Class script explicitly and lower its initializer callbacks with
the existing common Function registration, signature/coercion, lexical capability
and script-global providers. The original ListElement Roman digit field is tested
verbatim. Local declarations, nested closures/try, parameter writes, receiver
property access, numeric parameters and non-return own-Class expressions stay held.

AIR compiles the own-Class direct return in the fixture callback as `this`.
The emitter preserves that observed receiver behavior only in initializer callbacks;
method lambdas retain their existing lowering. The source/binary discrepancy and
JPEXS provenance are in the engine fixture, not an application source workaround.

`npm run tsc` then `node tests/native-generated-static-initializer-functions/run.cjs`
checks 14 AIR rows on ES5/ES2015 in Node and strict-CSP Chromium, with zero type
errors, seven guards and two applied mutations (captured Class instead of receiver,
and removed String argument conversion). Adjacent Vector constant retry (17 rows),
class-body retry (13 rows), and anonymous parameters (19 rows) pass both targets
and realms. The last harness was evaluated with only its historical engine pin
assertion removed in memory, against the current engine; the tracked harness and
historical evidence remain intact. The retained packet includes this distinction.

`node tests/native-generated-static-initializer-functions/verify.cjs --check-current`
verifies the retained input hashes and all four reports. No runtime engine change,
production promotion or complete H5 acceptance is claimed.
