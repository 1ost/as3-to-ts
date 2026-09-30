# Boolean local logical assignment

Complete generated EventDispatcher-derived Classes preserve Boolean-local ||= and &&= through a compiler-only intermediate marker and the existing source-storage pass. This is restricted to own, declared Boolean locals; other typed logical targets remain held. No OP2-local or engine shim is introduced.

Two identical AIR WIN 51,3,4,2 captures retain 34 observations. Unlike ordinary assignment, these logical assignments retain and return the raw selected RHS even when the local is declared Boolean. The original compiled probe confirms setlocal without convert_b, while ordinary assignment converts. Short-circuiting preserves the old raw value. typeof a simple declared Boolean local is folded to boolean in Flash bytecode; typeof the wildcard result observes the raw value. Only that proven, non-effectful local read is folded here.

The source runs unchanged in generated ES5 and ES2015 Class factories, Node and Chromium under CSP script-src self, with zero generated/provider type errors. Cases include a derived constructor, eleven RHS kinds, both skip paths, thrown RHS values, writes during RHS evaluation, nested operations, and HeroManager's loop pattern. The observer applies JSON serialization just as the AIR capture does (undefined/NaN array entries become null); explicit typeof result rows distinguish them.

Five guards retain numeric/reference/Function exclusions and parameter/catch-shadow declaration boundaries. Two applied bundle controls force Boolean coercion or eagerly evaluate the RHS; complete traces differ in both realms and both targets. The 12-row Array enumeration regression also passes at these compiler sources.

Set LAYA_ENGINE_REPOSITORY to ../LayaAir-op2-literal-replace-review (d17b928f57bdf79f2825295409682662e789ae20), then run:

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-generated-boolean-logical/run.cjs
    node tests/native-generated-boolean-logical/verify-runtime.cjs --check-current

The probe-pcode packet authenticates FFDec output from evidence/oracle.swf. It is binary evidence, not production code. Full HeroManager emission and actual H5 startup/account behavior require separate validation.
