# Preserve compiler errors while unwinding scopes

A failed visitor inside an AS3 catch body can leave its catch scope open. The
outer withScope finally previously replaced the original diagnostic with a
scope-balance error. On failure, restore the scope owned by withScope before
unwinding it and rethrow the original exception. Successful visitors still pass
through the existing balance checks.

Run node tests/native-scope-error-propagation/run.cjs after building. Twelve
complete source-module cases cover direct, try-body, catch-body, nested-catch,
invalid cast arity, and successful catch-body emission on ES5/ES2015. Removing
the cleanup fix reproduces six masked errors. Valid output is byte-identical.
This is compiler diagnostic coverage, not new Flash/runtime qualification.

The adjacent error-event reference fixture also passed 23 original AIR rows,
14 guards and one compiler control on both targets in Node/CSP Chromium.
