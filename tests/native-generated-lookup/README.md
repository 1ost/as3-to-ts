# Native package definition lookup

Run `node tests/native-generated-lookup/run.cjs`, with and without `--consumer`.
Four complete captured classes match eighteen AIR observations on ES5/ES2015 in
Node/Chromium. Consumer mode emits LookupReader and WildcardReader as ordinary
reference consumers; the shadowing inheritance pair retains generated authority.
The actual provider and generated files have zero type diagnostics.

An exact `importModules['flash.utils.getDefinitionByName']` binding now owns
explicit and resolved wildcard package-function calls. Alias selection avoids
source collisions. Parameters, own/inherited methods and other imports retain
their source binding; the legacy remap remains only for unconfigured emission.

The fixture covers returned registered identity, String/wildcard names, nullish
and missing names, source Error catches, conversion order and fallback calls.
The host registers two fixture values and a String-returning callback solely to
drive those observations. It does not grant source Class construction authority.

`guards.cjs` checks eight rejection cases and seven shadow/alias/legacy controls.
Extracted/mutated function values, construction of the lookup function itself,
unbound names, unsupported qualified package-value syntax and namespace emission
remain explicit holds. Qualified access through an actual source `flash` value
is left to normal member resolution. This is not full UIComponent qualification.
