# Typed RegExp provider

`regexp-provider.test.cjs` compiles unchanged `RegExpBridgeProbe.as`, launches the
generated v2 `startAS3Application`, and compares thirteen results in Node and
Chromium with two identical AIR 51 captures compiled for SWF 29. The fixture
exercises static regex constants, instance Vector references, captured groups,
Unicode callback offsets, null Function replacement, `arguments.length` and
`arguments[1]`, and a reverse replacement loop with captured locals.

The profile needs both `nativeRegExp` and String pattern target proof v2. SDK
constructor/accessor/AS3 namespace declarations are bound to the exact AIR SDK
and decompiled RegExp source. Target proof v2 verifies the shared constructor,
nominal predicate, replacement exports, and their transitive source closure.
Missing either side holds the source. The test also rejects a repinned forged
SDK declaration digest and an omitted target dependency. Existing v1 String
pattern profiles do not acquire typed RegExp authority.

`--native-regexp` in the fixture producer creates both proofs. AP's optional
`nativeRegExp: true` requires `nativeApiSignatures: shared-sdk` and
`stringPatternProvider: true`; all proof generator inputs participate in its
cache identity. Diagnostic snapshots do not change the release pair.

The compiler emits regex literals through the shared Laya AS3RegExp constructor,
registers that exact class/predicate in its runtime authority, and uses it for
typed slots and Vector element checks. Literal grammar is checked by the pinned
engine parser. String replacement with a Function uses an explicit invocation
adapter into the compiler's existing Function implementation, preserving bound
method/closure ownership instead of adding unrelated Laya function metadata.

Source lambdas reading their own numbered `arguments` slots or length admit
extra actual arguments. Their ordinary JavaScript arguments object supplies
these reads; writes, whole-array escape and arbitrary dynamic keys remain held.
Single-quoted source strings now preserve embedded double quotes; the native
replacement-loop fixture covers the generated HTML attributes.

This does not establish full RegExp grammar, dynamic construction, direct
RegExp member calls, public prototype dispatch, complete TextStyle admission,
or original ReleaseMain startup. Those remain separate qualification gates.
