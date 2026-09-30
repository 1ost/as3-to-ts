# Generated Vector constructor references

Constructor parameter lowering selects the authenticated Vector specialization
by source owner and exact type span, then uses the existing common property
coercion helper. It preserves supplied identity, omitted/null defaults, arity
checks and coercion before constructor body effects. No element conversion or
copying is introduced.

Seven unchanged AS3 classes cover String, int, Object and source-class Vectors,
including source parent constructor forwarding. All 101 original AIR rows match
ES5 and ES2015 in CSP Chromium with real Laya initialization. Six compiler guards
reject copied plans, absent Vector providers and non-null optional defaults.
Fifteen runtime guards reject prototypes, proxies and copied Vector objects.

This does not qualify nested Vector types, general Vector reflection, optional
Vector method parameters or full application startup.

```powershell
node node_modules/typescript/bin/tsc
node tests/native-generated-vector-constructors/run.cjs
node tests/native-generated-vector-constructors/verify.cjs
node tests/native-generated-vector-boundaries/run.cjs --combined
```
