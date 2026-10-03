# Generated private RegExp constants

Run `npm run build`, then `node tests/native-generated-regexp-constants/run.cjs`.
`LAYA_ENGINE_REPOSITORY` defaults to `../LayaAir-op2-regexp-constants-review`.

The runner verifies retained AIR source/captures before generating complete
native Class modules. Both ES5 and ES2015 match 18 AIR observations in Node and
Chromium under a strict script policy. Each target also passes 27 runtime checks,
five compiler rejection checks, a reverted-lowering control, and explicit-root
TypeScript checking. Reports retain source, generated modules and input hashes.

An explicit native RegExp provider binds literals, direct Class references,
construction, calls and is/as operations. Private static RegExp constants defer
publication to their original cinit position. Typed local/private member reads
and calls use source property dispatch so detached test/exec functions remain
bound to their RegExp instance. Literal allocations remain fresh even when a
local variable shadows the RegExp identifier.

The fixture also verifies rejected host RegExp coercion, unchanged null storage
after failed coercion, one-shot initialization including null, immutable constant
slots with mutable instance state, forged/cross-generation capabilities, invalid
visibility/types, and distinct instances in sibling loading domains.

Absent providers, missing Class-script initializer authority and direct Class
calls with unsupported argument counts stay rejected. String methods accepting
stored RegExp instances and whole-client runtime acceptance are separate work.
