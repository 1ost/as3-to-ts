# String local compound addition

Run `npm run build` and `npm run test:native-string-addition`.

For qualified String locals, supplying the existing
`nativeTypedLocalAdditionModule` enables `+=` through common `as3Add`, followed
by String storage coercion. Function-local temporaries return the raw addition
result, including a number when the old String local was null. The common call
captures the old local before RHS evaluation, preserving reentrant assignment,
conversion order and exceptions. No IIFE changes lexical arguments.

The unchanged StringLocalAdditionProbe matches 16 authenticated AIR observations
in Node/Chromium on ES5/ES2015 with zero strict type diagnostics. Four guards
hold other compound operators, nominal reference compounds and absent/invalid
addition providers. Broader source addition, generated typed storage, Date/E4X
default conversion and complete game behavior are not qualified by this path.
