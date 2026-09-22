# Source String replacement lowering

Build, then run `npm run test:native-string-replace`. The entire unchanged AIR
probe matches 13 observations in Node/Chromium on ES5/ES2015, with zero strict
type diagnostics and five scope/argument guards. Numeric replacements, null,
undefined, replacement tokens, Unicode and once-only conversion are exercised.

`nativeStringIntrinsicsModule` routes replace calls on declared local/parameter
String receivers through common sourceStringReplace and compileSourceStringPattern.
Source bindings come from the exact nativeReferenceCoercion consumer resolver;
untyped/member receivers are not inferred. Patterns must be literal regex tokens;
the provider retains its existing grammar, flag and callback qualification limits.
No host RegExp is adopted. Dynamic patterns and other argument counts remain held.
Regex token text is checked against the source because the legacy token end span
excludes flags, while its text preserves them.

This does not repair general String local assignment coercion, admit every
String receiver shape, or qualify complete DateUtil behavior.
