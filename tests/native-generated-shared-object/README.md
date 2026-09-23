# Generated local SharedObject prerequisite

Run npm run tsc, then node tests/native-generated-shared-object/run.cjs from the
compiler. It authenticates the shared-object-local packet in LayaAir-op2 and
emits the complete captured LocalSettings class without changing its AS3 source.
The observer uses the generated Class for settings write/read and reference
returns; common engine providers handle storage and nominal identity.

All 28 AIR rows pass on ES5/ES2015 in Node/Chromium with strict subject/provider
type checking. Four compiler guards reject an absent provider binding, bare
typed returns, typed fallthrough and unqualified SharedObject type operators.
Three runtime controls reject forged/proxy return values and three comparison
controls reject altered AIR rows.

SharedObject returns use the explicit native declaration binding and common
reference coercion. Typed native locals already use that mechanism once bound.
This does not qualify full Class reflection, native ancestry, SharedObject field
traits, generated type operators, remote objects, general serialization or the
complete ClientProperties/Game dependency graph. Source parameter/return values
in this packet cover the settings surface; broader signatures need evidence.
