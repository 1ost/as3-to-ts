# Unary object-literal values

Native source-object lowering lost the leading unary sign: `{negative:-10,positive:+"12"}` emitted positive ten and an unconverted string. The emitter now uses the existing effective expression boundaries, retaining unary operators and complete operands. The parser also skips comments following unary plus/minus, matching the other unary branches.

Two identical original AIR captures and the complete generated UnarySubject agree in ES5/ES2015, Node and CSP Chromium. The two observation rows cover negative values, numeric coercion, negative zero, parentheses, nested unary operators, binary operands, comments, nested literals and side-effect ordering. Generated sources and their dependencies typecheck without errors.

`emission-baseline.json` retains the original sign-loss output at d6c316a6. `baseline.log` retains the pre-fix comment parse failure. Adjacent fresh object-literal, accessor and delayed-parameter suites add 51 original observation rows across both targets and realms. The older object-literal suite uses its existing browser loader; only the main, accessor and delayed suites use CSP. This is focused compiler evidence, not full OP2 or production acceptance.

Reproduce from the compiler root with LAYA_ENGINE_REPOSITORY pointing to the pinned engine:

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-object-literal-unary/run.cjs
    node tests/native-object-literal-unary/retain.cjs <report.json>
    node tests/native-object-literal-unary/verify-runtime.cjs --check-current

The runtime pin records the unchanged engine and pre-fix compiler baseline. The report hashes the actual compiler inputs containing the fix. Original oracle artifact bytes are authenticated by verify.cjs.
