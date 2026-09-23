# XML children, literal attributes and integer conversion

Run `npm run tsc`, then `node tests/native-generated-xml-children/run.cjs --combined`.
The complete authored ChildrenReader comes from the common engine's authenticated
24-row AIR packet. All 23 qualified rows match in Node/Chromium on generated
ES5/ES2015 with zero source/dependency type diagnostics. The remaining captured
XMLList deletion row is explicitly held, not silently treated as passing.

Exact XML local/parameter receivers admit zero-argument children() in for-each
using an existing XML local, and attribute() with one unqualified literal name.
The common engine preserves mixed child kinds, order and identity. Nested loops,
break/continue, empty loops retaining the old target, null errors, name errors on
text/comments, scalar attribute conversion and missing attributes are covered.
Explicit generated builtin int calls now use common AS3 conversion instead of
host Number, preserving invalid-text zero, fraction truncation and 32-bit wrap.
Source spelling and builtin binding are checked before choosing that lowering.

Eleven compiler guards retain absent provider/coercion options, invalid arities,
computed/qualified attribute names, non-XML loop targets and escaped child lists.
Three altered-comparison controls pass. General XML construction/settings, source
mutation, namespaces/filters, other numeric builtin calls and the complete game
remain outside this qualification. Untyped method calls retain ordinary dynamic
member dispatch; they do not gain typed XML lowering based on a method's name.
