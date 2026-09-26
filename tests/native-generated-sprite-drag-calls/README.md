# Generated Sprite drag name collisions

Run `node tests/native-generated-sprite-drag-calls/run.cjs` after rebuilding.
The complete captured Owner source declares private startDrag and protected
stopDrag namesakes while calling native Sprite methods through a typed parameter
and private field. Before the fix the factory rejects its first typed call with
AS3_GENERATED_LEXICAL_UNSUPPORTED: lexical receiver requires exact source type.

Both ES5/ES2015 complete factories match twelve repeated AIR observations in
Chromium with real Laya initialization and CSP without unsafe-eval. Checks cover
native bound method identity, retained closures, null error #1009 after argument
effects, and separate caller lexical dispatch. Two pointer checks per target
confirm that generated calls move and stop the actual native Sprite. Four runtime
checks cover sibling domains, shared native closures, forged receiver rejection,
and retained calls after session retirement. Six compiler guards keep missing
reference/native-base authority, assignments, delete, updates and unknown chains
out of this lowering. All generated/dependency types must pass.

The change uses the existing public AS3Property dispatch and native Sprite
provider; no runtime shim is added. It is bounded to startDrag/stopDrag on exact
planned native Sprite receivers with a lexical namesake. Source subclass public
members retain their existing projection path. Complete SimpleDragManager,
startup, and supplied-account validation remain open.
