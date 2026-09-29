# Optional shared String pattern provider

`profile-lock.files.stringPatternProvider` references canonical
`as3-string-pattern-provider-target@1` evidence produced by
`tools/reflection_provider_profile.py:produce_string_pattern_provider_profile`.
It binds the capability ledger, both real function signatures and their complete
source closure. The reflection provider retains its existing schema and uses the
same export/source verifier.

The adapter can route String.replace literals outside the legacy runtime grammar
to the proven Laya `AS3StringIntrinsics` parser and replacement operation. Both
receiver and replacement require a proven String type. The literal is checked
by the pinned engine parser in a bounded child process; its bundle accepts only
hash-checked source bytes from that verified closure. This avoids copying engine
regex grammar into the compiler. Unsupported patterns and forged/missing provider
evidence remain held. RegExp.test and callable/dynamic replacement are not widened.

The emitted direct provider call evaluates the receiver and replacement argument
before AIR's null-receiver error. No AP class is rewritten and no generated
application output is edited. This optional profile alone grants no application
start authority or release promotion.

Run with Node 24, a built compiler, the retained AIR SDK and FFDec:

```sh
HARDENED_FIXTURE_AIR_SDK=/absolute/path/to/AIRSDK \
HARDENED_FIXTURE_LAYA=/absolute/path/to/LayaAir \
HARDENED_FIXTURE_FFDEC=/absolute/path/to/ffdec.jar \
LAYA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
node --test tests/hardened-cli/string-pattern-provider.test.cjs
```

The test verifies the unchanged native source and 22 AIR rows through emitted
Node/Chromium execution, plus absent-provider and missing-dependency controls.
Fresh artifacts are retained under `.cache/shared-string-pattern-profile/run-*`.
