# Generated ID3Info return boundaries

Run `node tests/native-generated-id3-returns/run.cjs --combined` after building.
The authenticated engine generated-id3-returns packet contains the complete AS3
class and 26 observations from two identical AIR runs. Compiler output matches
all rows on ES5/ES2015 in Node/Chromium with zero generated/dependency diagnostics.

The native ID3Info return binding now uses the existing common nominal return
coercion path. Getter, method, parameter and setter boundaries preserve identity,
normalize undefined to null and reject invalid values. Finally replacement/order
and failed-setter state are compared. The observer contains no translated subject
logic. Two runtime controls reject forged prototypes and structural lookalikes.

Four compiler controls reject bare returns, fallthrough, absent providers and an
unqualified IOError native return. Three controls reject altered expected rows.
Other native return types, native ID3Info member dispatch, native subclasses and
full SoundPlayer remain separate requirements.
