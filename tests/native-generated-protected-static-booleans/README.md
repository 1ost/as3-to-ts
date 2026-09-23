# Protected static Boolean initialization

Run `node tests/native-generated-protected-static-booleans/run.cjs`, optionally
with `--combined`. Two unchanged AIR subjects match ten observations on ES5/ES2015
in Node/Chromium with zero type errors and twelve compiler rejection guards.

Literal true/false values are published before cinit and are not reapplied after
earlier initializer mutations. Computed call/comparison/logical-and values begin
with false and execute in source order. Direct-child protected access shares the
declaring class's storage. Other numeric/string/computed primitive admission,
ByteArray reflection authority and complete archive execution are separate work.
