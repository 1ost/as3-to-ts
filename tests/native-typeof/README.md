# Source typeof through the common runtime

After building the compiler, run:

```powershell
node tests/native-typeof/run.cjs
```

The runner needs Python 3, Playwright Chromium, compiler dependencies, and the
sibling LayaAir checkout's TypeScript 4.9/esbuild dependencies. `PYTHON`,
`PLAYWRIGHT_MODULE`, `LAYAAIR_CHECKOUT`, and `COMPILER_CHECKOUT` can override
locations. It archives engine commit
`3d7c64062e899c8aaf4abd141da5c0d4c01f2a4d`; engine working changes never enter
the default test. Outputs are unique under `.cache/native-typeof`.

Thirty-two original Flash rows are compared exactly in Node and Chromium on
both ES5 and ES2015 source targets, using both the default metadata provider
module and a separately named `CommonProvider` import. These configurations
reuse the same original rows and do not multiply the evidence count.

Thirty additional original Flash rows under `original/binding` cover all nine
builtin Class operands, nine local shadows, distinct int/uint/Number and
Class/Function identities, same-package and explicit/wildcard-import classes,
parenthesized and conditional operands, member names, undefined shadowing, and
catch bindings. The same four configurations compare those rows and check the
actual common declarations, making 62 distinct observations and eight surfaces.
The explicit foreign-package import is supplied its unchanged generated source
and helper modules at the emitted relative path for declaration checking.

Binding is resolved against source lexical scope and exact package/import
identities, never all classes' short names. Original source spelling is recovered
before the parser's legacy int/uint-to-Number rewrite can lose identity. In
typeof operands, builtin Class/int/uint values import AS3ClassType/AS3Int/AS3Uint
and use the existing common as3AsClass API to expose their source Class value
type. Authored local shadows retain their spelling. Other builtin constructors
are the same realm's canonical values already recognized by the common engine.
This admission does not extend standalone Class/int/uint value lowering outside
typeof operands, import aliases, qualified Class syntax, or broader global APIs.

Ten additional guards cover exact import visibility, unresolved conditional
branches, common builtin imports, compiler helper-name collisions, and the
reviewed unimported lowercase `foreign.hidden` failure. The retained original
Flex rejection and builtin acceptance in `original/binding-errors` are hashed.

The original class includes typeof expressions for source Class, Function,
primitive and object values, static/instance getters, function calls, comma
expressions, and lexical Class/undefined shadows. Comparisons verify one operand
evaluation, receiver-before-getter order, two distinct getter receivers, thrown
value identity, missing dynamic properties, sealed/null/undefined errors
1069/1009/1010, and readonly assignment error1074. Its unchanged `suppliedType`
method additionally receives actual common XML/XMLList instances and evaluates
their source typeof expressions. Test setup uses the common providers' native
construction APIs; it does not claim emitted XML construction or E4X readiness.

The public getter prerequisite is deliberately restricted to readonly public
getters returning `*`, with no parameters. Reflection access mode, complete
member surface, exact source bytes, and storage types are checked. Typed getter
return coercion, setters, inheritance, and custom/nonpublic namespaces remain
unsupported. Descriptor dispatch uses the existing common property provider.

## Source and metadata authority

The reviewed `evidence-index.json` pins receipts. Receipts bind exact source,
SWF, original observations/reflection XML, capture scripts, commands and
provenance. Original provenance hashes are cross-checked. Before compilation,
Python's standard XML parser reconstructs ordered metadata, and the runner
compares the complete payload and source hashes. Compiler source-surface
validation alone is not reflection authentication. The trust root is the
reviewed committed index and receipts, not an editable runtime assertion or a
source hash alone. Historical absolute paths are provenance labels; execution
reads retained relative files. SDK/player binaries and browser profiles are not
included. Original SWFs are evidence only, never production execution.

The first receiver-order fixture declared its journal as `Array`. Its complete
original capture, metadata and identical thirty-two Flash rows remain in
`original/array-typed-journal`. Shared typed-reference lowering now allows that
original class to initialize. The runner executes it and compares all thirty-two
retained rows in Node on both source targets, in addition to the eight existing
Node/Chromium surfaces. These supplemental results are recorded as `arrayJournal`;
they no longer assert the historical initialization failure.

`original/unresolved` retains the actual strict Flex compiler rejection of
`typeof absentName` before SWF generation. The source validator checks original
AS3 lexical bindings before legacy emission can turn a bare unknown identifier
into `this.absentName`. Unknown operands remain compile-time errors; they are
not silently treated as JavaScript undefined. Dynamic missing properties are a
different operation and retain their original runtime result.

Thirteen separate guards exercise unresolved operand shapes, getter metadata
fabrication, typed-getter/setter boundaries, original diagnostic authentication,
and metadata mode isolation. Non-metadata compiler behavior remains unchanged:
it does not gain common typeof lowering or new readiness claims. The previous
wildcard-catch compiler corpus remains a regression test for that legacy mode.

Four strict TypeScript 4.9 surfaces use declarations emitted from the actual
archived engine source, with canonical engine options, `strictNullChecks:false`,
`skipLibCheck:true`, and ES2020/DOM/Node library declarations. Source output
targets stay ES5/ES2015. No declarations or generated sources are adapted to
make the checks pass. This does not prove old-browser support or a game module.
