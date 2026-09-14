# Bounded native namespace lowering

Run `npm run tsc` and `npm run test:native-namespaces`.

The ordinary `emit(ast, source, options)` API accepts `namespaceUris`, an exact
map from imported AS3 namespace qualified names to their literal source URIs:

```js
{ namespaceUris: {
  "flashx.textLayout.tlf_internal": "http://ns.adobe.com/textLayout/internal/2008"
} }
```

This map is namespace source authority, not the similarly named
`definitionsByNamespace` package/import index or `useNamespaces` TS package
wrapping option. Callers must derive and pin it from source/dependency evidence.
An in-file declaration must agree with its configured URI.

The parser retains namespace declarations and selectors as distinct nodes.
Supported package declarations use a nonempty, unescaped literal URI or a
resolvable alias. Native symbols canonicalize URI identity; separate computed
member keys canonicalize `(URI, member name)`. Qualified fields and instance
methods remain separate from public properties with the same spelling. Method
closures use the existing shared compiler decorators, including Symbol keys.

The initial supported member scope is classes without explicit inheritance,
single writable fields (including static fields), and instance methods.
Selectors may use `this`, the containing class, a local/parameter typed as a
same-file ordinary class, or an implicit receiver for a declared own qualified
member. Known int/uint field assignments retain integer coercion, including a
receiver variable typed as a same-file class. Parenthesized references preserve
the same destination coercion and mutation checks; comma expressions are not
treated as transparent references.

Unresolved/ambiguous namespaces, local namespace scopes, dynamic namespace
values, open-set implicit member inference, complex/unproven receivers, private
namespaces, namespace accessors/consts, static namespace method closures,
inheritance, escaped/empty/implicit URIs, and E4X in namespace-bearing sources
fail explicitly. Namespace delete, increment/decrement, and method writes also
fail explicitly. These are future compiler work, not namespace aliases to public
members. Complete cross-file binding still requires source/provider analysis.

The TLF-shaped executable fixture covers ImportExportConfiguration's three
fields and six selectors in isolation. Both ES5 and ES2015 targets execute the
actual compiler decorators. The separate full-source integration command below
also runs both recovered constructors without source substitutions:

```powershell
node tests/native-constructors/RecoveredTlfIntegration.js <OP2-checkout> <LayaAir-checkout>
```

That command verifies recovery hashes, emits the entire recovered
ImportExportConfiguration and FlowElementInfo plus the maintained namespace,
and uses the actual Laya reflection provider. It needs the caller's recovery
files and the engine's TypeScript installation; it writes no application files.
Passing it is isolated compiler/provider evidence, not whole-TLF/game admission.
Other tests cover URI aliases across independently emitted modules, public-name
collisions, qualified reads/writes/calls, static field identity, detached method
receivers, per-instance storage, typed writes, and explicit failures.
