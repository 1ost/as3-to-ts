# Generated Sprite position overrides

Run `node tests/native-generated-sprite-position/run.mjs` from this repository.
The runner builds the current compiler source and emits five complete original
AS3 classes through the native source-class factory. It type-checks generated
modules and compares both ES5 and ES2015 in Chromium against 21 original Flash
observations retained in the sibling engine. Renderer setup comes from the OP2
test infrastructure; application implementations are not test subjects/providers.

The comparison covers offsets, native direct-super reads/writes, generated
Sprite/Object dispatch, Number conversion, detached methods, constructor virtual
dispatch, inherited getter/setter halves through two descendants, direct native
partial overrides, reflected ownership and nominal identity. Five receiver/API
checks, four rejected compiler inputs and seven rejected factory mutations keep
unqualified overrides and malformed/missing contracts from being admitted.

Number position overrides use explicit canonical native accessor authority.
Ordinary source Boolean accessors retain their existing protocol. Unsupported
native names and signatures remain held; this is not complete Flash or game
qualification. Complete maintained AnimateLoader must still be replayed.

`verify.cjs` authenticates the retained final reports and original Flash packet.
Fresh runs also hash compiler source/output, type-check inputs, generated files
and bundled browser dependencies to detect changes during validation.
