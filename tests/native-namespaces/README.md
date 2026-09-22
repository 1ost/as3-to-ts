# Bounded native namespace lowering

Run `npm run tsc`, `npm run test:native-namespaces`, and
`node tests/native-namespaces/InheritedNamespacesTests.js`.

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

The supported member scope is single writable fields (including own static
fields) and instance methods in proven ordinary classes. Explicit inheritance
is accepted only when the entire base chain resolves to unambiguous same-file
ordinary class declarations. URI/name identity is unchanged across that chain.
Each base must already precede its derived declaration in source order. A later
base fails explicitly pending class scheduling; static initializers are never
silently reordered.
The derived object retains native prototype inheritance and the existing shared
decorators bind inherited method closures to the actual instance.
Selectors may use `this`, the containing class, a local/parameter typed as a
same-file ordinary class, or an implicit receiver for a proven qualified member.
Instance fields and methods may be inherited through multiple local bases.
Static fields remain own-class-only; inheritance does not silently use JS's
inherited static property lookup. Known int/uint field assignments retain integer
coercion from the original declaring base, including a receiver variable typed
as a derived class. Parenthesized references preserve
the same destination coercion and mutation checks; comma expressions are not
treated as transparent references.

Unresolved/ambiguous namespaces, local namespace scopes, dynamic namespace
values, open-set implicit member inference, complex/unproven receivers, private
namespaces, namespace accessors/consts, static namespace method closures,
unresolved/imported base chains, inheritance cycles, dynamic classes, namespace
overrides/redeclarations, explicit `super` namespace selectors,
escaped/empty/implicit URIs, and E4X in namespace-bearing sources
fail explicitly. Namespace delete, increment/decrement, and method writes also
fail explicitly. These are future compiler work, not namespace aliases to public
members. Complete cross-file binding still requires source/provider analysis.

`InheritedNamespacesTests.js` executes the actual compiler-distributed
decorators with ES5 and ES2015 output: three native class levels, constructor
effects, inherited fields and methods, URI aliases, public/other-namespace
spelling collisions, int/uint assignments, detached closure identity and
receiver retention, base-typed versus derived-typed receivers, and per-instance
storage.
Uninitialized namespace slots now emit their AS3 source-type defaults: int/uint
zero, Number NaN, Boolean false, typed references (including Object/String)
null, and wildcard/untyped undefined. The executable fixture checks own,
inherited, and static slots, constructor reads, initialization expressions
after the default declarations, and actual own-property storage. Explicit
initializers remain untouched. This does not establish full AVM allocation
timing: in particular, forward field-initializer reads or a base constructor
observing not-yet-initialized derived slots need separate allocation lowering.
Nineteen explicit unsupported-source cases retain the boundary, including a
forward base declaration.
Expected behavior follows ordinary AS3 inheritance and explicit namespace
selection; this fixture does not claim a new actual Flash oracle run or a
cross-file/provider binding.

In particular, maintained OP2 ArrayCollection extends imported
`flash.utils.Proxy` and declares namespace overrides. It continues to reject
explicitly: neither the presence of its source nor this ordinary inheritance
extension establishes Proxy dispatch, its methods' provider bindings, or
ArrayCollection runtime readiness. A 12/13 maintained syntax-probe result must
not be relabeled 13/13 on this basis.

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

Explicit namespace receivers now propagate type context through the parsed
field/getter/call chain, including nested argument calls. No lookahead regex
over source text authorizes receiver types. Local and parameter declarations
are resolved from the enclosing lexical scopes; nested function declarations
cannot lend their local types to the caller, and wildcard shadows remain held.
The executable chain fixture checks the actual Symbol call and once-only getter,
method and argument evaluation for ES5 and ES2015. This is compiler regression
evidence, not a new Flash capture or full TLF runtime qualification.

The parser's comment handling is checked separately by
`node tests/native-expression-comments/run.cjs`: comments between a call and
the next dot retain the receiver, and comments inside nested arguments are
skipped as trivia. Each case runs in a child process with a timeout; malformed
argument lists must throw rather than stall. The executable chain fixture also
includes both comment positions.
