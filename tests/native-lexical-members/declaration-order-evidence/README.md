Independent original declaration-order evidence
===============================================

The final evidence is `capture-e` and `capture-f`: the same complete 89-case `probe.DeclarationOrder` class and complete oracle, compiled twice with Apache Flex 4.16.1 for Flash Player 26 / SWF version 37 and executed in separate original Flash browser profiles. Each case constructs a fresh instance. Both captures retain `describeType(Class)` and `describeType(instance)` XML, exact source, SWF, commands, tool hashes, and original results. No compiler or engine implementation was changed.

Earlier captures a/b (50 cases) and c (71 cases) are retained exploration. Those earlier oracles reused an instance and therefore later rows also reflect earlier field mutations. They are not the final 89-row fixture. The previous lexical review and its frozen e9244 receipt remain unchanged.

Observed behavior, equally for private/protected/public members:

| Case | Original behavior |
| --- | --- |
| Read field or method before a later same-name wildcard local | Reads the member; the later declaration does not retroactively shadow that reference. |
| Wildcard local initializer refers to its own name | Reads the member; after initialization it reads the local. Method identity is preserved. |
| Wildcard local without initializer | Earlier reference reads the member; later reference is undefined. |
| Wildcard initializer throws and a wildcard catch handles it | Earlier reference reads the member; subsequent local read is undefined. |
| Runtime conditional containing the declaration | Earlier source reference reads the member. Later source reference reads the local: assigned value when branch executes, undefined otherwise. |
| Constant-false conditional containing the declaration | The later lookup remains the member. Method typeof and identity controls distinguish a function from an undefined value serialized as JSON null. |
| Constant-true conditional containing the declaration | Later reference reads the assigned local. |
| Same-name parameter and local redeclaration | Initial reference reads the parameter; redeclaration changes the local/parameter binding. |
| Same-name wildcard catch binding | Shadows inside catch and restores the previous member or local outside catch. |
| A differently named catch contains a wildcard var declaration | The new local is visible after catch; a preceding reference still reads the member. |
| Multiple variables in one declaration | Their initializer/name resolution follows declaration order. |

These observations do not establish an unrestricted AS3 scope algorithm. In particular, constant-false declarations and runtime-false declarations have different observed effects. Constant-branch elimination is a plausible explanation, but these receipts prove behavior rather than the internal compiler mechanism. A correction that handles only source offsets must either implement this distinction using authenticated semantics or reject affected complete sources.

A narrow guard must inspect complete method/constructor bodies and nested blocks, distinguish parameters and catch bindings from ordinary local declarations, and consider collisions with public as well as private/protected fields and methods. It should reject before publishing generated callable metadata or readiness. It should not silently omit methods or admit a source by substituting only supported method bodies. The captured full Class/instance XML and source hashes permit a complete-class regression when the relevant lowering is supported; unsupported prerequisites should remain explicit whole-source holds.

`receipt.json` authenticates final evidence and analysis. `verify-and-freeze.py` checks raw receipts, tool files, equal repeated rows and reflection trait sets, and focused expected boundary facts. JSON null in an array can represent undefined or a function; use the accompanying typeof/identity controls where present.
