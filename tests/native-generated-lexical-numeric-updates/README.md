# Private numeric updates

Run `npm run tsc`, then
`node tests/native-generated-lexical-numeric-updates/run.cjs --combined`.

The complete authored Counter from the engine's authenticated AIR packet emits
unchanged and matches 22 observations on ES5/ES2015 in Node/Chromium with strict
generated/dependency checks. Four rejection guards retain unsupported storage
and deletion holds; three comparison controls reject corrupted observations.

Private instance int/uint/Number prefix/postfix increments and decrements read
once, calculate the numeric result and write through common lexical storage.
Storage coercion does not replace the consumed prefix result: int/uint overflow
and underflow can return a Number outside the field range. Bare, this and
same-class parameter receivers are covered, including null TypeError 1009.
Static/accessor/wildcard updates remain unqualified. Protected instance fields
have separate coverage in native-generated-protected-numeric-updates. The observer
does not implement the Counter or mutate its fields directly.

Compiler run-qflcy1 passes 22 rows/five guards; foreign receiver regression
run-f5vuYM passes five rows/six guards. Full JSON-library behavior remains a
separate integration requirement.
