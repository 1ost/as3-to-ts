# Generated TextBlock references

The complete AIR Reader source exercises typed constructor/method parameters,
field stores, typed local/return identity, fresh zero- and nine-argument native
construction, and method-body nominal `is`/`as`. Nineteen observations from two
identical AIR 51.3.4 captures match both ES5 and ES2015 in Node and strict-CSP
Chromium, with zero strict TypeScript diagnostics. Eight compiler rejection
checks cover missing authorities, mismatched imports and shadowed/qualified or
initializer operands. Three host forgery/proxy controls protect allocation
identity. Applied `is` and `as` mutations change the expected observations.

Set `LAYA_ENGINE_REPOSITORY` to `../LayaAir-op2-generated-textblock-review`:

    npm run build
    node tests/native-generated-textblock-reference/run.cjs --combined
    node tests/native-generated-textblock-reference/verify.cjs --check-current

The retained runtime archive authenticates compiler, source captures, generated
output, runtime/type dependency inputs and observers. Adjacent generated content
(17 rows) and justifier (128 rows) tests passed at these same inputs on both
targets and runtimes. TextBlock public member dispatch and full layout remain
separate qualifications; this fixture grants no native subclass or H5 acceptance.
