# String locals and consumed reference assignments

Run `npm run build` and `npm run test:native-string-locals`.

The explicit `nativeStringLocalCoercionModule` accepts the common AS3String module
alongside an exact `nativeReferenceCoercion` consumer plan. It extends that plan's
local binding/default/initializer machinery for raw-consumer builtin String var
locals. Generated classes retain their separate typed-storage qualification.

Ordinary String locals initialize to null at method entry. Initializers and simple
assignments use `as3CoerceString`; no assertion substitutes for conversion. Both
String and planned reference assignments capture the RHS once in a function-local
temporary, store the converted value, and return the original RHS. No IIFE changes
lexical arguments. Direct/parenthesized `typeof` reads of these qualified String
locals retain the source String-null result. This does not fold arbitrary
expressions, property reads, or unqualified parameters.

Two unchanged source probes, authenticated by the engine's retained AIR packets,
compare 21 observations in Node and Chromium for ES5 and ES2015 with zero strict
type diagnostics. They cover default-before-declaration, null/undefined/numbers,
conversion hooks/order/failures, Date assignment rejection, chains, side effects,
arguments, catch shadowing, name collisions and consumed assignment typeof.
Nine guards retain compounds without an addition provider, update/delete, const, duplicate local,
parameter redeclaration, catch declaration and nested-function forms.

The source plan resolves builtin identity before selecting String locals. String
parameters/fields, generated typed locals, other compound writes and source atom identity
through arbitrary wildcard aliases require their own qualification. These tests
do not establish complete game behavior.

The sibling native-string-addition fixture separately qualifies String `+=`
when the common addition provider is explicitly supplied.
The native-string-enumeration fixture qualifies per-item String storage and
header-variable defaults through the existing reference-loop emitter.
