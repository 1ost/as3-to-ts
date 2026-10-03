# Native bitmap filter typed returns

The generated callable-Class lowerer rejected BitmapFilter and ColorMatrixFilter return signatures. The opt-in nativeBitmapFilterReferenceModule now validates exact generated-plan bindings and matching imports for both names before admitting their typed returns. Missing opt-in, changed exports and mismatched imports remain rejected. Other native return families retain their guards.

Two identical original AIR captures supply 16 rows. Complete generated FilterSubject and the unchanged maintained ColorMatrixFilterProxy match in ES5/ES2015, Node and CSP Chromium, with zero generated/dependency type errors. Coverage includes base and concrete parameter/return identity, typed storage, clones, copy-out arrays, Blur/Glow subtype values, null, rejected assignment preservation and every maintained matrix factory (including negative coefficients). Five emission guards run per target. baseline.log retains the pre-fix native-return rejection at e9f50ed.

The paired engine provider registers closed allocation proofs; its own nativeBitmapFilterReference suite checks all six concrete filter families, forged/proxied values, no user hooks, and omitted registrations. This compiler packet records the exact compiler and engine inputs used. Adjacent fresh BitmapData-return and unary-object-literal suites add 36 rows across both targets and runtimes; the older BitmapData suite uses its existing browser loader, not CSP.

From the compiler root, set LAYA_ENGINE_REPOSITORY to the pinned filter-reference engine and run:

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-filter-references/run.cjs
    node tests/native-filter-references/retain.cjs <report.json>
    node tests/native-filter-references/verify-runtime.cjs --check-current

This does not qualify base BitmapFilter construction, generated subclasses, reflection, explicit filter casts/type tests, dynamic member dispatch, pixel rendering or whole-client readiness.
