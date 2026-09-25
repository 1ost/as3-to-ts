# Class local enumeration through the production factory

Run npm run tsc, then node tests/native-generated-class-enumeration/run.cjs
(optionally --internal to publish lexical capabilities). Three complete captured
AS3 subjects run through the production factory on ES5/ES2015 in Node/Chromium
under CSP without eval. Nine AIR rows match with zero TypeScript errors, three
rejection guards, six domain checks, two forged-iterator checks and one applied
mutation removing Class storage coercion. Inputs and outputs are hashed in the
ignored report. The initial compiler rejects the same source at enumeration
storage validation. Merely admitting Class storage still skipped Vector growth;
routing through the shared value enumerator fixes that semantic mismatch.

Each value is obtained before its Class storage conversion. Conversion failure
preserves the old local and prevents the next body invocation; break does not
read a subsequent bad element. Vector growth/shrink is observed live. Const,
Function and Class-parameter enumeration targets remain held. This qualification
covers simple predeclared local targets, not for-in Class key targets.

Existing Object/String/wildcard for-each regressions pass 14/14/18 AIR rows on
both targets/runtimes with zero types. The wildcard runner had a stale rejection
of String targets, already qualified by the String suite; it now checks the still
unsupported Function target instead. No AIR observation was removed.
ResourceParserManager and the full parser/loader path require application checks.
