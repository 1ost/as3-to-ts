# Complete maintained StringUtil differential check

Run node tests/op2-stringutil/run.cjs after npm run tsc. The full maintained source is authenticated against the retained AIR copy, emitted intact in the ordinary application consumer mode and checked against the real provider graph. A separate complete generated DynamicReplace class exercises the direct construction lowering.

All 36 AIR rows run on ES5/ES2015 in Node and Chromium; nine rejection guards retain match/replace call boundaries. The separate host observer mirrors the AIR observer, registering callbacks in a host source context and reading source error fields through the engine. Source methods and bodies are never changed.

This fixture does not qualify StringUtil generated Class traits, RegExp Class identity, all Unicode/restriction combinations, or application item flows. Those remain separate requirements.
