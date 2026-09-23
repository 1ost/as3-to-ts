# Explicit source Array allocation

Use the public emit API with `nativeArrayCreationModule` pointing to the reviewed common engine's `AS3ArrayCreation` export. The option requires the existing exact `nativeCallableClasses` source map, lazy `nativeClassInitialization`, the common method-binding module required by callable classes, and module emission (`useNamespaces: false`). Numeric constructor parameters still require the existing coercion binding. Metadata remains optional; when supplied, its existing authenticated-source/trait validation still applies.

Only genuine source Array literal AST nodes call `as3CreateArrayLiteral`. Elisions already lower to own `void 0` slots. Nested literals, field initializers, return values, and arguments are visited normally. The Vector element-list transport is excluded; nested real Array expressions inside it are included. The exact compiler-created factory import joins `nativeSourceHelpers`; authored imports do not grant that exemption. Alias selection avoids every occurrence in source. No later generated argument array is marked as a source allocation.

Omitting the option retains previous emission and is **not** proof of source allocation support. Invalid supplied bindings and incompatible mode combinations reject. A missing factory export fails actual declaration checking. The compiler trusts the caller's explicitly bound common module; callers must authenticate its pinned provider and source graph. Custom visitors that replace source nodes remain outside this evidence.

Run from the compiler checkout after building:

```powershell
$env:LAYAAIR_CHECKOUT = 'path/to/LayaAir-op2'
$env:PLAYWRIGHT_MODULE = 'path/to/playwright'
$env:PYTHON = 'path/to/python'
node tests/native-array-allocation/run.cjs
node tests/native-array-allocation/metadata.cjs
```

Both runners archive immutable engine `69789c4fa64dec426cf86a0ecd4cccfedf79be6c`; they never copy its writable source. The first authenticates the existing 26 original literal cases plus 10 fresh originals for instance/static fields, return literals, identity, order, a throwing element, and helper-name shadowing. It checks Node and Chrome after actual TypeScript 2.5.2 ES5/ES2015 lowering, in opt-in and unchanged modes (8 combinations). Every exposed source array is checked for private creation facts in the native mode: 30 arrays in the 26-row fixture and 15 in the 10-row fixture. Legacy mode has none. Runtime test observation uses the internal creation observer; generated application declaration checks use only public factory exports. Public declarations are generated from actual common source with internal declarations stripped; no adapted provider declarations are supplied.

The first runner includes 14 option/syntax/helper-boundary guards, four missing-export declaration checks across enabled runs, and two negative controls. It does not execute Vector runtime behavior. The second authenticates the existing 32 original typeof/metadata cases, runs both targets and two module bindings in Node/Chrome, and checks actual engine-generated declarations. Its test-only observer forwards the original factories/dispatch unchanged; per run it checks 3 literal transports have own slots and no creation identity, plus 9 invocation transports have no creation identity. Returned literal values have common creation identity.

To recapture the 10 fresh originals, set `OP2_FLASH_PLUGIN`, optionally `OP2_FLEX_HOME` and `OP2_ORACLE_ELECTRON`, then run `python tests/native-array-allocation/capture.py NEW_OUTPUT_DIRECTORY`. The portable evidence retains successful original source, SWF, raw rows, commands, capture scripts and four tool hashes. Browser profiles are excluded from delivery.

This is an allocation prerequisite only. No source Array call/new binding, dynamic Class allocation admission, rest/arguments ownership, Vector runtime support, unknown-host-array adoption, storage/capacity/mutation routing, enumeration admission, or splice support is introduced. The common Array factory alone does not establish those capabilities. The general compiler CLI does not expose native callable configuration; the toolkit `probe_transpiler.mjs` still invokes legacy emitter options. A later authenticated toolkit integration must explicitly supply this binding with its other native prerequisites. No CLI/toolkit/pin changes are included.
