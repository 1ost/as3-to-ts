# Protected numeric updates

Build with `node node_modules/typescript/bin/tsc`, then run
`node tests/native-generated-protected-numeric-updates/run.cjs --combined`.

The runner authenticates the engine generated-protected-numeric-updates AIR packet
and emits both complete original Counter and LeafCounter classes. All 29 rows
match on ES5/ES2015 in Node/Chromium with zero generated/dependency type diagnostics.
Four guards still reject wildcard, String, static and deleted lexical storage;
three comparison controls reject changed observation data.

Prefix/postfix increment/decrement uses the existing common lexical storage
and source access proof for private or protected instance int/uint/Number fields.
The receiver and previous value are read once; storage coercion preserves the
unwrapped prefix result at integer boundaries. Bare/this/peer receivers, inherited
protected ownership across a child declaration and null TypeError 1009 are covered.
No engine access-control or storage rules are relaxed. The driver only observes
emitted classes and contains no translated implementation.

This removes the maintained SoundPlayer ++_currentLoop hold. Its IOError catch
and complete native dependencies/runtime behavior remain separate prerequisites.
Static/accessor/wildcard updates and arbitrary receiver expressions remain held.
