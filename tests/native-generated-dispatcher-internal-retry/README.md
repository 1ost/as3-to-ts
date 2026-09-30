# EventDispatcher Class retries with package-internal declarations

This comparison qualifies direct `flash.events.EventDispatcher` Class script
retries when the source package contains internal fields, constants, methods,
and getters. Other internal source ancestry remains rejected.

Three complete source Classes are emitted. The AIR host is an observer only.
Twenty-four observations were captured twice identically in AIR 51.3.4 and
match ES5/ES2015 output in Node and Chromium with script-src self. The failed
Class generation retains its own internal storage and bound method closure;
a successful generation and a sibling application domain remain independent.
Native event dispatch and lexical Class identity are checked across retries.

Seven rejection checks preserve unsupported boundaries. Twelve domain checks
and three applied controls per target detect loss of Class generations,
internal field initialization, or internal increment behavior. Generated
modules have zero TypeScript diagnostics. Root internal retries and the older
direct EventDispatcher retry comparison also pass with this compiler change.

Run from the compiler root, with LAYA_ENGINE_REPOSITORY pointing to the pinned
engine in native-pin.json:

    node tests/native-generated-dispatcher-internal-retry/run.cjs
    node tests/native-generated-dispatcher-internal-retry/verify-native.cjs --check-current

The retained report authenticates compiler sources, fixture sources, generated
modules, bundle inputs, and typecheck inputs. Current-input verification also
requires the original local run artifacts. This fixture does not establish
complete OP2 manager behavior or working game startup.
