# Explicit instance lexical access from static methods

After resolving an exact typed receiver, a static source method may use its
private/protected instance members. The compiler now distinguishes that valid
case from static this and unqualified instance access, which remain rejected.
Reads, writes, updates and calls continue through the common lexical provider;
no receiver authorization or native runtime behavior is bypassed.

    $env:LAYA_ENGINE_REPOSITORY='../LayaAir-op2-xml-traversal-review'
    node tests/native-generated-static-instance/run.cjs
    node tests/native-generated-static-instance/verify-runtime.cjs --check-current

The 26-row AIR fixture extends the already qualified private static uint/retry
fixture with typed parameter/local receivers, protected Array length and push,
private String writes and methods, protected numeric updates, instance isolation
and null receiver TypeError 1009. Two original captures are identical. Complete
generated classes match on ES5/ES2015 in Node/CSP Chromium, with zero types and
sixteen rejection guards. Applied instance-value corruption fails both realms;
the existing retry identity mutation remains Node-only. The historical compiler
34507ab reproduces the static-method hold with this exact fixture.

Fresh descendant/private receiver regressions match eleven AIR rows in both
targets/realms, six guards and an applied compiler mutation. That runner retrieves
its original oracle from historical engine commit 4bcc68bf; current engine inputs
are independently hashed and checked against engine.json. No engine or font edits.

This is shared compiler/runtime fixture evidence. Maintained RadioButtonGroup
emission and full H5 game acceptance require separate integration checks.
