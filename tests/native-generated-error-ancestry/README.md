# Generated Error ancestry

Run `npm run tsc`, then
`node tests/native-generated-error-ancestry/run.cjs --combined`.

The runner authenticates the engine's `generated-error-ancestry` AIR packet and
transpiles all three complete subjects: the unchanged maintained JSONParseError,
its authored Child subclass, and the authored Entry constructor probe. The
JavaScript driver is only an observer. It compares 23 behavior observations on
ES5 and ES2015 in Node and Chromium, with strict generated/dependency type checks,
nine rejected provider/constructor/trait cases and three comparison controls.

The opt-in Error provider uses the common native constructor entry, source
prototype and inherited traits. Coverage includes pre-super defaults, wildcard
message identity, ID conversion order, prototype-name snapshots, sealed writes,
readonly errorID, deletion, enumeration, ancestry, thrown identity and String
rendering. Event-specific coercion remains separately qualified.

The packet's three full describeType XML observations are retained but are not
compared by this compiler fixture. Full generated reflection, subclass-specific
typed catches, Error Class static calls and stack traces remain unqualified.
This fixture does not establish full JSON-library or application readiness.

Validated with engine `e95b4c4b6`: ancestry run-XjC4ku (23 rows, nine guards),
Event run-yC95gS (12 rows, 12 guards), Event returns run-7lUbhG (24 rows),
and source errors run-Endjxe (52 rows, 13 guards).
