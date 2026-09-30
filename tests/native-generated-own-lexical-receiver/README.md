# Own private static field as an internal method receiver

A complete EventDispatcher subclass reproduces WelfareManager's OwnClass._inst.internalMethod(...) pattern. The shared compiler now authenticates private static storage declared in the current source Class with that exact Class type. It uses the existing package-internal method provider and keeps the full receiver expression, preserving receiver evaluation before arguments. Foreign/untyped/public storage and unrelated shadowed Class names do not receive this authority. Internal method signature restrictions remain unchanged.

Two identical AIR WIN 51,3,4,2 captures retain nine complete observations. The same source Class compiles unchanged into ES5/ES2015 native factories and matches in Node/Chromium with CSP script-src self and zero generated/provider type errors. Checks cover a different calling instance, selected receiver state, stable method closures, retained closure receiver after reassignment, receiver selection before effectful arguments, null error 1009 and argument evaluation before the null failure.

Six guards reject Object/native-base/public storage, a parameter shadowing the Class name, an untyped cast receiver and an unqualified private-method extension. An applied compiler control removes the static field's authenticated type and reproduces the original exact-receiver hold for both targets. This deliberately exercises the narrow added authority, without weakening other lexical rules.

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-generated-own-lexical-receiver/run.cjs
    node tests/native-generated-own-lexical-receiver/verify-runtime.cjs --check-current

Set LAYA_ENGINE_REPOSITORY to engine d17b928f57bdf79f2825295409682662e789ae20. All original captures, source/SWF hashes, generated artifacts, runner/observer/compiler hashes, dependency inputs and observations are retained. The 24-row dispatcher/internal retry, 30-row internal-value and 9-row delayed-call regressions run against these changed compiler sources. This is a bounded language correction, not complete Welfare or whole-game runtime qualification.
