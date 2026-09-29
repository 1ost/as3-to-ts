# Canonical SimpleButton Vector elements

Run npm run tsc, then node tests/native-simplebutton-vectors/run.cjs --combined.
Requires engine 06f8f55ce or a descendant. The unchanged captured Consumer emits
as ES5 and ES2015 and matches all 40 original AIR observations in Chromium with
Laya initialized. Generated and provider sources have zero type diagnostics.

The exact SimpleButton provider may publish native Vector elements. Generated
SimpleButton return coercion requires the explicit matching reference module.
Ten compiler rejection checks cover missing/incorrect bindings, unqualified
Vector publication, forged plans, shadowed names, dynamic lengths and nested
Vectors. Four native identity guards reject forged constructors, incorrect
qualified names, prototype-only objects and proxies without invoking host traps.
Three comparison controls reject altered original results.

Coverage includes null defaults, fresh vectors, assignment/argument coercion,
SimpleButton and native subclass references, sibling Sprite/Shape rejection,
null/undefined, indexed read/write, fixed length, splice identity and ancestry.
This does not admit generated SimpleButton construction, source subclasses,
native member projection, reflection or complete OP2 List/DynamicList behavior.
The native subclass in the driver only exercises nominal element identity.

The retained runtime report includes original/generated Consumer bytes, compiler
and provider hashes, observations and checker results. Run verify.cjs to check
the retained comparison. Runner/observer hashes normalize line endings.
Adjacent fresh TextField (40 rows) and combined MovieClip construction/Vector
(39 rows) comparisons passed in both targets; authored button projection passed
22 checks. Their existing retained reports keep their original pins.
