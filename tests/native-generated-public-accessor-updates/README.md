# Public numeric accessor and field updates

CampaignManager and RaidManager stop at increments of public sweepCount
accessors reached through a singleton getter. The compiler previously treated
all resolved foreign public updates as unsupported lexical updates.

Three complete source Classes now exercise public int/uint/Number read/write
accessors and numeric fields, local and owned receivers, and a singleton getter.
Twenty-one AIR Desktop 51.3.4 observations were captured twice identically.
They include all four update operators, overflow and underflow, prefix Number
results versus coerced storage, fractional values, negative zero, NaN, infinity,
getter/setter order, thrown getters/setters, and null errors. The receiver is
resolved once and private namesakes in the caller remain independent.

Both ES5 and ES2015 generated factories match in Node and Chromium with a
script-src self CSP and zero TypeScript diagnostics. Six rejection checks keep
methods, nonnumeric fields, readonly accessors, unknown receivers and missing
property providers guarded. Four applied controls remove writes, replace prefix
results, duplicate getter reads, or drop a negative argument's sign; each is
rejected by the original observations.

The comparison also exposed dropped unary signs in rewritten lexical arguments
and assignment right sides. Those boundaries now include the parser's unary
operator span. This preserves negative arguments and negative zero assignments;
it does not change AS3 source or replace its expressions in the test.

Existing foreign-method (9 rows), private numeric update (22 rows), and protected
numeric update (29 rows) comparisons pass with their rejection guards, in both
targets and runtimes. Complete OP2 manager behavior remains a separate task.

    node tests/native-generated-public-accessor-updates/run.cjs
    node tests/native-generated-public-accessor-updates/retain.cjs <run>/report.json
    node tests/native-generated-public-accessor-updates/verify-runtime.cjs --check-current

Set LAYA_ENGINE_REPOSITORY to the checkout at runtime-pin.json's engine commit.
The report retains complete generated artifacts and authenticates source,
compiler, bundle and typecheck inputs. Current verification requires the local
run artifacts. Re-capture AIR with the shared scripts/nativeFlashOracle.py,
source directory, AccessorUpdatesProbe entry and AIR SDK 51.3.4.
