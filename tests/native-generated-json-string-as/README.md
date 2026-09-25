# JSON input through intrinsic String as

Run `node tests/native-generated-json-string-as/run.cjs` after `npm run tsc`.
The complete Parser source is emitted through the production module factory.
Twenty-four authenticated AIR rows match on ES5/ES2015 in Node and Chromium
under CSP, with zero types, two domain checks, three rejection guards and an
applied mutation removing the as operation (`run-x9FdVK`).

Unshadowed intrinsic `as String` uses common as3As and evaluates its input once.
It preserves strings, returns null for nonstrings, and never calls toString.
JSON parsing accepts that proven String-or-null expression while preserving
source SyntaxError/null receiver behavior. Wildcard input without an as test,
shadowed String parameters and missing type-test provider remain held.

The existing JSON parse regression passes 35 AIR rows and seven guards with
zero types (`run-D56meA`). JSON Class identity, broader dynamic calls and full
ResourceLoader behavior are not established by these checks.
