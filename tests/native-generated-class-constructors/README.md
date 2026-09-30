# Generated Class constructor and storage boundaries

Intrinsic Class constructor parameters use the existing common Class coercion
provider. Admission requires an authenticated intrinsic reference and an explicit
Class helper module. Class-valued traits use the existing common property type
for field writes and accessor results; declared source types keep precedence.

All six unchanged AS3 declarations match 88 original AIR observations in ES5 and
ES2015 under initialized Laya/CSP Chromium. Coverage includes builtin/source/
interface Class identity, null/undefined, rejected ordinary functions and values,
private storage with typed getters, public storage, failed writes and parent
constructor forwarding. Five compiler guards reject absent/malformed provider
configuration, copied plans and non-null defaults. Nine host guards reject forged
functions, copied objects and proxies before body effects. Proxy rejection uses
the common explicit unsupported-native-Class error, not claimed Flash behavior.

Whole-application startup and complete Class reflection remain unqualified.

```powershell
node node_modules/typescript/bin/tsc
node tests/native-generated-class-constructors/run.cjs
node tests/native-generated-class-constructors/verify.cjs
node tests/native-generated-captured-class/run.cjs
```
