# Generated DisplayObject constructor parameters

Run `node tests/native-generated-display-constructor/run.cjs` after `npm run tsc`.
The opt-in canonical DisplayObject reference provider now supplies generated
constructor argument coercion, using the existing authenticated reference token.
This does not admit construction of DisplayObject itself or native subclassing.

Thirteen original Pepper Flash 26 observations (two captures) match in ES5 and
ES2015 Chromium with initialized Laya. Valid MovieClip/Sprite/Shape/TextField,
non-display values, null/undefined, string defaults and missing argument behavior
are covered. Forged identities and hostile proxies reject without invoking traps.
Eight compiler guards and three comparison controls pass; generated and dependency
typechecking reports no errors. The native receipt and generated source hashes
are retained in native-result.json.gz; its hash is in native-result-pin.json.
Verify the original source/SWF/captures with verify.cjs.
