# Source Class predicates

Run `node tests/native-class-predicates/run.cjs`, with and without `--consumer`.
Two complete classes and one interface are retained in the authenticated engine
AIR packet. Twenty-three observations match on ES5/ES2015 in Node/Chromium, with
zero generated/provider type errors. Consumer mode leaves Reader as an ordinary
reference consumer while Subject and Contract retain their declared identities.

`nativeClassTypeOperationsModule` must match `importModules['compiler.AS3Class']`.
For an unshadowed builtin Class target in a declaration-reference plan, `is Class`
uses the common `as3AsClass` result and `as Class` preserves its matching value or
null. This replaces the legacy typeof-function check and erased cast. The left
expression is evaluated exactly once, including function calls and side effects.
The source Class/interface and canonical builtin tokens retain their identities;
ordinary functions and bound methods do not become Classes.

Four rejection cases cover missing/mismatched providers, namespace mode and a
shadowed Class target. Four separate host controls reject an unregistered native
class and verify that forged names/constructor properties grant no identity.
No new class authority is published by this lowering. Native engine Classes
still require their own established metadata. Dynamic construction through
Object values, Class storage and full UIComponent behavior remain separate work.
