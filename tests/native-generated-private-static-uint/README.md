# Private static uint initialization and update expressions

The source compiler now publishes finite numeric literal private static uint
slots with AIR's unsigned conversion before cinit. Failed Class initializations
allocate fresh converted storage. Prefix/postfix updates use the owning Class
also from instance methods; the expression result remains an unwrapped Number
while storage wraps to uint. Other static numeric update kinds remain rejected.

    $env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-xml-traversal-review'
    node tests/native-generated-private-static-uint/run.cjs
    node tests/native-generated-private-static-uint/verify-runtime.cjs --check-current

Two identical AIR captures provide 22 observations: zero/nonzero/max/hexadecimal,
negative/fractional/wrapping/scientific/-0 literals, read-before-declaration,
prefix/postfix overflow, state mutation, three Class attempts, Class/domain
isolation and instance-to-static access. Complete generated code matches in
Node/CSP Chromium on ES5/ES2015, zero types. Fourteen guards retain lifecycle
requirements, unqualified literal forms and other static update types. An applied
numeric corruption fails both realms; the existing retry-identity mutation fails
Node (browser mutation coverage is not claimed for that control).

baseline.cjs replays the same fixture through unchanged compiler 883a716 and
reproduces the private primitive initializer hold. Current shared dispatcher
retry regression matches 19 AIR rows; instance lexical numeric updates match 22.
The older private-static-primitives suite contains a stale rejection expectation
for Boolean(1), failing under both old and new compilers; no pass is claimed.
Its uint literal rejection is replaced by an unqualified expression guard, since
this fixture now supplies positive literal evidence. No engine change or font work.

Maintained RadioButtonGroup emission and real H5 game acceptance must be checked
separately; this fixture does not prove either.
