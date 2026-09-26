# Private Class trait projection

Run `npm run -s build` then `node tests/native-generated-private-traits/run.cjs`.
The shared authenticated five-file/24-row Flash fixture supplies all three
private class declarations. The existing trait projector now uses internal
class identities and exact source owners independently of reflected names.

Checks cover distinct same-named helpers, inherited fields, the child override,
static separation, private return tokens, emitted declaration references and
constant byte spans in complete files. Eight guards reject forged source/plan
access, missing base expressions, final inheritance, mismatched method signatures
and invalid overrides. Helpers never acquire a public QName or script publisher.

This verifies compile-time traits. Header runtime tests live in
`native-generated-private-declarations`; complete helper method/body emission,
script initialization and loading remain gated and require all 24 Flash rows.
