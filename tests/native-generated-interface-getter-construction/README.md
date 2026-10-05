# Construction through an interface Class getter

The original TextFlow constructor uses new this._configuration.flowComposerClass(),
where _configuration is IConfiguration and its getter returns Class. The compiler
previously rejected that expression despite qualified interface reads and Class
construction being available separately.

The lowering preserves AIR constructprop order: evaluate/capture the receiver,
evaluate arguments, invoke the getter once, then construct its returned Class.
Arguments can replace the selected Class; getter access on null happens after
arguments, while a throwing receiver precedes them. The common property and Class
providers retain type conversion, constructor arity, inheritance and caller-global
allocation context. Only a resolved intrinsic Class getter contract is admitted;
Object/Function results, shadowed Class declarations, missing/disagreeing providers,
namespace methods and other construction paths retain their separate boundaries.

All 33 repeated AIR observations match ES5/ES2015 in Node and strict-CSP Chromium,
with zero type errors, eight compiler guards, three forged-host-value rejections
and three mutations per target. Mutations move the getter before arguments,
duplicate its invocation, and discard constructor arguments; both runtimes detect
each. Adjacent chained interface getters (13 rows) and calls (18 rows) also pass.

Run with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE configured:

```
npm run tsc
node tests/native-generated-interface-getter-construction/run.cjs
node tests/native-generated-interface-getter-construction/verify.cjs --check-current
```

runtime.json.gz retains the pre-fix rejection, exact source/oracle/compiler/runtime
inputs, generated outputs, bundles and all three reports. This proves the focused
language behavior, not original TextFlow or complete OP2 factory/runtime/H5 acceptance.
