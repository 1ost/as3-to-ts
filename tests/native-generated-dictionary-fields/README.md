# Generated Dictionary instance fields

Run `node tests/native-generated-dictionary-fields/run.cjs --combined` against
the sibling LayaAir-op2 checkout. Its generated-dictionary-fields verifier
authenticates 47 matching AIR observations and both complete AS3 subjects.
The observer is separate from emitted source.

The fixture checks private, protected, public, unqualified and inherited fields,
object-key identity, canonical keys, collision keys, reads/writes/delete/in/calls,
consumed += and receiver replacement during key/RHS/argument evaluation. It also
checks an Object parameter shadowing the private field. All rows must match on
ES5/ES2015 in Node/Chromium with zero generated and provider type diagnostics.
Three corrupted comparisons and three unsupported compound/update expressions
must reject. The unchanged DictionaryBoundary/ELogger fixture is a regression.

Field types resolve through declaration identity and the declaring ancestor's
source spans. Indexed += uses common as3AddAssignProperty to read once, evaluate
the key once, evaluate the RHS and re-read the receiver for writing, as AIR does.
Static and arbitrary receiver graphs and full application routing remain open.
