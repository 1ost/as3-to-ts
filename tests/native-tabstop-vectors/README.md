# Canonical TabStop Vector references

Run npm run tsc and node tests/native-tabstop-vectors/run.cjs --combined.
Requires engine b14013f62 or a descendant. The unchanged original Consumer
matches all 40 AIR rows in ES5/ES2015 Chromium with Laya. Ten compiler rejection
guards, four runtime identity controls and three comparison controls pass;
generated and provider code have zero TypeScript diagnostics. The adjacent
SimpleButton Vector fixture still passes all 40 rows in both targets.

The nativeVector flag admits the exact canonical flash.text.engine.TabStop
provider. Generated typed returns require nativeTabStopReferenceModule and exact
provider/module agreement. Constructor-owned native identity rejects prototype
spoofs and proxies. The final class has no subclass fixture: two independent
TabStop instances exercise same-type references. Vector ancestry agrees with
Object and excludes display classes/interfaces.

The engine separately matches 58 original TabStop constructor/setter/value rows
in Node and Chromium. These proofs do not admit generated native construction,
member dispatch, full reflection, static ParagraphElement initialization or
TextBlock/TLF layout. The review provider can advance nominal Vector planning;
full application integration remains open. Retained reports preserve input and
output bytes and hashes. verify.cjs authenticates the retained comparison.
