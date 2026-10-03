# Typed Timer methods with caller lexical namesakes

CollectionImageLoader declares private `start` while calling its typed Timer's
`start`. Before this change, the compiler incorrectly rejected that native
receiver as a caller lexical member. The retained baseline reproduces this failure.

An explicit `nativeTimerReferenceModule` validates the reference/import plan and
admits Timer constructor parameter coercion. Exact native Timer start/stop/reset
reads and calls with a lexical namesake use the common canonical method helper.
The helper preserves native closure identity and null errors and rejects forged
receivers. Unknown native members, writes, delete, updates, reflection and Timer
subclassing remain outside this proof; existing guards remain in place.

Two identical original AIR captures provide 15 observations from complete
TimerSubject source: fields, locals, parameters, private namesakes, bound closure
identity/call/apply, direct AS3 method call/apply, null calls/reads/parameters, and
invalid constructor input. Both ES5/ES2015 match in Node and CSP Chromium with
zero generated/dependency type errors. Eight compiler rejection guards per target
cover omitted/mismatched authority and unsupported operations. An applied helper
mutation dispatching start as stop is detected in both runtimes for each target.

Run from the compiler checkout with LAYA_ENGINE_REPOSITORY pointing to the pinned
engine worktree:

```
node node_modules/typescript/bin/tsc -p tsconfig.json
node tests/native-timer-lexical/run.cjs
node tests/native-timer-lexical/verify-runtime.cjs --check-current
```

Retain a fresh report with `verify-runtime.cjs --retain <report.json>`. Adjacent
regressions retain 16 ByteArray AIR rows in both targets/realms and 12 Sprite drag
AIR rows plus real pointer checks in CSP Chromium for both targets. ByteArray's
older browser loader does not claim CSP. Its typecheck now includes dom.iterable,
required by the current engine's URLSearchParams use. Full CollectionImageLoader,
real loading/retry behavior and H5 account acceptance are not established here.
