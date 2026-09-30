# Typed locals shadowing private fields

The compiler admits typed function-local var declarations sharing a name with an own private field when the common typed-local lowering is enabled. Existing function-entry defaults and local binding resolution implement the source behavior; explicit this/Class field accesses retain their lexical capability. Wildcard, constant, nested-function, inherited/protected and method collisions remain held by this change, as do existing parameter and catch redeclaration boundaries.

Two identical AIR WIN 51,3,4,2 captures establish seven complete observations: derived constructor lookup before declaration, source Class reference locals, early local reads, explicit field access during initialization and compound local writes, skipped declarations, Array enumeration and static local/field separation. The unchanged LocalFieldShadowProbe and ShadowValue Classes emit into complete native factories in ES5/ES2015. Node and Chromium (CSP script-src self) match all rows with zero generated/provider type errors. Five rejection guards and one applied default-storage mutation pass in both targets and runtimes.

The applied control alters hoisted local defaults in the generated bundle and requires a complete differing trace. This demonstrates why merely removing the guard without preserving source function-entry storage would be insufficient. No application compatibility layer or runtime modification is introduced.

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-generated-local-field-shadow/run.cjs
    node tests/native-generated-local-field-shadow/verify-runtime.cjs --check-current

Set LAYA_ENGINE_REPOSITORY to ../LayaAir-op2-literal-replace-review at d17b928f57bdf79f2825295409682662e789ae20. This qualifies local/field separation, not full PortManager execution or H5 startup.
