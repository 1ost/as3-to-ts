# Retrying Class scripts with multiple source helpers

Root public owners can now use an ordered set of root/file-private helpers and
helpers derived from external public source Classes. Ancestors require script
global identity, source-only ancestry, no private declarations and no cycles.
Private interfaces, native ancestry, private-helper ancestry, and derived public
owners with multiple/derived helpers retain their existing qualification gates.

No runtime implementation changed. The existing source-unit retry machinery
matches 105 observations in two AIR 51.3.4 captures, for ES5/ES2015 in Node and
strict-CSP Chromium. Tests cover owner/first/derived/last failures, two failed
parents followed by two helper failures, preserved successful ancestors, early
helper lookup, initialization order, captured failed Classes/globals/functions/
arrays, old/new instances, constructor arguments, interfaces and shared globals.
There are zero generated/dependency type errors, nine compiler rejection guards,
19 child/sibling-domain checks and four detected mutations per target/runtime:
constructor argument, early helper lookup, failed global retention, last helper
failure. The baseline planner rejection and exact old planner are retained.

Adjacent ancestor retry: 74 AIR rows, nine guards, 15 domain checks, five mutations.
Adjacent MouseEvent helper retry: 62 AIR rows, eight guards, one newly admitted
source-parent planning check, seven domain checks, four mutations. Historical
archives remain intact. Current adjacent outputs and inputs are in this archive.

Engine AIR fixture: tests/nativeFlashOracle/source-unit-multiple-helper-retry at
f9cb68be22adb1619cf51f70d72d7a29c087b70b.
Set LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE and run this directory's run.cjs.
Use verify.cjs --check-current to verify retained artifacts against current bytes.
Primary run-XYyv03, adjacent run-DeMyKz/run-xkQKEF, baseline run-pqaZ29.
Archive: 41705972 bytes, SHA-256 5f4daccdb8d2c3e74ed3270b396a480a08f8525bbae5109b37e8db480d78bf99.
Original-client factory/type/runtime and real H5 acceptance remain open.
