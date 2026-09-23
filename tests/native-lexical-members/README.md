# Authenticated source lexical compiler slice

This opt-in compiler slice emits complete captured Object-root AS3 classes through the common AS3LexicalMembers provider. It requires nativeLexicalMembersModule together with nativeCallableClasses, nativeClassInitialization, and authenticated nativeCallableMetadata. Metadata retains source SHA and complete public reflection/trait validation; the compiler derives the complete private/protected table directly from those exact AS3 bytes. Arbitrary caller metadata is a trusted compiler-provider contract, not independent cryptographic proof of Flash origin.

Supported here: own private/protected variables, own fixed required wildcard-parameter methods with wildcard return, source implicit/this/Class lookup, dynamic current-scope string/QName lookup, private storage coercion, read/write/direct call/extracted MethodClosure, public/private isolation, static publication and initializer ordering, instance defaults and initialization before authored effects, local/parameter/catch shadowing. Lexical method native keys are compiler-private Symbols captured from an external compiler intrinsic; lexical storage uses only the common provider. Source public TypeScript interfaces omit private names. Every ordinary method in this mode checks exact source arity before body effects. No scalar parameter or return conversion is newly admitted.

The plan rejects unaccounted internal/custom namespaces, source inheritance/interfaces, all accessors, lexical const, reference fields outside the listed common builtins, typed local variables/constants, optional/rest/typed method parameters, typed/void method returns, anonymous/nested source functions, unqualified calls requiring a source caller context, membership/deletion and lexical property updates/compound writes. Constructor semantics continue to use the prior authenticated callable constructor implementation. These are scope holds, not claims that Flash rejects valid source. No unsupported source method is removed to obtain a whole-class pass.

LexicalUnit: 24 original runtime observations, including primitive-coercing private/protected writes, original RHS results, stable bound closures and receiver authority, formal arity, catch lifetime, dynamic private lookup and public QName isolation, per-instance Array fields.
LexicalOrder: 8 original runtime observations, including receiver/key/argument evaluation once and in order, argument effects before arity errors, private static initializer ordering, and reentrant/throwing valueOf writes.
Both entire unchanged source fixtures are independently compiled and captured twice. Runtime rows agree exactly; Flash reflection trait ordering varies for LexicalOrder. Full documents are retained verbatim; the repeat check compares semantic trait sets without asserting stable reflection ordering. The first exploratory LexicalRoot fixture has 26 rows, includes anonymous-function creation and is held as a complete source file. It is retained intact; neither its 26 rows nor partial source execution count as this slice's passed originals.

Run with Node, Python, engine build dependencies, and Chromium installed:

```powershell
$env:LAYA_ENGINE_REPOSITORY = '<LayaAir repository containing engine commit 9fd3c0ab0480e09907da5974c484a1db3875570e and node_modules>'
$env:PLAYWRIGHT_MODULE = '<installed playwright module>'
$env:PYTHON = '<physical Python executable>'
node node_modules/typescript/lib/tsc.js
npm run test:native-lexical-members
```

run.cjs authenticates all six retained source/SWF/capture receipts before execution. It archives the exact 9fd3 common source graph, bundles actual APIs (no substitute runtime), emits actual provider declarations, checks generated consumer declarations, and compares all rows in Node and Chromium for ES5 and ES2015 output. Reports include generated-source, original-receipt and provider-graph hashes. Node vm is only a JavaScript test realm; production executes no ABC. guards.cjs has 34 compiler boundary checks and four result-comparison negative controls. Full shared-engine, maintained-module and logged-in game completion are not claimed.

The tests preserve source/SWF/tool provenance under each evidence directory. Capture scripts and exact commands are retained there; rerunning an original requires the licensed/local Flash plugin, Flex SDK and hidden Electron harness described in the receipt. The native replay does not require Flash.
