# Foreign public methods with lexical name collisions

Run `npm run tsc`, then
`node tests/native-generated-foreign-methods/run.cjs --combined`.

Both complete source subjects come from the common engine's authenticated
`generated-foreign-methods` AIR packet. Nine rows compare foreign calls through a
typed private field and parameter, same-named private methods, stable extracted
method closures, null-receiver TypeError 1009 and evaluation order. The receiver
is captured before arguments; argument effects occur before null dispatch errors,
and replacing the field during argument evaluation preserves the captured receiver.

All rows run on generated ES5/ES2015 in Node/Chromium with zero generated and
dependency type diagnostics. Six compiler guards retain unknown/Object receiver,
method write/delete/update and foreign private-method holds. Three controls reject
altered comparisons. Public method traits must come from a different authenticated
source class with an exactly resolved receiver type. Dispatch uses the common
property provider; callable fields/accessors and arbitrary chained receivers remain
held. This is language evidence, not complete SoundManager/game qualification.
