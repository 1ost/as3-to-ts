# Generated source String terminal-anchor calls

Run after `npm run build` with the shared Laya checkout and Playwright available:

```sh
LAYA_ENGINE_REPOSITORY=/absolute/path/to/LayaAir \
LAYA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
node --require ./scripts/upstream-test-runtime.cjs tests/native-generated-string-pattern-end-anchor/run.cjs
```

The runner emits the unchanged `StringPatternLiteralProbe.as` captured by AIR
under Laya's `tests/nativeFlashOracle/string-pattern-literal-emission`. It verifies
the shared `compileSourceStringPattern`, `sourceStringReplace` and
`sourceStringMatch` calls in the generated source, typechecks that source and its
provider dependencies, and compares 20 observations in ES5/ES2015 on Node and
Chromium. Three comparison controls reject truncated, reordered or changed
observations. Provider graph, source/output hashes and results are retained in
the fresh `.cache/native-generated-string-pattern-end-anchor/run-*` directory.

This uses the incoming native emitter and Laya pattern provider. It does not
qualify the hardened application-profile lane, admit original AP classes, or
establish client startup.
